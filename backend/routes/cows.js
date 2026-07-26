const router = require('express').Router();
const { Cow, Milk, Expense, Health, Sale } = require('../db');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.query.batch) filter.batch = req.query.batch;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.motherId) filter.motherId = req.query.motherId;
    res.json(await Cow.find(filter).sort({ name: 1 }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/batches', protect, async (req, res) => {
  try {
    const batches = await Cow.distinct('batch', { batch: { $ne: '' } });
    res.json(batches.sort());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const cow = await Cow.findById(req.params.id);
    if (!cow) return res.status(404).json({ error: 'Not found' });
    res.json(cow);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/cows/:id/offspring — calves of this cow
router.get('/:id/offspring', protect, async (req, res) => {
  try {
    const calves = await Cow.find({ motherId: req.params.id });
    res.json(calves);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/cows/:id/summary — full detail for popup
router.get('/:id/summary', protect, async (req, res) => {
  try {
    const cow = await Cow.findById(req.params.id);
    if (!cow) return res.status(404).json({ error: 'Not found' });

    const today = new Date();
    const daysAgo7 = new Date(); daysAgo7.setDate(today.getDate() - 7);
    const daysAgo30 = new Date(); daysAgo30.setDate(today.getDate() - 30);
    const d7 = daysAgo7.toISOString().slice(0, 10);
    const d30 = daysAgo30.toISOString().slice(0, 10);

    const [milk7, milk30, allMilk, expenses30, allExpenses, health, offspring, sale] = await Promise.all([
      Milk.find({ cowId: req.params.id, date: { $gte: d7 } }),
      Milk.find({ cowId: req.params.id, date: { $gte: d30 } }),
      Milk.find({ cowId: req.params.id }),
      Expense.find({ cowId: req.params.id, date: { $gte: d30 } }),
      Expense.find({ cowId: req.params.id }),
      Health.find({ cowId: req.params.id }).sort({ date: -1 }).limit(10),
      Cow.find({ motherId: req.params.id }),
      Sale.findOne({ cowId: req.params.id }),
    ]);

    const milk7Total = milk7.reduce((a, m) => a + (m.morning || 0) + (m.evening || 0), 0);
    const milk30Total = milk30.reduce((a, m) => a + (m.morning || 0) + (m.evening || 0), 0);
    const calfMilk30 = milk30.reduce((a, m) => a + (m.calfMilk || 0), 0);

    const expByType = {};
    expenses30.forEach(e => {
      expByType[e.type] = (expByType[e.type] || 0) + (e.amount || 0);
    });

    const mother = cow.motherId ? await Cow.findById(cow.motherId) : null;

    // Lifetime profit calculation (for sold cows)
    const totalMilkRevenue = allMilk.reduce((a, m) => a + ((m.morning || 0) + (m.evening || 0)), 0); // liters only, rate applied on frontend
    const totalDirectExpenses = allExpenses.filter(e => e.type !== 'purchasing').reduce((a, e) => a + (e.amount || 0), 0);
    const totalHealthCost = await Health.find({ cowId: req.params.id }).then(records => records.reduce((a, h) => a + (h.cost || 0), 0));
    const salePrice = sale?.salePrice || 0;
    const purchasePrice = cow.purchasePrice || 0;

    res.json({
      cow,
      milk: { last7Days: milk7Total, last30Days: milk30Total, calfMilk30Days: calfMilk30, records30: milk30, totalLiters: totalMilkRevenue },
      expenses: { total30: expenses30.reduce((a, e) => a + (e.amount || 0), 0), byType: expByType, records30: expenses30, totalAll: totalDirectExpenses },
      health,
      offspring,
      mother,
      sale,
      lifetime: {
        purchasePrice,
        salePrice,
        totalMilkLiters: totalMilkRevenue,
        totalDirectExpenses,
        totalHealthCost,
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const id = req.body.id || String(Date.now());
    const cow = await Cow.create({ ...req.body, _id: id });

    // If calf, link to mother's calvingHistory
    if (cow.motherId && cow.isCalf) {
      await Cow.findByIdAndUpdate(cow.motherId, {
        $push: { calvingHistory: { date: cow.birthDate || new Date().toISOString().slice(0, 10), calfId: cow._id } }
      });
    }

    // Auto-create purchasing expense if purchasePrice > 0
    if (req.body.purchasePrice && req.body.purchasePrice > 0) {
      const expId = 'e' + Date.now();
      const isCalf = req.body.isCalf ? ' (calf)' : '';
      await Expense.create({
        _id: expId,
        cowId: id,
        date: new Date().toISOString().slice(0, 10),
        type: 'purchasing',
        amount: req.body.purchasePrice,
        note: `Purchased ${cow.name}${isCalf} — ${cow.breed}`,
        _purchaseCowId: id,
      });
    }

    res.status(201).json(cow);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const cow = await Cow.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!cow) return res.status(404).json({ error: 'Not found' });
    res.json(cow);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Cow.findByIdAndDelete(req.params.id);
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
