require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const User = require("./models/User");
const bodyParser = require("body-parser");

connectDB();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Royal Staking Backend is running!");
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/staking", require("./routes/staking"));
app.use("/api/admin", require("./routes/admin"));


// ================= DAILY PROFIT ENGINE =================
setInterval(async () => {
  try {
    const users = await User.find();

    for (let user of users) {
      let updated = false;

      for (let stake of user.stakingDetails) {

        const now = new Date();
        const diffDays = Math.floor(
          (now - stake.lastPaid) / (1000 * 60 * 60 * 24)
        );

        if (diffDays > 0) {

          const dailyProfit = stake.amount * stake.percent;
          const totalProfit = dailyProfit * diffDays;

          // Add profit to user
          user.wallets.profit += totalProfit;

          // ===== Referral Distribution =====
          let currentRef = user.referredBy;
          const referralPercents = [0.05, 0.03, 0.01];

          for (let level = 0; level < 3; level++) {
            if (!currentRef) break;

            const refUser = await User.findOne({ referralCode: currentRef });
            if (!refUser) break;

            const commission = totalProfit * referralPercents[level];
            refUser.wallets.profit += commission;
            await refUser.save();

            currentRef = refUser.referredBy;
          }

          stake.lastPaid = now;
          updated = true;
        }
      }

      if (updated) await user.save();
    }

  } catch (err) {
    console.error("Daily engine error:", err);
  }
}, 86400000); // runs every 24 hours


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
