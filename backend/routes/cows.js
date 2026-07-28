const { randomUUID } = require('crypto');
const router = require('express').Router();
const { Cow, Milk, Expense, Health, Sale } = require('../db');
const { protect, adminOnly } = require('../middleware/auth');
const {
  readString,
  readDate,
  readNonNegativeNumber,
  readBoolean,
  readEnum,
  sendValidationError,
  parsePagination,
} = require('./input');
const { todayStr, daysAgoStr } = require('../utils/date');

function cowPayload(body, { requireBasics = false } = {}) {
  const errors = [];
  const payload = {};

  const name = readString(body, 'name', errors, { required: requireBasics, allowEmpty: false });
  if (name !== undefined) payload.name = name;
  const breed = readString(body, 'breed', errors, { required: requireBasics, allowEmpty: false });
  if (breed !== undefined) payload.breed = breed;

  const gender = readEnum(body, 'gender', ['female', 'male'], errors);
  if (gender !== undefined) payload.gender = gender;
  const status = readEnum(body, 'status', ['active', 'inactive', 'dry', 'pregnant', 'sold', 'calf'], errors);
  if (status !== undefined) payload.status = status;

  ['birthDate', 'calvingDate', 'pregnancyDate', 'heatDate', 'dryDate', 'nursingUntil'].forEach((field) => {
    const value = readDate(body, field, errors);
    if (value !== undefined) payload[field] = value;
  });

  ['ageYears', 'weight', 'purchasePrice'].forEach((field) => {
    const value = readNonNegativeNumber(body, field, errors);
    if (value !== undefined) payload[field] = value;
  });
  const lactationNumber = readNonNegativeNumber(body, 'lactationNumber', errors, { integer: true });
  if (lactationNumber !== undefined) payload.lactationNumber = lactationNumber;

  ['image', 'notes', 'batch', 'motherId'].forEach((field) => {
    const value = readString(body, field, errors);
    if (value !== undefined) payload[field] = value;
  });

  const isCalf = readBoolean(body, 'isCalf');
  if (isCalf !== undefined) payload.isCalf = isCalf;

  return { payload, errors };
}

router.get('/', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.query.batch) filter.batch = req.query.batch;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.motherId) filter.motherId = req.query.motherId;
    const { limit, skip } = parsePagination(req.query);
    // TODO: Add total counts/cursors if the UI needs full paginated tables later.
    res.json(await Cow.find(filter).sort({ name: 1 }).skip(skip).limit(limit));
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

    const d7 = daysAgoStr(7);
    const d30 = daysAgoStr(30);

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

    // Lifetime profit calculation (for sold cows). totalMilkLiters is saleable liters only; calf milk is not sold.
    const totalSaleableMilkLiters = allMilk.reduce((a, m) => a + Math.max(0, (m.morning || 0) + (m.evening || 0) - (m.calfMilk || 0)), 0);
    const totalDirectExpenses = allExpenses.filter(e => e.type !== 'purchasing').reduce((a, e) => a + (e.amount || 0), 0);
    const totalHealthCost = await Health.find({ cowId: req.params.id }).then(records => records.reduce((a, h) => a + (h.cost || 0), 0));
    const salePrice = sale?.salePrice || 0;
    const purchasePrice = cow.purchasePrice || 0;

    res.json({
      cow,
      milk: { last7Days: milk7Total, last30Days: milk30Total, calfMilk30Days: calfMilk30, records30: milk30, totalLiters: totalSaleableMilkLiters },
      expenses: { total30: expenses30.reduce((a, e) => a + (e.amount || 0), 0), byType: expByType, records30: expenses30, totalAll: totalDirectExpenses },
      health,
      offspring,
      mother,
      sale,
      lifetime: {
        purchasePrice,
        salePrice,
        totalMilkLiters: totalSaleableMilkLiters,
        milkRecords: allMilk,
        totalDirectExpenses,
        totalHealthCost,
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { payload, errors } = cowPayload(req.body, { requireBasics: true });
    if (errors.length) return sendValidationError(res, errors);

    const id = randomUUID();
    const cow = await Cow.create({ ...payload, _id: id });

    // If calf, link to mother's calvingHistory
    if (cow.motherId && cow.isCalf) {
      await Cow.findByIdAndUpdate(cow.motherId, {
        $push: { calvingHistory: { date: cow.birthDate || todayStr(), calfId: cow._id } }
      });
    }

    // Auto-create purchasing expense if purchasePrice > 0
    if (payload.purchasePrice && payload.purchasePrice > 0) {
      const expId = randomUUID();
      const isCalf = payload.isCalf ? ' (calf)' : '';
      await Expense.create({
        _id: expId,
        cowId: id,
        date: todayStr(),
        type: 'purchasing',
        amount: payload.purchasePrice,
        note: `Purchased ${cow.name}${isCalf} — ${cow.breed}`,
        _purchaseCowId: id,
      });
    }

    res.status(201).json(cow);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { payload, errors } = cowPayload(req.body);
    if (errors.length) return sendValidationError(res, errors);
    const cow = await Cow.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });
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
