const mongoose = require("mongoose");

const now = new Date();
const unlock = new Date();
unlock.setDate(now.getDate() + 30);

user.stakingDetails.push({
  amount,
  percent,
  startDate: now,
  lastPaid: now,
  unlockDate: unlock
});

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