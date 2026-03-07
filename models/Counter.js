const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  value: { type: Number, default: 100000 }
});

module.exports = mongoose.model("Counter", counterSchema);