const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { getOfferState } = require('../utils/offerEngine');

const prisma = new PrismaClient();

// 1. GET ACTIVE OFFER STATE (Timer, discount, schedule details)
router.get('/state', authenticateToken, async (req, res) => {
  try {
    const offerState = await getOfferState(req.user.userId);
    res.json(offerState);
  } catch (error) {
    console.error('Fetch offer state error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. GET USER OFFER PROGRESS
router.get('/progress', authenticateToken, async (req, res) => {
  try {
    let progress = await prisma.offerProgress.findUnique({
      where: { userId: req.user.userId }
    });

    if (!progress) {
      progress = await prisma.offerProgress.create({
        data: {
          userId: req.user.userId,
          currentRound: 1,
          purchasesInCurrentRound: 0,
          isSpecialRewardUnlocked: false
        }
      });
    }

    // Determine what next discount is
    let nextDiscount = 50; // base discount default
    const state = await getOfferState(req.user.userId);
    if (state.settings) {
      if (progress.isSpecialRewardUnlocked) {
        nextDiscount = progress.currentRound === 5 
          ? state.settings.reward85Discount 
          : state.settings.reward80Discount;
      } else {
        nextDiscount = state.settings.baseDiscountMin;
      }
    }

    res.json({
      ...progress,
      nextDiscountPercent: nextDiscount,
      purchasesRequired: state.settings ? state.settings.purchasesRequired : 10,
      totalRounds: state.settings ? state.settings.roundsBefore85 : 5
    });
  } catch (error) {
    console.error('Fetch offer progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. GET SYSTEM OFFER SETTINGS (Admin Only)
router.get('/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = await prisma.offerSetting.findUnique({
      where: { id: 'singleton' }
    });
    res.json(settings);
  } catch (error) {
    console.error('Fetch offer settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. UPDATE SYSTEM OFFER SETTINGS (Admin Only)
router.post('/settings', authenticateToken, requireAdmin, async (req, res) => {
  const {
    baseDiscountMin,
    baseDiscountMax,
    reward80Discount,
    reward85Discount,
    purchasesRequired,
    roundsBefore85,
    offerIntervalDays,
    offerDurationHours,
    isEngineEnabled
  } = req.body;

  try {
    const updated = await prisma.offerSetting.upsert({
      where: { id: 'singleton' },
      update: {
        baseDiscountMin: baseDiscountMin !== undefined ? parseFloat(baseDiscountMin) : undefined,
        baseDiscountMax: baseDiscountMax !== undefined ? parseFloat(baseDiscountMax) : undefined,
        reward80Discount: reward80Discount !== undefined ? parseFloat(reward80Discount) : undefined,
        reward85Discount: reward85Discount !== undefined ? parseFloat(reward85Discount) : undefined,
        purchasesRequired: purchasesRequired !== undefined ? parseInt(purchasesRequired) : undefined,
        roundsBefore85: roundsBefore85 !== undefined ? parseInt(roundsBefore85) : undefined,
        offerIntervalDays: offerIntervalDays !== undefined ? parseInt(offerIntervalDays) : undefined,
        offerDurationHours: offerDurationHours !== undefined ? parseInt(offerDurationHours) : undefined,
        isEngineEnabled: isEngineEnabled !== undefined ? Boolean(isEngineEnabled) : undefined
      },
      create: {
        id: 'singleton',
        baseDiscountMin: baseDiscountMin !== undefined ? parseFloat(baseDiscountMin) : 50.0,
        baseDiscountMax: baseDiscountMax !== undefined ? parseFloat(baseDiscountMax) : 60.0,
        reward80Discount: reward80Discount !== undefined ? parseFloat(reward80Discount) : 80.0,
        reward85Discount: reward85Discount !== undefined ? parseFloat(reward85Discount) : 85.0,
        purchasesRequired: purchasesRequired !== undefined ? parseInt(purchasesRequired) : 10,
        roundsBefore85: roundsBefore85 !== undefined ? parseInt(roundsBefore85) : 5,
        offerIntervalDays: offerIntervalDays !== undefined ? parseInt(offerIntervalDays) : 3,
        offerDurationHours: offerDurationHours !== undefined ? parseInt(offerDurationHours) : 24,
        isEngineEnabled: isEngineEnabled !== undefined ? Boolean(isEngineEnabled) : true
      }
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'UPDATE_OFFER_SETTINGS',
        details: 'Updated global offer engine configurations',
        ipAddress: req.ip
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update offer settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
