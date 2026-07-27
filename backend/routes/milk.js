const router = require('express').Router();
const { Milk } = require('../db');
const { protect, adminOnly, workerOrAdmin } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.query.cowId) filter.cowId = req.query.cowId;
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = req.query.from;
      if (req.query.to) filter.date.$lte = req.query.to;
    }
    if (req.query.month) {
      // month format: "2026-07" — filter for entire month
      const [y, m] = req.query.month.split('-').map(Number);
      const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const endDay = new Date(y, m, 0).getDate();
      const endDate = `${y}-${String(m).padStart(2, '0')}-${endDay}`;
      filter.date = { $gte: startDate, $lte: endDate };
    }
    res.json(await Milk.find(filter).sort({ date: -1 }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', protect, workerOrAdmin, async (req, res) => {
  try {
    // Duplicate detection
    const existing = await Milk.findOne({ cowId: req.body.cowId, date: req.body.date });
    if (existing && !req.body.forceOverwrite) {
      return res.status(409).json({
        error: 'Duplicate entry',
        message: `Milk entry for this cow on ${req.body.date} already exists.`,
        existing
      });
    }
    if (existing && req.body.forceOverwrite) {
      const updated = await Milk.findByIdAndUpdate(existing._id, req.body, { new: true });
      return res.json(updated);
    }
    const id = req.body.id || 'm' + Date.now();
    const entry = await Milk.create({ ...req.body, _id: id });
    res.status(201).json(entry);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', protect, workerOrAdmin, async (req, res) => {
  try {
    const entry = await Milk.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json(entry);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Milk.findByIdAndDelete(req.params.id);
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
