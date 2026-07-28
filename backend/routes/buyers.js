const { randomUUID } = require('crypto');
const router = require('express').Router();
const { Buyer } = require('../db');
const { protect, adminOnly } = require('../middleware/auth');
const { readString, readNonNegativeNumber, sendValidationError } = require('./input');

function buyerPayload(body, { requireBasics = false } = {}) {
  const errors = [];
  const payload = {};
  const name = readString(body, 'name', errors, { required: requireBasics, allowEmpty: false });
  if (name !== undefined) payload.name = name;
  ['phone', 'address', 'notes'].forEach((field) => {
    const value = readString(body, field, errors);
    if (value !== undefined) payload[field] = value;
  });
  const defaultRate = readNonNegativeNumber(body, 'defaultRate', errors);
  if (defaultRate !== undefined) payload.defaultRate = defaultRate;
  return { payload, errors };
}

router.get('/', protect, async (req, res) => {
  try { res.json(await Buyer.find().sort({ name: 1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { payload, errors } = buyerPayload(req.body, { requireBasics: true });
    if (errors.length) return sendValidationError(res, errors);
    const id = randomUUID();
    const buyer = await Buyer.create({ ...payload, _id: id });
    res.status(201).json(buyer);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { payload, errors } = buyerPayload(req.body);
    if (errors.length) return sendValidationError(res, errors);
    const buyer = await Buyer.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });
    if (!buyer) return res.status(404).json({ error: 'Not found' });
    res.json(buyer);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Buyer.findByIdAndDelete(req.params.id);
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
