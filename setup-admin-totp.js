const { PrismaClient } = require('@prisma/client');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@vexel.ai';
  console.log(`Generating Google Authenticator setup for ${email}...`);

  // Generate secret
  const secret = speakeasy.generateSecret({
    name: `Vexel AI Admin (${email})`
  });

  // Save to database
  await prisma.user.update({
    where: { email },
    data: {
      totpSecret: secret.base32,
      totpEnabled: true
    }
  });

  // Generate QR Code image file
  const qrPath = path.join(__dirname, 'admin-qr.png');
  await QRCode.toFile(qrPath, secret.otpauth_url);

  console.log('\n====================================================');
  console.log(`SUCCESS: Updated ${email} in your live Supabase database.`);
  console.log(`Secret Key: ${secret.base32}`);
  console.log(`QR Code Image saved to: ${qrPath}`);
  console.log('====================================================');
  console.log('1. Open "admin-qr.png" inside your Vexel project folder.');
  console.log('2. Scan it using Google Authenticator on your mobile phone.');
  console.log('3. Once scanned, DELETE the "admin-qr.png" file for security.');
  console.log('====================================================\n');
  
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
