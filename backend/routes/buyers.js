const router = require('express').Router();
const { Buyer } = require('../db');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  try { res.json(await Buyer.find().sort({ name: 1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const id = 'b' + Date.now();
    const buyer = await Buyer.create({ ...req.body, _id: id });
    res.status(201).json(buyer);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const buyer = await Buyer.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
