const router = require('express').Router();
const { DailyLog } = require('../db');
const { protect } = require('../middleware/auth');

// GET /api/dailylog/:date  -> returns the log for that date, or an empty shell if none exists yet
router.get('/:date', protect, async (req, res) => {
  try {
    const log = await DailyLog.findById(req.params.date);
    if (!log) {
      return res.json({ _id: req.params.date, date: req.params.date, checklist: [], notes: '' });
    }
    res.json(log);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/dailylog/:date -> upsert (create if missing, update if exists)
// Both admin and worker can save — this is day-to-day operational input.
router.put('/:date', protect, async (req, res) => {
  try {
    const { checklist, notes } = req.body;
    const update = { date: req.params.date };
    if (checklist !== undefined) update.checklist = checklist;
    if (notes !== undefined) update.notes = notes;

    const log = await DailyLog.findByIdAndUpdate(
      req.params.date,
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(log);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
