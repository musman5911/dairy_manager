const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { User } = require('../db');
const { protect, adminOnly } = require('../middleware/auth');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error('❌ JWT_SECRET is not set. Add it to your .env file or environment.');
  process.exit(1);
}

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
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

const viewerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/setup — first-time admin creation
router.post('/setup', setupLimiter, async (req, res) => {
  try {
    const count = await User.countDocuments();
    if (count > 0) return res.status(400).json({ error: 'Setup already done' });

    const hash = await bcrypt.hash(req.body.password, 10);
    
    const user = await User.create({
      username: req.body.username || 'admin',
      password: hash,
      role: 'admin',
      farmName: 'Usman Dairy Farm'
    });
    
    const token = jwt.sign({ id: user._id, role: user.role, username: user.username }, SECRET, { expiresIn: '30d' });
    res.json({ token, role: user.role, username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.body.username });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(req.body.password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, role: user.role, username: user.username }, SECRET, { expiresIn: '30d' });
    res.json({ token, role: user.role, username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/add-viewer
router.post('/add-viewer', viewerLimiter, protect, adminOnly, async (req, res) => {
  try {
    const hash = await bcrypt.hash(req.body.password, 10);
    const user = await User.create({
      username: req.body.username,
      password: hash,
      role: 'viewer'
    });
    res.json({ username: user.username, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/check
router.get('/check', async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ setupDone: count > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
