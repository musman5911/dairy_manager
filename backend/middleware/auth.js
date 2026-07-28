const jwt = require('jsonwebtoken');
const { User } = require('../db');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error('❌ JWT_SECRET is not set. Add it to your .env file or environment.');
  process.exit(1);
}

const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Not authorized' });

  let decoded;
  try {
    decoded = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ error: 'Token invalid' });
  }

  if (!decoded?.id) return res.status(401).json({ error: 'Token invalid' });

  try {
    // Re-check the backing user on every request so deleted/deactivated users
    // lose access immediately instead of keeping access until JWT expiry.
    // _id is indexed by MongoDB, and lean() avoids Mongoose document overhead.
    const user = await User.findById(decoded.id).select('_id username role active').lean();
    if (!user || user.active === false) {
      return res.status(401).json({ error: 'User is not active' });
    }

    const role = user.role === 'admin' ? 'admin' : 'worker';
    req.user = {
      id: String(user._id),
      _id: String(user._id),
      username: user.username,
      role,
    };
    return next();
  } catch (err) {
    console.error('Auth user lookup failed:', err);
    return res.status(500).json({ error: 'Authentication check failed' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

const workerOrAdmin = (req, res, next) => {
  if (!['admin', 'worker'].includes(req.user?.role)) return res.status(403).json({ error: 'Worker or admin only' });
  next();
};

module.exports = { protect, adminOnly, workerOrAdmin };
