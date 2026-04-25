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
  isFirstLogin: { type: Boolean, default: false },
  otpCode:      { type: String },
  otpExpiry:    { type: Date },
  failedAttempts: { type: Number, default: 0 },
  lockedUntil:    { type: Date },
  resetCode:       { type: String },
  resetCodeExpiry: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);