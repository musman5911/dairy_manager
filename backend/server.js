require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { connectDB } = require('./db');

const app = express();

app.use(helmet());

// CORS — restrict to frontend URL in production, allow all in dev
const allowedOrigin = process.env.FRONTEND_URL || '*';
if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  console.warn('⚠️ FRONTEND_URL is not set in production; CORS will allow all origins.');
}
app.use(cors({
  origin: allowedOrigin,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(mongoSanitize());

// Broad API rate limiter: authenticated data routes still need a safety net in case a token leaks or a script loops.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many API requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// API Routes
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/cows',     require('./routes/cows'));
app.use('/api/milk',     require('./routes/milk'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/rates',    require('./routes/rates'));
app.use('/api/health',   require('./routes/health'));
app.use('/api/buyers',   require('./routes/buyers'));
app.use('/api/backup',   require('./routes/backup'));
app.use('/api/dailylog', require('./routes/dailylog'));
app.use('/api/sales',    require('./routes/sales'));
app.use('/api/email',    require('./routes/email'));

// Serve React frontend ONLY in production mode
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
} else {
  // Simple health route for dev backend
  app.get('/', (req, res) => {
    res.send('API Server is running...');
  });
}

const PORT = process.env.PORT || 3000;
connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
});