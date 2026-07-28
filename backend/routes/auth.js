const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { User, PasswordReset } = require('../db');
const { protect, adminOnly } = require('../middleware/auth');
const { sendVerificationCodeEmail, mailConfigured } = require('../utils/mailer');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error('❌ JWT_SECRET is not set. Add it to your .env file or environment.');
  process.exit(1);
}

const TOKEN_TTL = process.env.JWT_EXPIRES_IN || '7d';

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const setupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: 'Too many setup attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many user-management requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many password reset attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function normalizeRole(role) {
  return role === 'admin' ? 'admin' : 'worker';
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function validateEmail(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim().toLowerCase());
}

function toSafeUser(user) {
  if (!user) return null;
  return {
    _id: String(user._id),
    username: user.username,
    role: normalizeRole(user.role),
    displayName: user.displayName || '',
    email: user.email || '',
    active: user.active !== false,
    farmName: user.farmName || 'Usman Dairy Farm',
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
  };
}

function signFor(user) {
  const role = normalizeRole(user.role);
  return jwt.sign(
    { id: String(user._id), role, username: user.username },
    SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

async function createUser({ username, password, role, displayName = '', email = '' }) {
  const cleanUsername = normalizeUsername(username);
  if (!cleanUsername || cleanUsername.length < 3) {
    const err = new Error('Username must be at least 3 characters');
    err.status = 400;
    throw err;
  }
  if (!password || String(password).length < 4) {
    const err = new Error('Password must be at least 4 characters');
    err.status = 400;
    throw err;
  }

  const chosenRole = normalizeRole(role);
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (cleanEmail && !validateEmail(cleanEmail)) {
    const err = new Error('Invalid email format');
    err.status = 400;
    throw err;
  }

  const existingUsername = await User.findOne({ username: cleanUsername });
  if (existingUsername) {
    const err = new Error('A user with that username already exists');
    err.status = 409;
    throw err;
  }
  if (cleanEmail) {
    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      const err = new Error('Email already in use');
      err.status = 409;
      throw err;
    }
  }

  const hash = await bcrypt.hash(String(password), 10);
  return User.create({
    username: cleanUsername,
    password: hash,
    role: chosenRole,
    displayName: String(displayName || '').trim(),
    email: cleanEmail,
    active: true,
    farmName: 'Usman Dairy Farm',
  });
}

// POST /api/auth/setup — first-time admin creation
router.post('/setup', setupLimiter, async (req, res) => {
  try {
    const count = await User.countDocuments();
    if (count > 0) return res.status(400).json({ error: 'Setup already done' });

    const user = await createUser({
      username: req.body?.username || 'admin',
      password: req.body?.password,
      role: 'admin',
      displayName: req.body?.displayName || '',
      email: req.body?.email || '',
    });

    user.lastLoginAt = new Date();
    await user.save();

    const token = signFor(user);
    res.json({ token, role: normalizeRole(user.role), username: user.username, user: toSafeUser(user) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const identifier = normalizeUsername(req.body?.username);
    const user = identifier.includes('@')
      ? await User.findOne({ email: identifier })
      : await User.findOne({ username: identifier });
    if (!user || user.active === false) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(String(req.body?.password || ''), user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    // Normalize any non-admin account into the worker role.
    if (user.role !== 'admin') user.role = 'worker';
    user.lastLoginAt = new Date();
    await user.save();

    const token = signFor(user);
    res.json({ token, role: normalizeRole(user.role), username: user.username, user: toSafeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.active === false) return res.status(401).json({ error: 'User is not active' });
    res.json({ user: toSafeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/auth/me — update own display name/email
router.patch('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.active === false) return res.status(401).json({ error: 'User is not active' });

    if (req.body?.displayName !== undefined) user.displayName = String(req.body.displayName || '').trim();
    if (req.body?.email !== undefined) {
      const cleanEmail = String(req.body.email || '').trim().toLowerCase();
      if (cleanEmail && !validateEmail(cleanEmail)) return res.status(400).json({ error: 'Invalid email format' });
      if (cleanEmail) {
        const duplicate = await User.findOne({ email: cleanEmail, _id: { $ne: user._id } });
        if (duplicate) return res.status(409).json({ error: 'Email already in use' });
      }
      user.email = cleanEmail;
    }

    await user.save();
    res.json({ user: toSafeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/users — admin-only user list
router.get('/users', protect, adminOnly, async (_req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ users: users.map(toSafeUser) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/users — create admin/worker account
router.post('/users', userLimiter, protect, adminOnly, async (req, res) => {
  try {
    const user = await createUser(req.body || {});
    res.status(201).json({ user: toSafeUser(user) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PATCH /api/auth/users/:id — admin-only update user
router.patch('/users/:id', userLimiter, protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isSelf = String(user._id) === String(req.user.id);

    if (req.body?.password !== undefined) {
      if (String(req.body.password).length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
      user.password = await bcrypt.hash(String(req.body.password), 10);
    }

    if (req.body?.role !== undefined) {
      if (isSelf) return res.status(400).json({ error: "You can't change your own role" });
      user.role = normalizeRole(req.body.role);
    }

    if (req.body?.displayName !== undefined) user.displayName = String(req.body.displayName || '').trim();

    if (req.body?.active !== undefined) {
      if (isSelf) return res.status(400).json({ error: "You can't deactivate yourself" });
      user.active = Boolean(req.body.active);
    }

    if (req.body?.email !== undefined) {
      const cleanEmail = String(req.body.email || '').trim().toLowerCase();
      if (cleanEmail && !validateEmail(cleanEmail)) return res.status(400).json({ error: 'Invalid email format' });
      if (cleanEmail) {
        const duplicate = await User.findOne({ email: cleanEmail, _id: { $ne: user._id } });
        if (duplicate) return res.status(409).json({ error: 'Email already in use' });
      }
      user.email = cleanEmail;
    }

    await user.save();
    res.json({ user: toSafeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/users/:id — admin-only delete user
router.delete('/users/:id', userLimiter, protect, adminOnly, async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/change-password — current user password change
router.post('/change-password', userLimiter, protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (String(newPassword).length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters' });
    }

    const user = await User.findById(req.user.id);
    if (!user || user.active === false) return res.status(401).json({ error: 'User is not active' });

    const ok = await bcrypt.compare(String(currentPassword), user.password);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    user.password = await bcrypt.hash(String(newPassword), 10);
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/add-worker', userLimiter, protect, adminOnly, async (req, res) => {
  try {
    const user = await createUser({ username: req.body?.username, password: req.body?.password, role: 'worker' });
    res.json({ username: user.username, role: normalizeRole(user.role), user: toSafeUser(user) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/auth/mail-status — used by login screen to enable/disable password reset.
router.get('/mail-status', (_req, res) => {
  res.json({ configured: mailConfigured() });
});

// POST /api/auth/forgot-password — admin password reset code by SMTP email.
// Always returns { ok: true } for valid email shape to avoid account enumeration.
router.post('/forgot-password', resetLimiter, async (req, res) => {
  try {
    if (!mailConfigured()) {
      return res.status(503).json({ error: 'Email is not configured on this server' });
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || !validateEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    const user = await User.findOne({ email, role: 'admin', active: { $ne: false } });
    if (user) {
      const code = await PasswordReset.createCode({ userId: user._id });
      try {
        await sendVerificationCodeEmail({ to: email, code, username: user.username });
      } catch (mailErr) {
        console.error('Failed to send reset email:', mailErr);
        return res.status(500).json({ error: 'Failed to send email. Check SMTP configuration.' });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /auth/forgot-password error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// POST /api/auth/reset-password — verifies the emailed code and sets a new admin password.
router.post('/reset-password', resetLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'email, code, and newPassword are required' });
    }
    if (!validateEmail(email)) return res.status(400).json({ error: 'A valid email is required' });
    if (newPassword.length < 4) return res.status(400).json({ error: 'New password must be at least 4 characters' });

    const user = await User.findOne({ email, role: 'admin', active: { $ne: false } });
    if (!user) return res.status(400).json({ error: 'Invalid or expired code' });

    const reset = await PasswordReset.findOne({
      purpose: 'reset_password',
      userId: user._id,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!reset || !reset.matchesCode(code)) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    reset.usedAt = new Date();
    await reset.save();

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await PasswordReset.updateMany(
      { purpose: 'reset_password', userId: user._id, usedAt: null },
      { $set: { usedAt: new Date() } }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /auth/reset-password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// GET /api/auth/check
router.get('/check', async (_req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ setupDone: count > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
