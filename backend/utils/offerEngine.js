const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Static anchor date for cycles (10:00 AM IST)
// IST is UTC+5:30
const ANCHOR_DATE_IST = new Date('2026-07-01T10:00:00+05:30');

/**
 * Calculates the state of the offer engine
 * @returns {Promise<{isActive: boolean, currentDiscount: number | null, nextStart: Date, timeRemaining: number, settings: any}>}
 */
async function getOfferState(userId = null) {
  const settings = await prisma.offerSetting.findUnique({
    where: { id: 'singleton' },
  });

  if (!settings || !settings.isEngineEnabled) {
    return {
      isActive: false,
      currentDiscount: null,
      nextStart: null,
      timeRemaining: 0,
      settings: settings || {}
    };
  }

  const intervalMs = settings.offerIntervalDays * 24 * 60 * 60 * 1000;
  const durationMs = settings.offerDurationHours * 60 * 60 * 1000;
  
  const now = Date.now();
  let anchorTime = null;

  if (userId) {
    const firstTx = await prisma.transaction.findFirst({
      where: { walletId: userId, status: 'COMPLETED', type: 'PURCHASE' },
      orderBy: { createdAt: 'asc' }
    });
    if (firstTx) {
      anchorTime = new Date(firstTx.createdAt).getTime();
    }
  }

  // If no purchase has occurred yet, they must buy their first plan at normal price.
  // The recurrent offer engine remains inactive until their first purchase triggers it.
  if (!anchorTime) {
    return {
      isActive: false,
      nextStart: null,
      timeRemaining: 0,
      settings
    };
  }

  const timeDiff = now - anchorTime;

  if (timeDiff < 0) {
    return {
      isActive: false,
      nextStart: new Date(anchorTime),
      timeRemaining: 0,
      settings
    };
  }

  const currentCycleProgress = timeDiff % intervalMs;
  const isActive = currentCycleProgress < durationMs;

  let timeRemaining = 0;
  let nextStart = null;

  if (isActive) {
    timeRemaining = durationMs - currentCycleProgress;
    // Next start is in the next cycle
    nextStart = new Date(now - currentCycleProgress + intervalMs);
  } else {
    timeRemaining = 0;
    nextStart = new Date(now + (intervalMs - currentCycleProgress));
  }

  return {
    isActive,
    nextStart,
    timeRemaining, // in milliseconds
    settings
  };
}

/**
 * Calculates active pricing for plans for a specific user
 * @param {string} userId 
 * @param {Array} plans 
 * @returns {Promise<Array>} plans with adjusted pricing
 */
async function getPlansForUser(userId, plans) {
  const offerState = await getOfferState();
  
  if (!offerState.isActive) {
    // No offer is active, return normal prices
    return plans.map(p => ({
      ...p,
      originalPrice: p.price,
      discountedPrice: p.price,
      discountPercent: 0,
      isOfferApplied: false
    }));
  }

  // Offer is active, fetch user's progress
  let progress = await prisma.offerProgress.findUnique({
    where: { userId }
  });

  if (!progress) {
    // Fallback if not created during registration
    progress = await prisma.offerProgress.create({
      data: {
        userId,
        currentRound: 1,
        purchasesInCurrentRound: 0,
        isSpecialRewardUnlocked: false
      }
    });
  }

  let discountPercent = 0;
  
  if (progress.isSpecialRewardUnlocked) {
    // Round 5 unlock is 85% discount, otherwise 80% discount
    discountPercent = progress.currentRound === 5 
      ? offerState.settings.reward85Discount 
      : offerState.settings.reward80Discount;
  } else {
    // Base discount (e.g. 50% or 60%). Let's use the average or dynamic,
    // or let's use the baseDiscountMin (50%) or let's default to baseDiscountMin.
    // The prompt says "50-60% Offer". We can return the min value or range, 
    // let's apply the baseDiscountMin (50%) by default, or return a configurable rate.
    // Let's use baseDiscountMin (which defaults to 50%).
    discountPercent = offerState.settings.baseDiscountMin; 
  }

  return plans.map(p => {
    const discountedPrice = Math.round(p.price * (1 - discountPercent / 100));
    return {
      ...p,
      originalPrice: p.price,
      discountedPrice,
      discountPercent,
      isOfferApplied: true,
      offerProgress: {
        currentRound: progress.currentRound,
        purchasesInCurrentRound: progress.purchasesInCurrentRound,
        isSpecialRewardUnlocked: progress.isSpecialRewardUnlocked
      }
    };
  });
}

module.exports = {
  getOfferState,
  getPlansForUser
};
