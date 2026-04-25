const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { auth } = require("../middleware/authMiddleware");


// ================= PROFIT TIER FUNCTION =================
function getProfitPercent(amount) {
  if (amount <= 50) return 0.02;
  if (amount <= 100) return 0.025;
  if (amount <= 200) return 0.031;
  if (amount <= 250) return 0.034;
  if (amount <= 301) return 0.036;
  if (amount <= 400) return 0.04;
  if (amount <= 500) return 0.043;
  if (amount <= 650) return 0.046;
  return 0.05;
}


// ================= STAKE =================
router.post("/stake", auth, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0)
      return res.status(400).json({ msg: "Invalid amount" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (user.wallets.invest < amount)
      return res.status(400).json({ msg: "Insufficient invest wallet" });

    const percent = getProfitPercent(amount);

    // Move funds
    user.wallets.invest -= amount;
    user.wallets.staking += amount;

    // 30 day lock
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

    await user.save();

    await Transaction.create({
      userId: user._id,
      type: "stake",
      amount,
      status: "approved"
    });

    res.json({ msg: "Stake successful. Profit accrues daily." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});


// ================= RECHARGE REQUEST =================
router.post("/recharge", auth, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0)
      return res.status(400).json({ msg: "Invalid amount" });

    await Transaction.create({
      userId: req.user.id,
      type: "recharge",
      amount,
      status: "pending"
    });

    res.json({ msg: "Recharge request submitted. Awaiting approval." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});


// ================= WITHDRAW REQUEST =================
router.post("/withdraw-request", auth, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 2)
      return res.status(400).json({ msg: "Minimum withdrawal must exceed 2 USDT" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (user.wallets.profit < amount)
      return res.status(400).json({ msg: "Insufficient balance" });

    await Transaction.create({
      userId: user._id,
      type: "withdraw",
      amount,
      status: "pending"
    });

    res.json({ msg: "Withdrawal request submitted for approval." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});


module.exports = router;