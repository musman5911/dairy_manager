/**
 * Seed script — populates the database with realistic test data for Usman Dairy Farm.
 * Run once:  node seed.js
 * Re-run:    it will clear existing data first, then re-seed.
 */
require('dotenv').config();
const { connectDB, Cow, Milk, Expense, Rate, RateHistory, Health, Buyer, User, DailyLog, Sale } = require('./db');

function dateStr(d) {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function randomBetween(min, max) {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10;
}

async function seed() {
  await connectDB();
  console.log('Connected to MongoDB. Clearing old data...\n');

  await Promise.all([
    Cow.deleteMany({}),
    Milk.deleteMany({}),
    Expense.deleteMany({}),
    Rate.deleteMany({}),
    RateHistory.deleteMany({}),
    Health.deleteMany({}),
    Buyer.deleteMany({}),
    DailyLog.deleteMany({}),
    Sale.deleteMany({}),
    // NOTE: We do NOT delete Users — preserve existing admin account
  ]);

  // ──────────────────────────────────────────────
  // COWS
  // ──────────────────────────────────────────────
  const cowsData = [
    { _id: 'cow1', name: 'Laila',     breed: 'Sahiwal',        status: 'active',   birthDate: '2020-03-15', weight: 420, lactationNumber: 4, calvingDate: '2026-02-10', batch: 'Original Herd', purchasePrice: 150000, calvingHistory: [{ date: '2026-02-10', calfId: 'cow13' }], image: 'https://images.unsplash.com/photo-1527153857715-3908f2bae5e8?w=200&h=200&fit=crop' },
    { _id: 'cow2', name: 'Moti',      breed: 'Holstein Friesian', status: 'active', birthDate: '2019-07-22', weight: 510, lactationNumber: 5, calvingDate: '2026-01-05', batch: 'Original Herd', purchasePrice: 250000, calvingHistory: [{ date: '2026-01-05', calfId: 'cow14' }], image: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=200&h=200&fit=crop' },
    { _id: 'cow3', name: 'Rani',      breed: 'Sahiwal',        status: 'active',   birthDate: '2021-11-01', weight: 390, lactationNumber: 3, calvingDate: '2026-03-20', batch: 'Original Herd', purchasePrice: 140000 },
    { _id: 'cow4', name: 'Sundar',    breed: 'Red Sindhi',     status: 'pregnant', birthDate: '2019-01-10', weight: 440, lactationNumber: 5, calvingDate: '2025-12-01', pregnancyDate: '2026-03-15', batch: 'Original Herd', purchasePrice: 160000, image: 'https://images.unsplash.com/photo-1570042225858-73f8a6e3a5d5?w=200&h=200&fit=crop' },
    { _id: 'cow5', name: 'Chameli',   breed: 'Cholistani',     status: 'active',   birthDate: '2022-05-18', weight: 370, lactationNumber: 2, calvingDate: '2026-04-12', batch: 'Jan 2025 Batch', purchasePrice: 130000 },
    { _id: 'cow6', name: 'Guddi',     breed: 'Sahiwal',        status: 'dry',      birthDate: '2018-09-30', weight: 400, lactationNumber: 6, calvingDate: '2025-06-15', dryDate: '2026-06-01', batch: 'Original Herd', purchasePrice: 120000 },
    { _id: 'cow7', name: 'Shehzadi',  breed: 'Holstein Friesian', status: 'active', birthDate: '2020-12-05', weight: 530, lactationNumber: 4, calvingDate: '2026-05-20', batch: 'Jan 2025 Batch', purchasePrice: 280000, image: 'https://images.unsplash.com/photo-1596733430284-f7437764b1a9?w=200&h=200&fit=crop' },
    { _id: 'cow8', name: 'Jasmine',   breed: 'Jersey',         status: 'active',   birthDate: '2021-08-14', weight: 350, lactationNumber: 3, calvingDate: '2026-06-01', batch: 'Mar 2025 Batch', purchasePrice: 200000 },
    { _id: 'cow9', name: 'Kiran',     breed: 'Red Sindhi',     status: 'active',   birthDate: '2022-02-28', weight: 380, lactationNumber: 2, calvingDate: '2026-03-05', batch: 'Original Herd', purchasePrice: 145000 },
    { _id: 'cow10', name: 'Noor',     breed: 'Cholistani',     status: 'sold',     birthDate: '2017-04-20', weight: 360, lactationNumber: 7, batch: 'Original Herd', purchasePrice: 100000 },
    { _id: 'cow11', name: 'Basanti',  breed: 'Sahiwal',        status: 'active',   birthDate: '2023-01-10', weight: 340, lactationNumber: 1, calvingDate: '2026-07-01', batch: 'Mar 2025 Batch', purchasePrice: 155000 },
    { _id: 'cow12', name: 'Sufi',     breed: 'Holstein Friesian', status: 'active', birthDate: '2020-06-25', weight: 500, lactationNumber: 4, calvingDate: '2026-04-18', batch: 'Original Herd', purchasePrice: 260000, image: 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=200&h=200&fit=crop' },
    { _id: 'cow13', name: 'Chhoti',   breed: 'Sahiwal',        gender: 'female', status: 'calf',     birthDate: '2026-02-10', weight: 45,  lactationNumber: 0, motherId: 'cow1', isCalf: true, nursingUntil: '2026-04-25', batch: 'Born on Farm', purchasePrice: 0 },
    { _id: 'cow14', name: 'Golu',     breed: 'Holstein Friesian', gender: 'male', status: 'calf',  birthDate: '2026-01-05', weight: 52,  lactationNumber: 0, motherId: 'cow2', isCalf: true, nursingUntil: '2026-03-20', batch: 'Born on Farm', purchasePrice: 0 },
    { _id: 'cow15', name: 'Shera',    breed: 'Sahiwal',        gender: 'male',   status: 'active',   birthDate: '2023-06-15', weight: 580, lactationNumber: 0, batch: 'Jan 2025 Batch', purchasePrice: 200000 },
    { _id: 'cow16', name: 'Bahadur',  breed: 'Red Sindhi',     gender: 'male',   status: 'active',   birthDate: '2024-01-20', weight: 520, lactationNumber: 0, batch: 'Mar 2025 Batch', purchasePrice: 180000 },
  ];
  await Cow.insertMany(cowsData);
  console.log(`✅ Inserted ${cowsData.length} cows`);

  // ──────────────────────────────────────────────
  // MILK RECORDS (last 60 days for active cows)
  // ──────────────────────────────────────────────
  const activeCows = cowsData.filter(c => c.status === 'active');
  const milkRecords = [];
  let milkId = 1;

  // Average daily yield per cow (liters)
  const cowYield = {
    cow1: { m: 8, e: 5 },   // Sahiwal
    cow2: { m: 14, e: 10 }, // Holstein — high producer
    cow3: { m: 7, e: 4 },
    cow5: { m: 6, e: 4 },
    cow7: { m: 12, e: 9 },
    cow8: { m: 9, e: 6 },
    cow9: { m: 7, e: 5 },
    cow11: { m: 5, e: 3 },  // First lactation
    cow12: { m: 13, e: 10 },
  };

  for (let day = 0; day < 60; day++) {
    const d = new Date();
    d.setDate(d.getDate() - day);
    const ds = dateStr(d);

    for (const cow of activeCows) {
      const avg = cowYield[cow._id];
      if (!avg) continue;

      // Add some random variation ±20%
      const morning = randomBetween(avg.m * 0.8, avg.m * 1.2);
      const evening = randomBetween(avg.e * 0.8, avg.e * 1.2);

      // Slight chance of missing entry (simulate real life)
      if (Math.random() < 0.03) continue;

      milkRecords.push({
        _id: `m${milkId++}`,
        cowId: cow._id,
        date: ds,
        morning,
        evening,
      });
    }
  }
  await Milk.insertMany(milkRecords);
  console.log(`✅ Inserted ${milkRecords.length} milk records (60 days)`);

  // ──────────────────────────────────────────────
  // BUYERS
  // ──────────────────────────────────────────────
  const buyersData = [
    { _id: 'b1', name: 'Khan Dairy Shop',   phone: '0301-1234567', address: 'Main Bazaar, Islamabad', defaultRate: 140 },
    { _id: 'b2', name: 'Ali Baba Dairy',     phone: '0312-9876543', address: 'G-9 Markaz, Islamabad',  defaultRate: 135 },
    { _id: 'b3', name: 'Chai Wala (Rashid)', phone: '0333-5551234', address: 'F-10 Sector',            defaultRate: 130 },
  ];
  await Buyer.insertMany(buyersData);
  console.log(`✅ Inserted ${buyersData.length} buyers`);

  // ──────────────────────────────────────────────
  // RATE + RATE HISTORY
  // ──────────────────────────────────────────────
  await Rate.create({ _id: '1', value: 145, date: daysAgo(0) });
  await RateHistory.insertMany([
    { _id: 'rh1', value: 120, date: daysAgo(60), note: 'Initial rate' },
    { _id: 'rh2', value: 125, date: daysAgo(45), note: 'Changed from 120 to 125' },
    { _id: 'rh3', value: 130, date: daysAgo(30), note: 'Changed from 125 to 130' },
    { _id: 'rh4', value: 135, date: daysAgo(15), note: 'Changed from 130 to 135' },
    { _id: 'rh5', value: 140, date: daysAgo(7),  note: 'Changed from 135 to 140' },
  ]);
  console.log('✅ Inserted milk rate: ₨145/L + 5 rate changes over 60 days');

  // ──────────────────────────────────────────────
  // EXPENSES (last 60 days)
  // ──────────────────────────────────────────────
  const expensesData = [];
  let expId = 1;

  for (let day = 0; day < 60; day++) {
    const ds = daysAgo(day);

    // Daily feed cost — bulk
    expensesData.push({
      _id: `e${expId++}`, date: ds, type: 'feed', amount: randomBetween(4000, 6500), note: 'Daily feed (wheat bran, cottonseed, silage)',
    });

    // Water / utilities every few days
    if (day % 3 === 0) {
      expensesData.push({
        _id: `e${expId++}`, date: ds, type: 'misc', amount: randomBetween(500, 1200), note: 'Water tanker + electricity',
      });
    }

    // Labor — monthly salary recorded weekly
    if (day % 7 === 0) {
      expensesData.push({
        _id: `e${expId++}`, date: ds, type: 'labor', amount: 5000, note: 'Milkman weekly salary',
      });
    }
  }

  // Medicine expenses (scattered)
  expensesData.push({ _id: `e${expId++}`, date: daysAgo(5),  type: 'medicine', cowId: 'cow3', amount: 1800, note: 'Mastitis treatment — Rani' });
  expensesData.push({ _id: `e${expId++}`, date: daysAgo(12), type: 'medicine', cowId: 'cow1', amount: 950,  note: 'Deworming tablet' });
  expensesData.push({ _id: `e${expId++}`, date: daysAgo(20), type: 'medicine', cowId: 'cow7', amount: 2500, note: 'Foot and mouth vaccine' });
  expensesData.push({ _id: `e${expId++}`, date: daysAgo(35), type: 'medicine', amount: 3200,            note: 'Bulk vitamins and supplements' });

  // Equipment
  expensesData.push({ _id: `e${expId++}`, date: daysAgo(15), type: 'equipment', amount: 8000, note: 'New milking machine bucket' });
  expensesData.push({ _id: `e${expId++}`, date: daysAgo(40), type: 'equipment', amount: 4500, note: 'Water trough repair' });

  // Purchasing expenses (auto-created when cows were bought)
  expensesData.push({ _id: `e${expId++}`, cowId: 'cow1', date: daysAgo(180), type: 'purchasing', amount: 150000, note: 'Purchased Laila — Sahiwal', _purchaseCowId: 'cow1' });
  expensesData.push({ _id: `e${expId++}`, cowId: 'cow2', date: daysAgo(200), type: 'purchasing', amount: 250000, note: 'Purchased Moti — Holstein Friesian', _purchaseCowId: 'cow2' });
  expensesData.push({ _id: `e${expId++}`, cowId: 'cow3', date: daysAgo(150), type: 'purchasing', amount: 140000, note: 'Purchased Rani — Sahiwal', _purchaseCowId: 'cow3' });
  expensesData.push({ _id: `e${expId++}`, cowId: 'cow4', date: daysAgo(220), type: 'purchasing', amount: 160000, note: 'Purchased Sundar — Red Sindhi', _purchaseCowId: 'cow4' });
  expensesData.push({ _id: `e${expId++}`, cowId: 'cow5', date: daysAgo(100), type: 'purchasing', amount: 130000, note: 'Purchased Chameli — Cholistani', _purchaseCowId: 'cow5' });
  expensesData.push({ _id: `e${expId++}`, cowId: 'cow6', date: daysAgo(300), type: 'purchasing', amount: 120000, note: 'Purchased Guddi — Sahiwal', _purchaseCowId: 'cow6' });
  expensesData.push({ _id: `e${expId++}`, cowId: 'cow7', date: daysAgo(120), type: 'purchasing', amount: 280000, note: 'Purchased Shehzadi — Holstein Friesian', _purchaseCowId: 'cow7' });
  expensesData.push({ _id: `e${expId++}`, cowId: 'cow8', date: daysAgo(90), type: 'purchasing', amount: 200000, note: 'Purchased Jasmine — Jersey', _purchaseCowId: 'cow8' });
  expensesData.push({ _id: `e${expId++}`, cowId: 'cow9', date: daysAgo(140), type: 'purchasing', amount: 145000, note: 'Purchased Kiran — Red Sindhi', _purchaseCowId: 'cow9' });
  expensesData.push({ _id: `e${expId++}`, cowId: 'cow10', date: daysAgo(350), type: 'purchasing', amount: 100000, note: 'Purchased Noor — Cholistani', _purchaseCowId: 'cow10' });
  expensesData.push({ _id: `e${expId++}`, cowId: 'cow11', date: daysAgo(60), type: 'purchasing', amount: 155000, note: 'Purchased Basanti — Sahiwal', _purchaseCowId: 'cow11' });
  expensesData.push({ _id: `e${expId++}`, cowId: 'cow12', date: daysAgo(170), type: 'purchasing', amount: 260000, note: 'Purchased Sufi — Holstein Friesian', _purchaseCowId: 'cow12' });
  expensesData.push({ _id: `e${expId++}`, cowId: 'cow15', date: daysAgo(90), type: 'purchasing', amount: 200000, note: 'Purchased Shera (bull) — Sahiwal', _purchaseCowId: 'cow15' });
  expensesData.push({ _id: `e${expId++}`, cowId: 'cow16', date: daysAgo(60), type: 'purchasing', amount: 180000, note: 'Purchased Bahadur (bull) — Red Sindhi', _purchaseCowId: 'cow16' });

  await Expense.insertMany(expensesData);
  console.log(`✅ Inserted ${expensesData.length} expense records`);

  // ──────────────────────────────────────────────
  // HEALTH RECORDS
  // ──────────────────────────────────────────────
  const healthData = [
    { _id: 'h1',  cowId: 'cow1', date: daysAgo(45), type: 'vaccination', description: 'FMD Vaccine (Foot & Mouth)',     nextDueDate: daysAgo(-15), cost: 1200, vet: 'Dr. Aslam' },
    { _id: 'h2',  cowId: 'cow2', date: daysAgo(30), type: 'vaccination', description: 'Brucellosis Vaccine',            nextDueDate: daysAgo(-60), cost: 800,  vet: 'Dr. Aslam' },
    { _id: 'h3',  cowId: 'cow3', date: daysAgo(5),  type: 'treatment',   description: 'Mastitis — left rear quarter',   medicine: 'Mastilex + Amoxicillin', nextDueDate: daysAgo(-2), cost: 1800, vet: 'Dr. Aslam' },
    { _id: 'h4',  cowId: 'cow1', date: daysAgo(12), type: 'deworming',   description: 'Quarterly deworming',            nextDueDate: daysAgo(-78), cost: 400 },
    { _id: 'h5',  cowId: 'cow5', date: daysAgo(20), type: 'vaccination', description: 'HS Vaccine (Haemorrhagic Septicemia)', nextDueDate: daysAgo(-10), cost: 600, vet: 'Dr. Aslam' },
    { _id: 'h6',  cowId: 'cow7', date: daysAgo(20), type: 'vaccination', description: 'FMD Vaccine',                    nextDueDate: daysAgo(-10), cost: 1200, vet: 'Dr. Aslam' },
    { _id: 'h7',  cowId: 'cow4', date: daysAgo(10), type: 'checkup',     description: 'Pregnancy check — 4 months confirmed', cost: 500, vet: 'Dr. Nadeem' },
    { _id: 'h8',  cowId: 'cow9', date: daysAgo(25), type: 'deworming',   description: 'Deworming + mineral supplement', cost: 350 },
    { _id: 'h9',  cowId: 'cow12', date: daysAgo(3), type: 'treatment',   description: 'Eye infection — left eye',       medicine: 'Tobrex eye drops', nextDueDate: daysAgo(-4), cost: 450, vet: 'Dr. Aslam' },
    { _id: 'h10', cowId: 'cow11', date: daysAgo(8), type: 'checkup',     description: 'Post-calving health check',      cost: 300, vet: 'Dr. Nadeem' },
    { _id: 'h11', cowId: 'cow2', date: daysAgo(1),  type: 'vaccination', description: 'Bovine TB Test (annual)',        nextDueDate: daysAgo(-364), cost: 1500, vet: 'Dr. Aslam' },
  ];
  await Health.insertMany(healthData);
  console.log(`✅ Inserted ${healthData.length} health records`);

  // ──────────────────────────────────────────────
  // ANIMAL SALES (a few historical)
  // ──────────────────────────────────────────────
  const salesData = [
    { _id: 's1', cowId: 'cow10', date: daysAgo(60), salePrice: 180000, buyer: 'Qasim Cattle Market', notes: 'Old cow, low production — sold at mandi' },
  ];
  await Sale.insertMany(salesData);
  console.log(`✅ Inserted ${salesData.length} animal sales`);

  // ──────────────────────────────────────────────
  // DAILY LOGS (last 14 days — checklist + diary)
  // ──────────────────────────────────────────────
  const checklist = [
    { id: 'morning-milking', text: 'Morning milking done', done: true },
    { id: 'evening-milking', text: 'Evening milking done', done: true },
    { id: 'feed-given',      text: 'Feed given',           done: true },
    { id: 'water-checked',   text: 'Water checked / refilled', done: true },
    { id: 'health-check',    text: 'Checked for signs of illness', done: true },
    { id: 'cleaning',        text: 'Shed cleaned',         done: true },
  ];

  const diaryNotes = [
    'Hot day — gave extra water. All cows eating well. Rani still on medication.',
    'Rainy morning — delayed milking by 30 mins. Chand Wala came for milk delivery.',
    'New silage batch delivered (12 bags). Quality looks good this time.',
    'Khan Dairy Shop called — wants to increase order by 5L/day starting next week.',
    'Dr. Aslam visited — gave routine vaccines to cow5 and cow7. Everything looks healthy.',
    'Electricity issue — ran generator for 2 hours. Feed store running low, need to order.',
    'Cow4 showing signs of comfort — pregnancy progressing well. Estimated calving in ~2 months.',
    'Milk production slightly down today — probably due to heat. Added electrolytes to water.',
    'Regular day. Sold surplus milk to Ali Baba Dairy. All tasks done on time.',
    'Weekly labor salary paid. Bought new rope and halter from market.',
    'Basanti (cow11) first milking after calving — producing 5L morning, 3L evening. Good start!',
    'Mixed feed ration adjusted — increased cottonseed portion by 10%. Will monitor production.',
    'Rani finished mastitis treatment — quarter looking much better. Vet says resume normal milking.',
    'Checked all water troughs — cleaned and refilled. No issues found.',
  ];

  const dailyLogs = [];
  for (let day = 0; day < 14; day++) {
    if (day >= 14) break;
    const ds = daysAgo(day);
    const items = checklist.map((item, i) => ({
      ...item,
      // Randomize: most tasks done, occasional miss
      done: Math.random() > 0.08,
    }));
    dailyLogs.push({
      _id: ds,
      date: ds,
      checklist: items,
      notes: diaryNotes[day] || '',
    });
  }
  await DailyLog.insertMany(dailyLogs);
  console.log(`✅ Inserted ${dailyLogs.length} daily logs`);

  // ──────────────────────────────────────────────
  // DONE
  // ──────────────────────────────────────────────
  console.log('\n🎉 Seed complete! Your test database is ready.');
  console.log('   Username: admin  (create on first login via the app)');
  console.log('   Open http://localhost:3000 to start.\n');

  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
