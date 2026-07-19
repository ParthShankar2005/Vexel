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

// 1. REGISTER USER
router.post('/register', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Check if user already exists
    let user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      if (user.status === 'ACTIVE' && user.totpEnabled) {
        return res.status(400).json({ error: 'User already registered. Please login.' });
      }
      if (user.status === 'PENDING') {
        return res.status(400).json({ error: 'Registration request already pending admin approval.' });
      }
      // If user was rejected/suspended, let admin deal with it or allow recreation if disabled
      return res.status(400).json({ error: `Account status is ${user.status}. Contact support.` });
    }

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({ name: `Vexel AI (${email})` });
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Create user in PENDING state
    user = await prisma.user.create({
      data: {
        email,
        role: 'USER',
        status: 'PENDING',
        totpSecret: secret.base32,
        totpEnabled: false // Will be enabled when verified
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

    await createAuditLog(user.id, 'REGISTER', 'User registered, pending approval', req.ip);

    res.json({
      message: 'Registration submitted. Scan QR code and wait for admin approval.',
      qrCode: qrCodeUrl,
      userId: user.id
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. LOGIN USER & ADMIN
router.post('/login', async (req, res) => {
  const { email, token } = req.body;
  if (!email || !token) {
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

    // Handle Admin setup if TOTP not enabled yet
    if (user.role === 'ADMIN' && !user.totpEnabled) {
      // Check if TOTP secret exists. If not, generate it.
      let secretBase32 = user.totpSecret;
      if (!secretBase32) {
        const secret = speakeasy.generateSecret({ name: `Vexel AI Admin (${email})` });
        secretBase32 = secret.base32;
        await prisma.user.update({
          where: { email },
          data: { totpSecret: secretBase32 }
        });
      }

      const secret = speakeasy.generateSecret({ name: `Vexel AI Admin (${email})` });
      // We will re-generate OTP URL with the existing/saved secret
      const otpauthUrl = `otpauth://totp/Vexel%20AI%20Admin%20(${email})?secret=${secretBase32}&issuer=Vexel%20AI`;
      const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

      return res.json({
        requiresSetup: true,
        qrCode: qrCodeUrl,
        message: 'Admin TOTP setup required. Scan QR code and verify code.'
      });
    }

    // Standard TOTP Verification
    if (!user.totpSecret) {
      return res.status(400).json({ error: 'Authenticator not initialized for this account' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token,
      window: 1 // 30-second clock drift allowance
    });

    if (!verified) {
      await createAuditLog(user.id, 'LOGIN_FAILED', 'Invalid TOTP code attempted', req.ip);
      return res.status(401).json({ error: 'Invalid authenticator code' });
    }

    // Update totpEnabled if logging in successfully for the first time
    if (!user.totpEnabled) {
      await prisma.user.update({
        where: { id: user.id },
        data: { totpEnabled: true }
      });
    }

    // Create session JWT token
    const sessionToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    await createAuditLog(user.id, 'LOGIN_SUCCESS', `Successful login as ${user.role}`, req.ip);

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

// 3. ADMIN FIRST-TIME TOTP SETUP VERIFICATION
router.post('/admin/setup', async (req, res) => {
  const { email, token } = req.body;
  if (!email || !token) {
    return res.status(400).json({ error: 'Email and verification code are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Unauthorized configuration attempt' });
    }
    if (user.totpEnabled) {
      return res.status(400).json({ error: 'Admin TOTP is already configured and enabled' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified) {
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    // Complete Setup
    await prisma.user.update({
      where: { id: user.id },
      data: { totpEnabled: true }
    });

    // Create token
    const sessionToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    await createAuditLog(user.id, 'ADMIN_SETUP_SUCCESS', 'Admin TOTP setup completed', req.ip);

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
    console.error('Admin setup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
