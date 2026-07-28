const router = require('express').Router();
const mongoose = require('mongoose');
const { Cow, Milk, Expense, Rate, Health, Buyer, RateHistory, DailyLog, Sale } = require('../db');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/backup — download full database as JSON
// TODO: For very large farms, consider streaming or chunked backup exports instead of unbounded find() calls.
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const [cows, milk, expenses, rates, health, buyers, rateHistory, dailyLogs, sales] = await Promise.all([
      Cow.find(), Milk.find(), Expense.find(), Rate.find(), Health.find(), Buyer.find(), RateHistory.find(), DailyLog.find(), Sale.find()
    ]);
    const backup = {
      exportDate: new Date().toISOString(),
      farmName: 'Usman Dairy Farm',
      cows, milk, expenses, rates, health, buyers, rateHistory, dailyLogs, sales
    };
    res.setHeader('Content-Disposition', `attachment; filename=usman-dairy-backup-${new Date().toISOString().slice(0,10)}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.json(backup);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Valid collection keys and their Mongoose models
const COLLECTIONS = {
  cows: Cow,
  milk: Milk,
  expenses: Expense,
  rates: Rate,
  health: Health,
  buyers: Buyer,
  rateHistory: RateHistory,
  dailyLogs: DailyLog,
  sales: Sale,
};

// POST /api/backup/restore — restore from JSON backup (atomic)
router.post('/restore', protect, adminOnly, async (req, res) => {
  // ── Step 1: Shape validation ─────────────────────────────────
  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Invalid backup payload' });
  }

  for (const key of Object.keys(COLLECTIONS)) {
    const val = payload[key];
    if (val !== undefined && !Array.isArray(val)) {
      return res.status(400).json({ error: `"${key}" must be an array if present` });
    }
  }

  // At least one collection must have data
  const hasData = Object.keys(COLLECTIONS).some(key => payload[key]?.length > 0);
  if (!hasData) {
    return res.status(400).json({ error: 'Backup contains no data to restore' });
  }

  // ── Step 2: Atomic restore with transaction ──────────────────
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const [key, Model] of Object.entries(COLLECTIONS)) {
        const data = payload[key];
        if (data?.length) {
          await Model.deleteMany({}, { session });
          await Model.insertMany(data, { session });
        }
      }
    });
    res.json({ success: true, message: 'Data restored successfully' });
  } catch (e) {
    res.status(500).json({ error: `Restore failed (all changes rolled back): ${e.message}` });
  } finally {
    session.endSession();
  }
});

module.exports = router;
