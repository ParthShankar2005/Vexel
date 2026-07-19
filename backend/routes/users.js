const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const prisma = new PrismaClient();

// Helper to create audit log
async function createAuditLog(userId, action, details, ip) {
  try {
    await prisma.auditLog.create({
      data: { userId, action, details, ipAddress: ip }
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

// 1. GET USER PROFILE (Wallet & Offer Progress)
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        wallet: true,
        offerProgress: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      wallet: user.wallet,
      offerProgress: user.offerProgress
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. GET ALL USERS (Admin Only)
router.get('/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        wallet: true,
        offerProgress: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. GET PENDING USERS (Admin Only)
router.get('/pending', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    console.error('Fetch pending users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. USER ACTION: APPROVE / SUSPEND / DISABLE / DELETE (Admin Only)
router.post('/action', authenticateToken, requireAdmin, async (req, res) => {
  const { targetUserId, action } = req.body; // action: 'APPROVE', 'SUSPEND', 'DISABLE', 'DELETE'
  if (!targetUserId || !action) {
    return res.status(400).json({ error: 'Target userId and action are required' });
  }

  try {
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    if (targetUser.role === 'ADMIN' && action !== 'SUSPEND') {
      return res.status(403).json({ error: 'Cannot modify other admin accounts' });
    }

    if (action === 'DELETE') {
      await prisma.user.delete({ where: { id: targetUserId } });
      await createAuditLog(req.user.userId, 'USER_DELETED', `Deleted user account: ${targetUser.email}`, req.ip);
      return res.json({ message: 'User deleted successfully' });
    }

    let nextStatus;
    if (action === 'APPROVE') nextStatus = 'ACTIVE';
    else if (action === 'SUSPEND') nextStatus = 'SUSPENDED';
    else if (action === 'DISABLE') nextStatus = 'DISABLED';
    else return res.status(400).json({ error: 'Invalid action type' });

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { status: nextStatus },
      include: { wallet: true }
    });

    await createAuditLog(
      req.user.userId,
      `USER_${action}`,
      `Changed status of ${targetUser.email} to ${nextStatus}`,
      req.ip
    );

    res.json({
      message: `User status changed to ${nextStatus}`,
      user: updatedUser
    });
  } catch (error) {
    console.error('User action error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. MANAGE CREDITS: ADD / REMOVE (Admin Only)
router.post('/credits', authenticateToken, requireAdmin, async (req, res) => {
  const { targetUserId, credits, action } = req.body; // credits: integer, action: 'ADD', 'REMOVE'
  
  if (!targetUserId || !credits || !action) {
    return res.status(400).json({ error: 'targetUserId, credits amount, and action are required' });
  }

  const creditsNum = parseInt(credits);
  if (isNaN(creditsNum) || creditsNum <= 0) {
    return res.status(400).json({ error: 'Credits must be a valid positive integer' });
  }

  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId: targetUserId } });
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found for this user' });
    }

    let finalCredits = wallet.credits;
    let transType = 'REFUND'; // default type for manual add
    if (action === 'ADD') {
      finalCredits += creditsNum;
    } else if (action === 'REMOVE') {
      if (wallet.credits < creditsNum) {
        return res.status(400).json({ error: 'Insufficient credits in target wallet' });
      }
      finalCredits -= creditsNum;
      transType = 'USAGE';
    } else {
      return res.status(400).json({ error: 'Invalid action: must be ADD or REMOVE' });
    }

    // Update wallet and record transaction
    await prisma.$transaction([
      prisma.wallet.update({
        where: { userId: targetUserId },
        data: { credits: finalCredits }
      }),
      prisma.transaction.create({
        data: {
          walletId: targetUserId, // maps to user.id via schema design
          credits: action === 'ADD' ? creditsNum : -creditsNum,
          amount: 0.0,
          type: transType,
          status: 'COMPLETED',
          referenceId: `ADMIN_ADJUSTMENT_${req.user.userId}`
        }
      })
    ]);

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    await createAuditLog(
      req.user.userId,
      `CREDITS_${action}`,
      `Manually adjusted ${targetUser.email}'s credits by ${action === 'ADD' ? '+' : '-'}${creditsNum}. New balance: ${finalCredits}`,
      req.ip
    );

    res.json({
      message: `Successfully adjusted credits. New balance: ${finalCredits}`,
      credits: finalCredits
    });
  } catch (error) {
    console.error('Credits update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. GET AUDIT LOGS (Admin Only)
router.get('/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: {
        user: {
          select: { email: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    res.json(logs);
  } catch (error) {
    console.error('Fetch logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
