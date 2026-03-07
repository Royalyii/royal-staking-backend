const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { auth } = require("../middleware/authMiddleware");


// ================= CEO CHECK =================
function isCEO(req) {
  return req.user.email === process.env.CEO_EMAIL;
}


// ================= GET ALL USERS =================
router.get("/users", auth, async (req, res) => {
  if (!isCEO(req))
    return res.status(403).json({ msg: "Access denied" });

  const users = await User.find().select("-password");
  res.json(users);
});


// ================= GET USER BY UID =================
router.get("/user/:uid", auth, async (req, res) => {
  if (!isCEO(req))
    return res.status(403).json({ msg: "Access denied" });

  const user = await User.findOne({ uid: req.params.uid }).select("-password");
  if (!user) return res.status(404).json({ msg: "User not found" });

  res.json(user);
});


// ================= VIEW PENDING RECHARGES =================
router.get("/recharges", auth, async (req, res) => {
  if (!isCEO(req))
    return res.status(403).json({ msg: "Access denied" });

  const recharges = await Transaction.find({
    type: "recharge",
    status: "pending"
  });

  res.json(recharges);
});


// ================= APPROVE RECHARGE =================
router.post("/approve-recharge/:id", auth, async (req, res) => {
  if (!isCEO(req))
    return res.status(403).json({ msg: "Access denied" });

  const transaction = await Transaction.findById(req.params.id);

  if (!transaction || transaction.type !== "recharge")
    return res.status(400).json({ msg: "Invalid transaction" });

  if (transaction.status !== "pending")
    return res.status(400).json({ msg: "Already processed" });

  transaction.status = "approved";
  await transaction.save();

  const user = await User.findById(transaction.userId);
  user.wallets.invest += transaction.amount;
  await user.save();

  res.json({ msg: "Recharge approved and credited." });
});


// ================= REJECT RECHARGE =================
router.post("/reject-recharge/:id", auth, async (req, res) => {
  if (!isCEO(req))
    return res.status(403).json({ msg: "Access denied" });

  const transaction = await Transaction.findById(req.params.id);

  if (!transaction || transaction.type !== "recharge")
    return res.status(400).json({ msg: "Invalid transaction" });

  transaction.status = "rejected";
  await transaction.save();

  res.json({ msg: "Recharge rejected." });
});
 
router.get("/withdrawals", auth, async (req, res) => {
  if (req.user.email !== process.env.CEO_EMAIL)
    return res.status(403).json({ msg: "Access denied" });

  const withdrawals = await Transaction.find({
    type: "withdraw",
    status: "pending"
  });

  res.json(withdrawals);
});

router.post("/approve-withdraw/:id", auth, async (req, res) => {
  if (req.user.email !== process.env.CEO_EMAIL)
    return res.status(403).json({ msg: "Access denied" });

  const tx = await Transaction.findById(req.params.id);
  if (!tx || tx.type !== "withdraw")
    return res.status(400).json({ msg: "Invalid request" });

  const user = await User.findById(tx.userId);

  user.wallets.profit -= tx.amount;

  const fee = 2;
  const ceo = await User.findOne({ email: process.env.CEO_EMAIL });
  ceo.wallets.profit += fee;

  await ceo.save();
  await user.save();

  tx.status = "approved";
  await tx.save();

  res.json({ msg: "Withdrawal approved." });
});

router.get("/stats", auth, async (req, res) => {
  if (req.user.email !== process.env.CEO_EMAIL)
    return res.status(403).json({ msg: "Access denied" });

  const totalUsers = await User.countDocuments();
  const totalInvested = await User.aggregate([
    { $group: { _id: null, total: { $sum: "$wallets.staking" } } }
  ]);

  const totalProfit = await User.aggregate([
    { $group: { _id: null, total: { $sum: "$wallets.profit" } } }
  ]);

  res.json({
    totalUsers,
    totalInvested: totalInvested[0]?.total || 0,
    totalProfit: totalProfit[0]?.total || 0
  });
});
module.exports = router;