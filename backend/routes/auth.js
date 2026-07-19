const express = require('express');
const router = express.Router();
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'vexel-secret-key-12345';

// Helper to get audit log
async function createAuditLog(userId, action, details, ip) {
  try {
    await prisma.auditLog.create({
      data: { userId, action, details, ipAddress: ip }
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

// 1. STEP 1: INITIALIZE REGISTRATION (Generate TOTP Secret & QR Code)
router.post('/register-init', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      if (existingUser.status === 'ACTIVE') {
        return res.status(400).json({ error: 'User already registered. Please login.' });
      }
      if (existingUser.status === 'PENDING') {
        return res.status(400).json({ error: 'Registration request already pending admin approval.' });
      }
      return res.status(400).json({ error: `Account status is ${existingUser.status}. Contact support.` });
    }

    // Generate Speakeasy Secret
    const secret = speakeasy.generateSecret({
      name: `Vexel AI (${email})`
    });

    // Generate QR Code Data URL
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      secret: secret.base32,
      qrCodeUrl
    });
  } catch (error) {
    console.error('Register-init error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. STEP 2: VERIFY AND SUBMIT REGISTRATION (Verify Code & Create PENDING User)
router.post('/register-verify', async (req, res) => {
  const { email, secret, code } = req.body;
  if (!email || !secret || !code) {
    return res.status(400).json({ error: 'Missing registration verification parameters' });
  }

  try {
    // Verify TOTP Code
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: code,
      window: 1
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid Google Authenticator verification code' });
    }

    // Create user in PENDING state
    const user = await prisma.user.create({
      data: {
        email,
        role: 'USER',
        status: 'PENDING',
        totpSecret: secret,
        totpEnabled: true
      }
    });

    // Create wallet for user
    await prisma.wallet.create({
      data: {
        userId: user.id,
        credits: 0
      }
    });

    // Create default offer progress
    await prisma.offerProgress.create({
      data: {
        userId: user.id,
        currentRound: 1,
        purchasesInCurrentRound: 0,
        isSpecialRewardUnlocked: false
      }
    });

    await createAuditLog(user.id, 'REGISTER', 'User registered with TOTP 2FA, pending admin approval', req.ip);

    res.json({
      message: 'Registration request submitted successfully. Please wait for admin approval.',
      userId: user.id
    });
  } catch (error) {
    console.error('Register-verify error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. LOGIN USER & ADMIN (Using TOTP Code)
router.post('/login', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and 6-digit Authenticator code are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Check Status
    if (user.status === 'PENDING') {
      return res.status(403).json({ error: 'Your account is pending admin approval.' });
    }
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Your account is suspended. Contact support.' });
    }
    if (user.status === 'DISABLED') {
      return res.status(403).json({ error: 'Your account has been disabled.' });
    }

    // Verify TOTP Code
    if (!user.totpSecret) {
      return res.status(400).json({ error: 'Authenticator is not configured for this account. Please register first.' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token: code,
      window: 2 // 60 seconds tolerance for client clock drifts
    });

    if (!verified) {
      await createAuditLog(user.id, 'LOGIN_FAILED', 'Invalid Authenticator code entered', req.ip);
      return res.status(401).json({ error: 'Invalid Google Authenticator code' });
    }

    // Create session JWT token
    const sessionToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    await createAuditLog(user.id, 'LOGIN_SUCCESS', `Successful TOTP login as ${user.role}`, req.ip);

    res.json({
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
