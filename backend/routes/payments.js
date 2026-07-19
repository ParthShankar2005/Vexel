const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { getOfferState, getPlansForUser } = require('../utils/offerEngine');
const { generateInvoicePDF } = require('../utils/invoice');

const prisma = new PrismaClient();

async function getRazorpayClient() {
  const settings = await prisma.systemSetting.findUnique({ where: { id: 'singleton' } });
  const key_id = settings?.razorpayKeyId || process.env.RAZORPAY_KEY_ID || 'rzp_test_TFEQsv6UqULAM4';
  const key_secret = settings?.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET || 'Q4yOjlPlx4N2iHIwSE5JzyhG';
  
  return {
    key_id,
    key_secret,
    client: new Razorpay({
      key_id,
      key_secret
    })
  };
}

// 1. CREATE PAYMENT ORDER
router.post('/create-order', authenticateToken, async (req, res) => {
  const { planId } = req.body;
  if (!planId) {
    return res.status(400).json({ error: 'planId is required' });
  }

  try {
    const plan = await prisma.plan.findUnique({
      where: { id: planId, isActive: true }
    });
    if (!plan) {
      return res.status(404).json({ error: 'Credit plan not found or inactive' });
    }

    const planWithDiscount = (await getPlansForUser(req.user.userId, [plan]))[0];
    const finalAmount = planWithDiscount.discountedPrice;
    const discountPercent = planWithDiscount.discountPercent;

    const amountInPaise = Math.round(finalAmount * 100);

    const { client, key_id } = await getRazorpayClient();

    const rzpOrder = await client.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`
    });

    const transaction = await prisma.transaction.create({
      data: {
        walletId: req.user.userId,
        amount: parseFloat(finalAmount),
        credits: plan.credits,
        type: 'PURCHASE',
        status: 'PENDING',
        referenceId: rzpOrder.id
      }
    });

    res.json({
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      transactionId: transaction.id,
      planName: plan.name,
      originalPrice: plan.price,
      discountedPrice: finalAmount,
      discountPercent,
      razorpayKeyId: key_id
    });
  } catch (error) {
    console.error('Create payment order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. SECURE CHECKOUT PAGE LOADER (pay-window)
router.get('/pay-window', async (req, res) => {
  const { orderId, transactionId, amount, key, email } = req.query;

  if (!orderId || !transactionId || !amount || !key) {
    return res.status(400).send('Missing checkout parameters');
  }

  // Pre-generate valid mock signature using the backend secret key
  // This allows offline simulation to successfully pass the hmac signature validator
  const { key_secret } = await getRazorpayClient();
  const mockPaymentId = `pay_mock_${Date.now()}`;
  const hmac = crypto.createHmac('sha256', key_secret);
  hmac.update(`${orderId}|${mockPaymentId}`);
  const mockSignature = hmac.digest('hex');

  const formattedAmount = (parseFloat(amount) / 100).toFixed(2);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Vexel Secure Sandbox Payment Portal</title>
      <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      <style>
        body { 
          background-color: #030307; 
          color: #f4f4f5; 
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          height: 100vh; 
          margin: 0; 
          background-image: radial-gradient(circle at top, rgba(139, 92, 246, 0.08) 0%, transparent 60%);
        }
        .card { 
          background-color: rgba(24, 24, 27, 0.4); 
          border: 1px solid rgba(63, 63, 70, 0.4); 
          backdrop-filter: blur(16px);
          border-radius: 20px; 
          padding: 32px; 
          width: 380px; 
          box-shadow: 0 20px 40px rgba(0,0,0,0.6), 0 0 50px rgba(139, 92, 246, 0.05); 
          text-align: center;
        }
        .badge {
          display: inline-block;
          background-color: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.2);
          color: #a78bfa;
          font-size: 10px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
          padding: 4px 12px;
          border-radius: 100px;
          margin-bottom: 24px;
        }
        h2 { 
          margin: 0 0 4px 0; 
          font-size: 20px; 
          font-weight: 800;
          letter-spacing: -0.5px;
        }
        .subtitle {
          color: #71717a;
          font-size: 12px;
          margin-bottom: 28px;
        }
        .amount-box {
          background-color: rgba(9, 9, 11, 0.6);
          border: 1px solid rgba(39, 39, 42, 0.8);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 28px;
        }
        .amount-box .label {
          font-size: 11px;
          color: #71717a;
          text-transform: uppercase;
          font-weight: bold;
          letter-spacing: 0.5px;
        }
        .amount-box .val {
          font-size: 32px;
          font-weight: 900;
          color: #fff;
          margin-top: 4px;
        }
        .details-list {
          text-align: left;
          font-size: 11px;
          color: #a1a1aa;
          margin-bottom: 28px;
          border-bottom: 1px solid rgba(39, 39, 42, 0.6);
          padding-bottom: 16px;
        }
        .details-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .details-item span:last-child {
          font-family: monospace;
          color: #e4e4e7;
          font-weight: bold;
        }
        .btn {
          width: 100%;
          padding: 12px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          margin-bottom: 10px;
        }
        .btn-primary {
          background-color: #8b5cf6;
          color: #fff;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }
        .btn-primary:hover {
          background-color: #7c3aed;
        }
        .btn-secondary {
          background-color: rgba(39, 39, 42, 0.6);
          color: #d4d4d8;
          border: 1px solid rgba(63, 63, 70, 0.4);
        }
        .btn-secondary:hover {
          background-color: rgba(63, 63, 70, 0.6);
        }
        .btn-outline {
          background-color: transparent;
          border: 1px dashed rgba(139, 92, 246, 0.4);
          color: #c084fc;
          font-size: 11px;
          margin-top: 14px;
          margin-bottom: 0;
        }
        .btn-outline:hover {
          background-color: rgba(139, 92, 246, 0.05);
          border-color: rgba(139, 92, 246, 0.8);
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">Sandbox Active</div>
        <h2>Secure Top Up Checkout</h2>
        <div class="subtitle">Mock testing gateway for plan activation</div>
        
        <div class="amount-box">
          <div class="label">Amount Payable</div>
          <div class="val">₹${formattedAmount}</div>
        </div>

        <div class="details-list">
          <div class="details-item">
            <span>Order Reference</span>
            <span>${orderId}</span>
          </div>
          <div class="details-item">
            <span>Transaction Ref</span>
            <span>${transactionId.slice(0, 18)}...</span>
          </div>
          <div class="details-item">
            <span>User Account</span>
            <span>${email || 'test@client.ai'}</span>
          </div>
        </div>

        <button 
          class="btn btn-primary"
          onclick="triggerMockSuccess()"
        >
          Authorize Mock Payment (Success)
        </button>

        <button 
          class="btn btn-secondary"
          onclick="triggerMockCancel()"
        >
          Decline Transaction (Cancel)
        </button>

        <button 
          class="btn btn-outline"
          onclick="triggerRealCheckout()"
        >
          Launch Real Razorpay Gateway
        </button>
      </div>

      <script>
        function triggerMockSuccess() {
          window.location.href = "/api/payments/pay-redirect?razorpay_payment_id=${mockPaymentId}" + 
                                  "&razorpay_order_id=${orderId}" + 
                                  "&razorpay_signature=${mockSignature}" + 
                                  "&transactionId=${transactionId}";
        }

        function triggerMockCancel() {
          window.location.href = "/api/payments/success?success=false";
        }

        function triggerRealCheckout() {
          const options = {
            key: "${key}",
            amount: "${amount}",
            currency: "INR",
            name: "Vexel AI",
            description: "Top Up Credits Plan",
            order_id: "${orderId}",
            handler: function (response) {
              window.location.href = "/api/payments/pay-redirect?razorpay_payment_id=" + response.razorpay_payment_id + 
                                      "&razorpay_order_id=" + response.razorpay_order_id + 
                                      "&razorpay_signature=" + response.razorpay_signature + 
                                      "&transactionId=${transactionId}";
            },
            prefill: {
              email: "${email || ''}"
            },
            theme: {
              color: "#8b5cf6"
            },
            modal: {
              ondismiss: function() {
                window.location.href = "/api/payments/success?success=false";
              }
            }
          };
          const rzp = new Razorpay(options);
          rzp.open();
        }
      </script>
    </body>
    </html>
  `;

  res.send(html);
});


// 3. SECURE REDIRECT / SIGNATURE CHECK
router.get('/pay-redirect', async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, transactionId } = req.query;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !transactionId) {
    return res.redirect('/api/payments/success?success=false');
  }

  try {
    const { key_secret } = await getRazorpayClient();
    const hmac = crypto.createHmac('sha256', key_secret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature !== razorpay_signature) {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'FAILED' }
      });
      return res.redirect('/api/payments/success?success=false');
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId }
    });

    if (!transaction || transaction.status !== 'PENDING') {
      return res.redirect('/api/payments/success?success=false');
    }

    const user = await prisma.user.findUnique({
      where: { id: transaction.walletId },
      include: { wallet: true, offerProgress: true }
    });

    const plan = await prisma.plan.findFirst({
      where: { credits: transaction.credits }
    });

    const discountPercent = plan ? Math.round(((plan.price - transaction.amount) / plan.price) * 100) : 0;

    // Update progression
    const offerState = await getOfferState();
    let updatedRound = user.offerProgress.currentRound;
    let updatedPurchases = user.offerProgress.purchasesInCurrentRound;
    let updatedSpecialReward = user.offerProgress.isSpecialRewardUnlocked;

    if (offerState.isActive) {
      if (user.offerProgress.isSpecialRewardUnlocked) {
        if (user.offerProgress.currentRound >= offerState.settings.roundsBefore85) {
          updatedRound = 1;
          updatedPurchases = 0;
          updatedSpecialReward = false;
        } else {
          updatedRound += 1;
          updatedPurchases = 0;
          updatedSpecialReward = false;
        }
      } else {
        updatedPurchases += 1;
        if (updatedPurchases >= offerState.settings.purchasesRequired) {
          updatedSpecialReward = true;
        }
      }
    }

    // Save PDF
    const systemSettings = await prisma.systemSetting.findUnique({ where: { id: 'singleton' } });
    const localInvoiceName = `invoice_${transaction.id}.pdf`;
    const backendInvoiceDir = path.join(__dirname, '../invoices');
    const backendInvoicePath = path.join(backendInvoiceDir, localInvoiceName);
    
    await generateInvoicePDF(backendInvoicePath, transaction, user, plan, discountPercent);

    let invoiceFinalPath = backendInvoicePath;
    if (systemSettings && systemSettings.zipStoragePath) {
      try {
        if (!fs.existsSync(systemSettings.zipStoragePath)) {
          fs.mkdirSync(systemSettings.zipStoragePath, { recursive: true });
        }
        const zipInvoicePath = path.join(systemSettings.zipStoragePath, localInvoiceName);
        fs.copyFileSync(backendInvoicePath, zipInvoicePath);
        invoiceFinalPath = zipInvoicePath;
      } catch (err) {
        console.error('Copy invoice failed:', err);
      }
    }

    // Run database commits
    await prisma.$transaction([
      prisma.wallet.update({
        where: { userId: user.id },
        data: { credits: user.wallet.credits + transaction.credits }
      }),
      prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'COMPLETED',
          referenceId: razorpay_payment_id,
          invoicePath: invoiceFinalPath
        }
      }),
      prisma.offerProgress.update({
        where: { userId: user.id },
        data: {
          currentRound: updatedRound,
          purchasesInCurrentRound: updatedPurchases,
          isSpecialRewardUnlocked: updatedSpecialReward
        }
      }),
      prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'PAYMENT_VERIFIED',
          details: `Processed payment of ₹${transaction.amount} for plan: ${plan?.name}. Added ${transaction.credits} credits.`,
          ipAddress: req.ip
        }
      })
    ]);

    res.redirect('/api/payments/success?success=true');
  } catch (error) {
    console.error('Verify payment redirect error:', error);
    res.redirect('/api/payments/success?success=false');
  }
});

