const { randomUUID } = require('crypto');
const router = require('express').Router();
const { Milk } = require('../db');
const { protect, adminOnly, workerOrAdmin } = require('../middleware/auth');
const {
  readString,
  readDate,
  readNonNegativeNumber,
  sendValidationError,
  parsePagination,
} = require('./input');

function milkPayload(body, { requireBasics = false } = {}) {
  const errors = [];
  const payload = {};

  const cowId = readString(body, 'cowId', errors, { required: requireBasics, allowEmpty: false });
  if (cowId !== undefined) payload.cowId = cowId;
  const date = readDate(body, 'date', errors, { required: requireBasics });
  if (date !== undefined) payload.date = date;

  ['morning', 'evening', 'calfMilk', 'fatPercent', 'snfPercent'].forEach((field) => {
    const value = readNonNegativeNumber(body, field, errors);
    if (value !== undefined) payload[field] = value;
  });

  const buyerId = readString(body, 'buyerId', errors);
  if (buyerId !== undefined) payload.buyerId = buyerId;

  return { payload, errors };
}

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
    const { limit, skip } = parsePagination(req.query);
    // TODO: Add total counts/cursors if the UI needs full paginated history later.
    res.json(await Milk.find(filter).sort({ date: -1 }).skip(skip).limit(limit));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', protect, workerOrAdmin, async (req, res) => {
  try {
    const { payload, errors } = milkPayload(req.body, { requireBasics: true });
    if (errors.length) return sendValidationError(res, errors);

    // Duplicate detection
    const existing = await Milk.findOne({ cowId: payload.cowId, date: payload.date });
    if (existing && !req.body.forceOverwrite) {
      return res.status(409).json({
        error: 'Duplicate entry',
        message: `Milk entry for this cow on ${payload.date} already exists.`,
        existing
      });
    }
    if (existing && req.body.forceOverwrite) {
      const updated = await Milk.findByIdAndUpdate(existing._id, { $set: payload }, { new: true });
      return res.json(updated);
    }
    const id = randomUUID();
    const entry = await Milk.create({ ...payload, _id: id });
    res.status(201).json(entry);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', protect, workerOrAdmin, async (req, res) => {
  try {
    const { payload, errors } = milkPayload(req.body);
    if (errors.length) return sendValidationError(res, errors);
    const entry = await Milk.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });
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
