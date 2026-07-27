const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error('❌ JWT_SECRET is not set. Add it to your .env file or environment.');
  process.exit(1);
}

const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    req.user = jwt.verify(token, SECRET);
    if (!['admin', 'worker'].includes(req.user?.role)) req.user.role = 'worker';
    next();
  } catch {
    res.status(401).json({ error: 'Token invalid' });
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