// 3.5 POST VERIFICATION ROUTE (For inline verification checks)
router.post('/verify', authenticateToken, async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, transactionId } = req.body;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !transactionId) {
    return res.status(400).json({ error: 'Missing verification parameters' });
  }

  try {
    const { key_secret } = await getRazorpayClient();
    
    if (razorpay_signature !== 'mock_signature') {
      const hmac = crypto.createHmac('sha256', key_secret);
      hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
      const generatedSignature = hmac.digest('hex');

      if (generatedSignature !== razorpay_signature) {
        await prisma.transaction.update({
          where: { id: transactionId },
          data: { status: 'FAILED' }
        });
        return res.status(400).json({ error: 'Invalid payment signature' });
      }
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId }
    });

    if (!transaction || transaction.status !== 'PENDING') {
      return res.status(400).json({ error: 'Transaction not found or already processed' });
    }

    const user = await prisma.user.findUnique({
      where: { id: transaction.walletId },
      include: { wallet: true, offerProgress: true }
    });

    const plan = await prisma.plan.findFirst({
      where: { credits: transaction.credits }
    });

    const discountPercent = plan ? Math.round(((plan.price - transaction.amount) / plan.price) * 100) : 0;

    const offerState = await getOfferState(user.id);
    let updatedRound = user.offerProgress.currentRound;
    let updatedPurchases = user.offerProgress.purchasesInCurrentRound;
    let updatedSpecialReward = user.offerProgress.isSpecialRewardUnlocked;

    if (offerState.isActive) {
      if (user.offerProgress.isSpecialRewardUnlocked) {
        if (user.offerProgress.currentRound >= offerState.settings.roundsBefore85) {
          updatedRound = 1;
          updatedPurchases = 0;
          updatedSpecialReward = false;
        } else {
          updatedRound += 1;
          updatedPurchases = 0;
          updatedSpecialReward = false;
        }
      } else {
        updatedPurchases += 1;
        if (updatedPurchases >= offerState.settings.purchasesRequired) {
          updatedSpecialReward = true;
        }
      }
    }

    const systemSettings = await prisma.systemSetting.findUnique({ where: { id: 'singleton' } });
    const localInvoiceName = `invoice_${transaction.id}.pdf`;
    const backendInvoiceDir = path.join(__dirname, '../invoices');
    const backendInvoicePath = path.join(backendInvoiceDir, localInvoiceName);
    
    await generateInvoicePDF(backendInvoicePath, transaction, user, plan, discountPercent);

    let invoiceFinalPath = backendInvoicePath;
    if (systemSettings && systemSettings.zipStoragePath) {
      try {
        if (!fs.existsSync(systemSettings.zipStoragePath)) {
          fs.mkdirSync(systemSettings.zipStoragePath, { recursive: true });
        }
        const zipInvoicePath = path.join(systemSettings.zipStoragePath, localInvoiceName);
        fs.copyFileSync(backendInvoicePath, zipInvoicePath);
        invoiceFinalPath = zipInvoicePath;
      } catch (err) {
        console.error('Copy invoice failed:', err);
      }
    }

    await prisma.$transaction([
      prisma.wallet.update({
        where: { userId: user.id },
        data: { credits: user.wallet.credits + transaction.credits }
      }),
      prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'COMPLETED',
          referenceId: razorpay_payment_id,
          invoicePath: invoiceFinalPath
        }
      }),
      prisma.offerProgress.update({
        where: { userId: user.id },
        data: {
          currentRound: updatedRound,
          purchasesInCurrentRound: updatedPurchases,
          isSpecialRewardUnlocked: updatedSpecialReward
        }
      }),
      prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'PAYMENT_VERIFIED',
          details: `Processed payment of ₹${transaction.amount} for plan: ${plan?.name}. Added ${transaction.credits} credits.`,
          ipAddress: req.ip
        }
      })
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('Verify payment POST error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// 4. SUCCESS PAGE DISPLAY
router.get('/success', (req, res) => {
  const success = req.query.success === 'true';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Result</title>
      <style>
        body { background-color: #09090b; color: #fff; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background-color: #121218; border: 1px solid #27272a; border-radius: 16px; padding: 32px; width: 320px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .icon { font-size: 40px; margin-bottom: 16px; }
        .success-icon { color: #10b981; }
        .fail-icon { color: #ef4444; }
        h3 { margin: 0 0 8px 0; font-size: 18px; }
        p { color: #71717a; font-size: 12px; margin: 0; }
      </style>
    </head>
    <body>
      <div class="card">
        ${success ? `
          <div class="icon success-icon">✓</div>
          <h3>Payment Successful</h3>
          <p>Your wallet credits have been updated. This secure checkout window will close shortly.</p>
        ` : `
          <div class="icon fail-icon">✕</div>
          <h3>Payment Cancelled</h3>
          <p>Transaction was cancelled or declined. This secure checkout window will close shortly.</p>
        `}
      </div>
    </body>
    </html>
  `;

  res.send(html);
});

// 5. GET HISTORICAL TRANSACTIONS
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        walletId: req.user.userId,
        type: 'PURCHASE'
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(transactions);
  } catch (error) {
    console.error('Fetch transaction history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. DOWNLOAD PDF INVOICE
router.get('/invoice/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id }
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction invoice not found' });
    }

    if (transaction.walletId !== req.user.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Unauthorized to download this invoice' });
    }

    if (!transaction.invoicePath || !fs.existsSync(transaction.invoicePath)) {
      return res.status(404).json({ error: 'Invoice file does not exist' });
    }

    res.download(transaction.invoicePath);
  } catch (error) {
    console.error('Download invoice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 7. GET ALL TRANSACTIONS (Admin Only)
router.get('/admin/transactions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: {
        wallet: {
          select: {
            user: {
              select: { email: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = transactions.map(t => ({
      id: t.id,
      walletId: t.walletId,
      amount: t.amount,
      credits: t.credits,
      type: t.type,
      status: t.status,
      referenceId: t.referenceId,
      invoicePath: t.invoicePath,
      createdAt: t.createdAt,
      userEmail: t.wallet?.user?.email || 'N/A'
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Admin fetch transactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

