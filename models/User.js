<<<<<<< HEAD
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['user', 'ceo'],
    default: 'user',
  },

  // CEO first-login OTP
  isFirstLogin: { type: Boolean, default: false },
  otpCode:      { type: String },
  otpExpiry:    { type: Date },

  // Failed login / lockout
  failedAttempts: { type: Number, default: 0 },
  lockedUntil:    { type: Date },

  // Password reset code
  resetCode:       { type: String },
  resetCodeExpiry: { type: Date },

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
=======
const mongoose = require("mongoose");

// Schema for each staking record
const stakingDetailSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  percent: { type: Number, required: true },

  startDate: { type: Date, default: Date.now },
  lastPaid: { type: Date, default: Date.now },

  unlockDate: { type: Date, required: true }
});

// Main user schema
const userSchema = new mongoose.Schema({
  uid: { type: Number, unique: true },

  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },

  referralCode: { type: String, unique: true },
  referredBy: { type: String, default: null },

  wallets: {
    invest: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    staking: { type: Number, default: 0 }
  },

  stakingDetails: [stakingDetailSchema]

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
>>>>>>> 14e456db696a6d57287587a8e66ab2369bcc5842
