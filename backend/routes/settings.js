const express = require('express');
const router = express.Router();
const checkDiskSpace = require('check-disk-space').default;
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const prisma = new PrismaClient();

// 1. GET SYSTEM SETTINGS (Admin Only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = await prisma.systemSetting.findUnique({
      where: { id: 'singleton' }
    });
    res.json(settings);
  } catch (error) {
    console.error('Fetch system settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. UPDATE SYSTEM SETTINGS (Admin Only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const {
    openaiApiKey,
    cloudflareAccountId,
    cloudflareApiToken,
    razorpayKeyId,
    razorpayKeySecret,
    imagesPerGeneration,
    creditsPerImage,
    maxUploadSizeMb,
    zipStoragePath,
    autoCleanupDays,
    backupSchedule,
    maintenanceMode
  } = req.body;

  try {
    const updated = await prisma.systemSetting.upsert({
      where: { id: 'singleton' },
      update: {
        openaiApiKey: openaiApiKey !== undefined ? openaiApiKey : undefined,
        cloudflareAccountId: cloudflareAccountId !== undefined ? cloudflareAccountId : undefined,
        cloudflareApiToken: cloudflareApiToken !== undefined ? cloudflareApiToken : undefined,
        razorpayKeyId: razorpayKeyId !== undefined ? razorpayKeyId : undefined,
        razorpayKeySecret: razorpayKeySecret !== undefined ? razorpayKeySecret : undefined,
        imagesPerGeneration: imagesPerGeneration !== undefined ? parseInt(imagesPerGeneration) : undefined,
        creditsPerImage: creditsPerImage !== undefined ? parseInt(creditsPerImage) : undefined,
        maxUploadSizeMb: maxUploadSizeMb !== undefined ? parseInt(maxUploadSizeMb) : undefined,
        zipStoragePath: zipStoragePath !== undefined ? zipStoragePath : undefined,
        autoCleanupDays: autoCleanupDays !== undefined ? parseInt(autoCleanupDays) : undefined,
        backupSchedule: backupSchedule !== undefined ? backupSchedule : undefined,
        maintenanceMode: maintenanceMode !== undefined ? Boolean(maintenanceMode) : undefined
      },
      create: {
        id: 'singleton',
        openaiApiKey: openaiApiKey || '',
        cloudflareAccountId: cloudflareAccountId || '',
        cloudflareApiToken: cloudflareApiToken || '',
        razorpayKeyId: razorpayKeyId || '',
        razorpayKeySecret: razorpayKeySecret || '',
        imagesPerGeneration: imagesPerGeneration !== undefined ? parseInt(imagesPerGeneration) : 4,
        creditsPerImage: creditsPerImage !== undefined ? parseInt(creditsPerImage) : 2,
        maxUploadSizeMb: maxUploadSizeMb !== undefined ? parseInt(maxUploadSizeMb) : 5,
        zipStoragePath: zipStoragePath || 'D:\\VEXEL ZIPs',
        autoCleanupDays: autoCleanupDays !== undefined ? parseInt(autoCleanupDays) : 30,
        backupSchedule: backupSchedule || '0 0 * * *',
        maintenanceMode: maintenanceMode !== undefined ? Boolean(maintenanceMode) : false
      }
    });

    // Write to local .env if we want to hot-reload variables, or just rely on database
    // Hot-reloaded database settings is cleaner since we read from DB in API routes!

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'UPDATE_SYSTEM_SETTINGS',
        details: 'Updated global system settings and API credentials',
        ipAddress: req.ip
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update system settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. CHECK DISK SPACE FOR PATHS (Welcome Setup / Admin checks)
router.post('/disk-space', async (req, res) => {
  const { softwarePath, zipPath } = req.body;
  // softwarePath: default C: (or current directory)
  // zipPath: default D:\VEXEL ZIPs (or chosen path)

  const resolvedSoftwarePath = softwarePath || process.cwd();
  const resolvedZipPath = zipPath || 'D:\\VEXEL ZIPs';

  try {
    // Check software drive space
    const softwareDrive = path.parse(resolvedSoftwarePath).root;
    const softwareSpace = await checkDiskSpace(softwareDrive);

    // Check zip drive space
    let zipSpace = null;
    let zipError = null;

    try {
      // Check if directory exists, if not check the drive root
      let targetZipPath = resolvedZipPath;
      if (!fs.existsSync(targetZipPath)) {
        targetZipPath = path.parse(resolvedZipPath).root;
      }
      zipSpace = await checkDiskSpace(targetZipPath);
    } catch (err) {
      zipError = err.message;
    }

    res.json({
      software: {
        path: resolvedSoftwarePath,
        drive: softwareDrive,
        freeBytes: softwareSpace.free,
        totalBytes: softwareSpace.size,
        freeGb: (softwareSpace.free / (1024 * 1024 * 1024)).toFixed(2),
        totalGb: (softwareSpace.size / (1024 * 1024 * 1024)).toFixed(2),
        isSufficient: softwareSpace.free >= 10 * 1024 * 1024 * 1024 // 10 GB
      },
      zip: zipSpace ? {
        path: resolvedZipPath,
        drive: path.parse(resolvedZipPath).root,
        freeBytes: zipSpace.free,
        totalBytes: zipSpace.size,
        freeGb: (zipSpace.free / (1024 * 1024 * 1024)).toFixed(2),
        totalGb: (zipSpace.size / (1024 * 1024 * 1024)).toFixed(2),
        isSufficient: zipSpace.free >= 5 * 1024 * 1024 * 1024 // 5 GB
      } : {
        path: resolvedZipPath,
        error: zipError || 'Drive not found or accessible',
        isSufficient: false
      }
    });
  } catch (error) {
    console.error('Disk check error:', error);
    res.status(500).json({ error: 'Failed to verify storage volumes: ' + error.message });
  }
});

module.exports = router;
