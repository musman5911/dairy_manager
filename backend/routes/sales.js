const { randomUUID } = require('crypto');
const router = require('express').Router();
const { Sale, Cow } = require('../db');
const { protect, adminOnly } = require('../middleware/auth');
const {
  readString,
  readDate,
  readNonNegativeNumber,
  sendValidationError,
} = require('./input');

function salePayload(body, { requireBasics = false } = {}) {
  const errors = [];
  const payload = {};

  const cowId = readString(body, 'cowId', errors, { required: requireBasics, allowEmpty: false });
  if (cowId !== undefined) payload.cowId = cowId;
  const date = readDate(body, 'date', errors, { required: requireBasics });
  if (date !== undefined) payload.date = date;
  const salePrice = readNonNegativeNumber(body, 'salePrice', errors, { required: requireBasics });
  if (salePrice !== undefined) payload.salePrice = salePrice;
  ['buyer', 'notes'].forEach((field) => {
    const value = readString(body, field, errors);
    if (value !== undefined) payload[field] = value;
  });

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
    res.json(await Sale.find(filter).sort({ date: -1 }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { payload, errors } = salePayload(req.body, { requireBasics: true });
    if (errors.length) return sendValidationError(res, errors);

    const id = randomUUID();
    // Guard: can't sell a cow that's already sold
    const cow = await Cow.findById(payload.cowId);
    if (!cow) return res.status(404).json({ error: 'Cow not found' });
    if (cow.status === 'sold') return res.status(400).json({ error: `${cow.name} is already marked as sold` });

    // Save the cow's current status before marking as sold
    const previousStatus = cow.status;

    const sale = await Sale.create({ ...payload, _id: id, previousStatus });

    // Mark cow as sold
    cow.status = 'sold';
    await cow.save();

    res.status(201).json(sale);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { payload, errors } = salePayload(req.body);
    if (errors.length) return sendValidationError(res, errors);
    const sale = await Sale.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });
    if (!sale) return res.status(404).json({ error: 'Not found' });
    res.json(sale);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Not found' });
    await sale.deleteOne();

    // Restore cow's previous status (not hardcoded 'active')
    if (sale.cowId) {
      const cow = await Cow.findById(sale.cowId);
      if (cow && cow.status === 'sold') {
        cow.status = sale.previousStatus || 'active';
        await cow.save();
      }
    }

    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
