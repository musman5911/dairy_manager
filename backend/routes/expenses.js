const { randomUUID } = require('crypto');
const router = require('express').Router();
const { Expense } = require('../db');
const { protect, adminOnly, workerOrAdmin } = require('../middleware/auth');
const {
  readString,
  readDate,
  readNonNegativeNumber,
  readEnum,
  sendValidationError,
  parsePagination,
} = require('./input');

function expensePayload(body, { requireBasics = false } = {}) {
  const errors = [];
  const payload = {};

  const cowId = body.cowId === null ? null : readString(body, 'cowId', errors);
  if (cowId !== undefined) payload.cowId = cowId || null;
  const date = readDate(body, 'date', errors, { required: requireBasics });
  if (date !== undefined) payload.date = date;
  const type = readEnum(body, 'type', ['feed', 'medicine', 'misc', 'equipment', 'labor', 'purchasing'], errors, { required: requireBasics });
  if (type !== undefined) payload.type = type;
  const amount = readNonNegativeNumber(body, 'amount', errors, { required: requireBasics });
  if (amount !== undefined) payload.amount = amount;
  const note = readString(body, 'note', errors);
  if (note !== undefined) payload.note = note;

  return { payload, errors };
}

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
    const { limit, skip } = parsePagination(req.query);
    // TODO: Add total counts/cursors if the UI needs full paginated history later.
    res.json(await Expense.find(filter).sort({ date: -1 }).skip(skip).limit(limit));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', protect, workerOrAdmin, async (req, res) => {
  try {
    const { payload, errors } = expensePayload(req.body, { requireBasics: true });
    if (errors.length) return sendValidationError(res, errors);
    const id = randomUUID();
    const exp = await Expense.create({ ...payload, _id: id });
    res.status(201).json(exp);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', protect, workerOrAdmin, async (req, res) => {
  try {
    const { payload, errors } = expensePayload(req.body);
    if (errors.length) return sendValidationError(res, errors);
    const exp = await Expense.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });
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
