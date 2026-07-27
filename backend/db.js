const mongoose = require('mongoose');
const crypto = require('crypto');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CowSchema = new mongoose.Schema({
  _id: String,
  name: { type: String, required: true },
  breed: { type: String, required: true },
  gender: { type: String, enum: ['female', 'male'], default: 'female' },
  birthDate: String,
  ageYears: Number,
  weight: Number,
  status: { type: String, enum: ['active', 'inactive', 'dry', 'pregnant', 'sold', 'calf'], default: 'active' },
  image: { type: String, default: '' },
  purchasePrice: { type: Number, default: 0 },
  notes: String,
  calvingDate: String,
  lactationNumber: { type: Number, default: 0 },
  pregnancyDate: String,
  heatDate: String,
  dryDate: String,
  // Batch & lineage
  batch: { type: String, default: '' },          // e.g. "Jan 2026 Batch"
  motherId: { type: String, default: '' },       // links calf to mother
  isCalf: { type: Boolean, default: false },
  nursingUntil: String,                           // date when nursing period ends
  calvingHistory: [{
    date: String,
    calfId: String,
    notes: String,
  }],
}, { timestamps: true });

const MilkSchema = new mongoose.Schema({
  _id: String,
  cowId: { type: String, required: true },
  date: { type: String, required: true },
  morning: { type: Number, default: 0 },
  evening: { type: Number, default: 0 },
  calfMilk: { type: Number, default: 0 },  // liters given to calf (not sold)
  fatPercent: Number,
  snfPercent: Number,
  buyerId: String
}, { timestamps: true });

const ExpenseSchema = new mongoose.Schema({
  _id: String,
  cowId: String,
  date: { type: String, required: true },
  type: { type: String, enum: ['feed', 'medicine', 'misc', 'equipment', 'labor', 'purchasing'], default: 'misc' },
  amount: { type: Number, required: true },
  note: String,
  _healthId: String,  // links to Health record that auto-created this expense
  _purchaseCowId: String,  // links to Cow that was purchased
}, { timestamps: true });

const RateSchema = new mongoose.Schema({
  _id: String,
  value: { type: Number, required: true },
  date: String
}, { timestamps: true });

const HealthSchema = new mongoose.Schema({
  _id: String,
  cowId: { type: String, required: true },
  date: { type: String, required: true },
  type: { type: String, enum: ['vaccination', 'treatment', 'checkup', 'deworming', 'other'], required: true },
  description: { type: String, required: true },
  medicine: String,
  vet: String,
  nextDueDate: String,
  cost: { type: Number, default: 0 },
  notes: String
}, { timestamps: true });

const BuyerSchema = new mongoose.Schema({
  _id: String,
  name: { type: String, required: true },
  phone: String,
  address: String,
  defaultRate: Number,
  notes: String
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'worker'], default: 'worker' },
  displayName: { type: String, default: '' },
  email: { type: String, default: '', trim: true, lowercase: true },
  active: { type: Boolean, default: true },
  lastLoginAt: Date,
  farmName: { type: String, default: 'Usman Dairy Farm' }
}, { timestamps: true });

const PasswordResetSchema = new mongoose.Schema({
  purpose: { type: String, enum: ['reset_password'], required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  usedAt: { type: Date, default: null },
}, { timestamps: true });

PasswordResetSchema.statics.generateCode = function () {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  return { code, codeHash };
};

PasswordResetSchema.methods.matchesCode = function (candidate) {
  if (!candidate) return false;
  const hash = crypto.createHash('sha256').update(String(candidate)).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(this.codeHash, 'hex'));
};

PasswordResetSchema.statics.createCode = async function ({ userId }) {
  const { code, codeHash } = this.generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await this.updateMany(
    { purpose: 'reset_password', userId, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } }
  );
  await this.create({ purpose: 'reset_password', userId, codeHash, expiresAt });
  return code;
};

const RateHistorySchema = new mongoose.Schema({
  _id: String,
  value: Number,
  date: String,
  note: String
}, { timestamps: true });

const ChecklistItemSchema = new mongoose.Schema({
  id: String,
  text: String,
  done: { type: Boolean, default: false }
}, { _id: false });

const DailyLogSchema = new mongoose.Schema({
  _id: String, // date string, e.g. "2026-07-24"
  date: { type: String, required: true },
  checklist: { type: [ChecklistItemSchema], default: [] },
  notes: { type: String, default: '' }
}, { timestamps: true });

const SaleSchema = new mongoose.Schema({
  _id: String,
  cowId: { type: String, required: true },
  date: { type: String, required: true },
  salePrice: { type: Number, required: true },
  buyer: String,
  notes: String,
  previousStatus: { type: String, default: 'active' },
}, { timestamps: true });

// ─── Models ──────────────────────────────────────────────────────────────────
const Cow = mongoose.model('Cow', CowSchema);
const Milk = mongoose.model('Milk', MilkSchema);
const Expense = mongoose.model('Expense', ExpenseSchema);
const Rate = mongoose.model('Rate', RateSchema);
const Health = mongoose.model('Health', HealthSchema);
const Buyer = mongoose.model('Buyer', BuyerSchema);
const User = mongoose.model('User', UserSchema);
const PasswordReset = mongoose.model('PasswordReset', PasswordResetSchema);
const RateHistory = mongoose.model('RateHistory', RateHistorySchema);
const DailyLog = mongoose.model('DailyLog', DailyLogSchema);
const Sale = mongoose.model('Sale', SaleSchema);

module.exports = { connectDB, Cow, Milk, Expense, Rate, Health, Buyer, User, PasswordReset, RateHistory, DailyLog, Sale };
