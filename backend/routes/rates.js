const router = require('express').Router();
const { Rate, RateHistory } = require('../db');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  try {
    let rate = await Rate.findById('1');
    if (!rate) rate = await Rate.create({ _id: '1', value: 130, date: new Date().toISOString().slice(0,10) });
    res.json(rate);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Alias: client calls /rates/1
router.get('/1', protect, async (req, res) => {
  try {
    let rate = await Rate.findById('1');
    if (!rate) rate = await Rate.create({ _id: '1', value: 130, date: new Date().toISOString().slice(0,10) });
    res.json(rate);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/1', protect, adminOnly, async (req, res) => {
  try {
    const old = await Rate.findById('1');
    // Save to history
    if (old) {
      await RateHistory.create({
        _id: 'rh' + Date.now(),
        value: old.value,
        date: old.date || new Date().toISOString().slice(0,10),
        note: `Changed from ${old.value} to ${req.body.value}`
      });
    }
    const rate = await Rate.findByIdAndUpdate('1',
      { value: req.body.value, date: new Date().toISOString().slice(0,10) },
      { new: true, upsert: true }
    );
    res.json(rate);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/history', protect, async (req, res) => {
  try { res.json(await RateHistory.find().sort({ date: -1 }).limit(20)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
