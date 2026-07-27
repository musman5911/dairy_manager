const router = require('express').Router();
const { Health, Expense } = require('../db');
const { protect, adminOnly, workerOrAdmin } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.query.cowId) filter.cowId = req.query.cowId;
    if (req.query.type) filter.type = req.query.type;
    res.json(await Health.find(filter).sort({ date: -1 }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get upcoming/overdue records
router.get('/upcoming', protect, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0,10);
    const in30 = new Date(); in30.setDate(in30.getDate() + 30);
    const in30ISO = in30.toISOString().slice(0,10);
    const records = await Health.find({
      nextDueDate: { $exists: true, $ne: '', $lte: in30ISO }
    }).sort({ nextDueDate: 1 });
    res.json(records);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', protect, workerOrAdmin, async (req, res) => {
  try {
    const id = 'h' + Date.now();
    const record = await Health.create({ ...req.body, _id: id });

    // Auto-create expense if cost > 0
    if (req.body.cost && req.body.cost > 0) {
      const expId = 'e' + Date.now();
      const expenseNote = `${req.body.type}: ${req.body.description}${req.body.medicine ? ' — ' + req.body.medicine : ''}`;
      await Expense.create({
        _id: expId,
        cowId: req.body.cowId || null,
        date: req.body.date,
        type: 'medicine',
        amount: req.body.cost,
        note: expenseNote,
        _healthId: id,
      });
    }

    res.status(201).json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', protect, workerOrAdmin, async (req, res) => {
  try {
    const record = await Health.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!record) return res.status(404).json({ error: 'Not found' });

    // Find linked expense
    const existingExp = await Expense.findOne({ _healthId: req.params.id });

    // ── Handle cost changes ─────────────────────────────────
    if (req.body.cost !== undefined) {
      if (req.body.cost > 0) {
        const expenseNote = `${record.type}: ${record.description}${record.medicine ? ' — ' + record.medicine : ''}`;
        if (existingExp) {
          existingExp.amount = req.body.cost;
          existingExp.cowId = record.cowId || null;
          existingExp.date = record.date;
          existingExp.note = expenseNote;
          await existingExp.save();
        } else {
          await Expense.create({
            _id: 'e' + Date.now(),
            cowId: record.cowId || null,
            date: record.date,
            type: 'medicine',
            amount: req.body.cost,
            note: expenseNote,
            _healthId: req.params.id,
          });
        }
      } else if (existingExp) {
        // Cost set to 0 — remove linked expense
        await existingExp.deleteOne();
      }
    }

    // ── Sync cowId/date even when cost wasn't changed ───────
    if (existingExp && req.body.cost === undefined) {
      let needsSave = false;
      if (req.body.cowId !== undefined && existingExp.cowId !== (record.cowId || null)) {
        existingExp.cowId = record.cowId || null;
        needsSave = true;
      }
      if (req.body.date !== undefined && existingExp.date !== record.date) {
        existingExp.date = record.date;
        needsSave = true;
      }
      if (needsSave) await existingExp.save();
    }

    res.json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    // Delete linked expense if exists
    await Expense.deleteOne({ _healthId: req.params.id });
    await Health.findByIdAndDelete(req.params.id);
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
