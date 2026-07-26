/**
 * Migration script: db.json → MongoDB
 * Run once: node migrate.js
 * Place your db.json in the same folder before running
 */
require('dotenv').config();
const { connectDB, Cow, Milk, Expense, Rate } = require('./db');
const fs = require('fs');
const path = require('path');

async function migrate() {
  await connectDB();
  console.log('Connected to MongoDB. Starting migration...');

  const dbPath = path.join(__dirname, 'db.json');
  if (!fs.existsSync(dbPath)) {
    console.error('db.json not found! Place it in the backend folder.');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  // Migrate cows
  if (data.cows?.length) {
    await Cow.deleteMany({});
    await Cow.insertMany(data.cows.map(c => ({ ...c, _id: c.id || c._id })));
    console.log(`✅ Migrated ${data.cows.length} cows`);
  }

  // Migrate milk
  if (data.milk?.length) {
    await Milk.deleteMany({});
    await Milk.insertMany(data.milk.map(m => ({ ...m, _id: m.id || m._id })));
    console.log(`✅ Migrated ${data.milk.length} milk entries`);
  }

  // Migrate expenses
  if (data.expenses?.length) {
    await Expense.deleteMany({});
    await Expense.insertMany(data.expenses.map(e => ({ ...e, _id: e.id || e._id })));
    console.log(`✅ Migrated ${data.expenses.length} expenses`);
  }

  // Migrate rates
  if (data.rates?.length) {
    await Rate.deleteMany({});
    await Rate.insertMany(data.rates.map(r => ({ ...r, _id: r.id || r._id })));
    console.log(`✅ Migrated rates`);
  }

  console.log('\n🎉 Migration complete! Your data is now in MongoDB.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
