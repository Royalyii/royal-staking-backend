const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Counter = require("../models/Counter");

const router = express.Router();

async function getNextUID() {
  const counter = await Counter.findOneAndUpdate(
    { name: "uid" },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );
  return counter.value;
}

router.post("/register", async (req, res) => {
  try {
    const { email, password, referralCode } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ msg: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const uid = await getNextUID();

    const newUser = new User({
      uid,
      email,
      password: hashed,
      referralCode: "RS" + uid,
      referredBy: referralCode || null
    });

    await newUser.save();

    res.json({ msg: "Registered successfully" });

  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ msg: "Wrong password" });

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET
    );

    res.json({ token });

  } catch {
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;