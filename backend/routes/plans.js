const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { getPlansForUser } = require('../utils/offerEngine');

const prisma = new PrismaClient();

// 1. GET PLANS FOR USER (With Dynamic Discounts)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' }
    });

    const userPlans = await getPlansForUser(req.user.userId, plans);
    res.json(userPlans);
  } catch (error) {
    console.error('Fetch plans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. GET ALL PLANS RAW (Admin Only)
router.get('/admin', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { price: 'asc' }
    });
    res.json(plans);
  } catch (error) {
    console.error('Fetch admin plans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. CREATE PLAN (Admin Only)
router.post('/admin', authenticateToken, requireAdmin, async (req, res) => {
  const { name, price, credits } = req.body;
  if (!name || price === undefined || credits === undefined) {
    return res.status(400).json({ error: 'Name, price, and credits are required' });
  }

  const priceNum = parseFloat(price);
  const creditsNum = parseInt(credits);

  if (isNaN(priceNum) || priceNum <= 0 || isNaN(creditsNum) || creditsNum <= 0) {
    return res.status(400).json({ error: 'Price and credits must be positive numbers' });
  }

  try {
    const newPlan = await prisma.plan.create({
      data: {
        name,
        price: priceNum,
        credits: creditsNum,
        isActive: true
      }
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'CREATE_PLAN',
        details: `Created credit plan: ${name} (₹${priceNum} for ${creditsNum} credits)`,
        ipAddress: req.ip
      }
    });

    res.json(newPlan);
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. UPDATE PLAN (Admin Only)
router.put('/admin/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, price, credits, isActive } = req.body;

  try {
    const existing = await prisma.plan.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (price !== undefined) {
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum <= 0) {
        return res.status(400).json({ error: 'Price must be a positive number' });
      }
      data.price = priceNum;
    }
    if (credits !== undefined) {
      const creditsNum = parseInt(credits);
      if (isNaN(creditsNum) || creditsNum <= 0) {
        return res.status(400).json({ error: 'Credits must be a positive integer' });
      }
      data.credits = creditsNum;
    }
    if (isActive !== undefined) data.isActive = isActive;

    const updatedPlan = await prisma.plan.update({
      where: { id },
      data
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'UPDATE_PLAN',
        details: `Updated plan: ${existing.name} -> ID: ${id}`,
        ipAddress: req.ip
      }
    });

    res.json(updatedPlan);
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. DELETE PLAN (Admin Only)
router.delete('/admin/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await prisma.plan.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    await prisma.plan.delete({ where: { id } });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'DELETE_PLAN',
        details: `Deleted credit plan: ${existing.name} (ID: ${id})`,
        ipAddress: req.ip
      }
    });

    res.json({ message: 'Plan deleted successfully' });
  } catch (error) {
    console.error('Delete plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
