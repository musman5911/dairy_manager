const router = require('express').Router();
const { Expense } = require('../db');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.query.cowId) filter.cowId = req.query.cowId;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = req.query.from;
      if (req.query.to) filter.date.$lte = req.query.to;
    }
    res.json(await Expense.find(filter).sort({ date: -1 }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const id = req.body.id || 'e' + Date.now();
    const exp = await Expense.create({ ...req.body, _id: id });
    res.status(201).json(exp);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const update = { ...req.body };
    // Explicitly handle clearing cowId (farm-wide)
    if (req.body.cowId === null) {
      update.cowId = null;
    }
    const exp = await Expense.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!exp) return res.status(404).json({ error: 'Not found' });
    res.json(exp);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
