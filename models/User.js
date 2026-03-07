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
