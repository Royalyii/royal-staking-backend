const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function genCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendResetEmail(toEmail, code) {
  await transporter.sendMail({
    from: `"Royal Staking" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Your Royal Staking Reset Code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0A0A12;color:#F0EAD6;padding:32px;border-radius:12px;">
        <h2 style="color:#C9A84C;">Royal Staking</h2>
        <p>Your 6-digit reset code is:</p>
        <div style="background:#1A1A2E;border:1px solid rgba(201,168,76,0.3);border-radius:10px;padding:20px;text-align:center;margin:20px 0;">
          <span style="font-size:36px;letter-spacing:12px;font-weight:700;color:#E8C96A;">${code}</span>
        </div>
        <p style="color:#888;font-size:12px;">Expires in 15 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
}

async function sendOtpEmail(toEmail, otp) {
  await transporter.sendMail({
    from: `"Royal Staking" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Royal Staking — CEO Access Code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0A0A12;color:#F0EAD6;padding:32px;border-radius:12px;">
        <h2 style="color:#C9A84C;">Royal Staking — CEO Access</h2>
        <p>Your one-time access code:</p>
        <div style="background:#1A1A2E;border:1px solid rgba(201,168,76,0.5);border-radius:10px;padding:20px;text-align:center;margin:20px 0;">
          <span style="font-size:36px;letter-spacing:12px;font-weight:700;color:#E8C96A;">${otp}</span>
        </div>
        <p style="color:#888;font-size:12px;">Expires in 10 minutes. You will be forced to change your password after this.</p>
      </div>
    `,
  });
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password required.' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(401).json({ message: 'Invalid credentials.' });

    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      const mins = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      return res.status(403).json({
        message: `Account locked. Try again in ${mins} minute(s).`,
        locked: true,
      });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      user.failedAttempts = (user.failedAttempts || 0) + 1;

      if (user.failedAttempts >= 3) {
        const code = genCode();
        user.resetCode = await bcrypt.hash(code, 10);
        user.resetCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
        user.failedAttempts = 0;
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();
        await sendResetEmail(user.email, code);

        return res.status(403).json({
          message: 'Too many failed attempts. A reset code has been sent to your email.',
          locked: true,
          resetSent: true,
        });
      }

      await user.save();
      const remaining = 3 - user.failedAttempts;
      return res.status(401).json({
        message: `Incorrect password. ${remaining} attempt(s) remaining.`,
        attemptsLeft: remaining,
      });
    }

    user.failedAttempts = 0;
    user.lockedUntil = null;

    if (user.role === 'ceo' && user.isFirstLogin) {
      const otp = genCode();
      user.otpCode = await bcrypt.hash(otp, 10);
      user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();
      await sendOtpEmail(user.email, otp);

      return res.json({
        message: 'CEO first login. OTP sent to your email.',
        ceoFirstLogin: true,
        userId: user._id,
      });
    }

    await user.save();

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful.',
      token,
      user: { id: user._id, email: user.email, role: user.role },
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/auth/verify-ceo-otp
router.post('/verify-ceo-otp', async (req, res) => {
  try {
    const { userId, otp } = req.body;
    const user = await User.findById(userId);

    if (!user || user.role !== 'ceo')
      return res.status(404).json({ message: 'User not found.' });

    if (!user.otpCode || !user.otpExpiry || user.otpExpiry < Date.now())
      return res.status(400).json({ message: 'OTP expired. Please log in again.' });

    const valid = await bcrypt.compare(otp, user.otpCode);
    if (!valid)
      return res.status(401).json({ message: 'Incorrect OTP.' });

    user.otpCode = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const tempToken = jwt.sign(
      { userId: user._id, role: 'ceo', scope: 'force-change-password' },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    res.json({ message: 'OTP verified.', tempToken });

  } catch (err) {
    console.error('CEO OTP error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/auth/ceo-set-password
router.post('/ceo-set-password', async (req, res) => {
  try {
    const { tempToken, newPassword } = req.body;

    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    if (decoded.scope !== 'force-change-password')
      return res.status(403).json({ message: 'Not authorized.' });

    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.password = await bcrypt.hash(newPassword, 12);
    user.isFirstLogin = false;
    await user.save();

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ message: 'Password updated. Access granted.', token });

  } catch (err) {
    console.error('CEO set password error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });

    if (!user) {
      return res.json({ message: 'If that email exists, a reset code has been sent.' });
    }

    const code = genCode();
    user.resetCode = await bcrypt.hash(code, 10);
    user.resetCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    await sendResetEmail(user.email, code);

    res.json({ message: 'If that email exists, a reset code has been sent.' });

  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/auth/verify-reset-code
router.post('/verify-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });

    if (!user || !user.resetCode || !user.resetCodeExpiry)
      return res.status(400).json({ message: 'No reset request found.' });

    if (user.resetCodeExpiry < Date.now())
      return res.status(400).json({ message: 'Reset code expired. Request a new one.' });

    const valid = await bcrypt.compare(code, user.resetCode);
    if (!valid)
      return res.status(401).json({ message: 'Incorrect reset code.' });

    const resetToken = jwt.sign(
      { userId: user._id, scope: 'reset-password' },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    res.json({ message: 'Code verified.', resetToken });

  } catch (err) {
    console.error('Verify reset code error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    if (decoded.scope !== 'reset-password')
      return res.status(403).json({ message: 'Not authorized.' });

    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.password = await bcrypt.hash(newPassword, 12);
    user.resetCode = undefined;
    user.resetCodeExpiry = undefined;
    user.lockedUntil = undefined;
    user.failedAttempts = 0;
    await user.save();

    res.json({ message: 'Password reset successful. You can now log in.' });

  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;