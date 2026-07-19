const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from root or backend
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Seed System Settings
  const openiaKey = process.env.OPENAI_API_KEY || null;
  const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || null;
  const cfApiToken = process.env.CLOUDFLARE_API_TOKEN || null;

  const rzKeyId = process.env.RAZORPAY_KEY_ID || null;
  const rzKeySecret = process.env.RAZORPAY_KEY_SECRET || null;

  await prisma.systemSetting.upsert({
    where: { id: 'singleton' },
    update: {
      openaiApiKey: openiaKey,
      cloudflareAccountId: cfAccountId,
      cloudflareApiToken: cfApiToken,
      razorpayKeyId: rzKeyId,
      razorpayKeySecret: rzKeySecret,
    },
    create: {
      id: 'singleton',
      openaiApiKey: openiaKey,
      cloudflareAccountId: cfAccountId,
      cloudflareApiToken: cfApiToken,
      razorpayKeyId: rzKeyId,
      razorpayKeySecret: rzKeySecret,
      imagesPerGeneration: 4,
      creditsPerImage: 2,
      maxUploadSizeMb: 5,
      zipStoragePath: 'D:\\VEXEL ZIPs',
    },
  });
  console.log('System Settings seeded.');

  // 2. Seed Default Plans
  const plans = [
    { name: 'Starter Pack', price: 100, credits: 1000 },
    { name: 'Growth Pack', price: 250, credits: 3000 },
    { name: 'Pro Pack', price: 500, credits: 7000 },
    { name: 'Premium Pack', price: 1000, credits: 15000 },
    { name: 'Enterprise Pack', price: 2000, credits: 35000 },
  ];

  for (const plan of plans) {
    const existing = await prisma.plan.findFirst({
      where: { price: plan.price },
    });
    if (!existing) {
      await prisma.plan.create({
        data: {
          name: plan.name,
          price: plan.price,
          credits: plan.credits,
          isActive: true,
        },
      });
    }
  }
  console.log('Credit Plans seeded.');

  // 3. Seed Default Offer Setting
  await prisma.offerSetting.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      baseDiscountMin: 50.0,
      baseDiscountMax: 60.0,
      reward80Discount: 80.0,
      reward85Discount: 85.0,
      purchasesRequired: 10,
      roundsBefore85: 5,
      offerIntervalDays: 3,
      offerDurationHours: 24,
      isEngineEnabled: true,
    },
  });
  console.log('Offer Engine settings seeded.');

  // 4. Seed Admin Account
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@vexel.ai';
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      accessKey: 'admin123',
      totpEnabled: true
    },
    create: {
      email: adminEmail,
      role: 'ADMIN',
      status: 'ACTIVE',
      accessKey: 'admin123',
      totpEnabled: true,
    },
  });

  // Ensure admin has a wallet
  await prisma.wallet.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      credits: 99999, // default large credits for admin
    },
  });

  console.log(`Admin user seeded: ${adminEmail}`);
  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
