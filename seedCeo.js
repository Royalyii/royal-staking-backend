require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const existing = await User.findOne({ email: 'bigmansimba2@gmail.com' });
  if (existing) {
    console.log('CEO already exists. Resetting to first-login state...');
    existing.password = await bcrypt.hash('123@+++ROMEmatterwellon', 12);
    existing.isFirstLogin = true;
    existing.failedAttempts = 0;
    existing.lockedUntil = undefined;
    await existing.save();
    console.log('CEO account reset.');
  } else {
    await User.create({
      email: 'bigmansimba2@gmail.com',
      password: await bcrypt.hash('123@+++ROMEmatterwellon', 12),
      role: 'ceo',
      isFirstLogin: true,
    });
    console.log('CEO account created.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });