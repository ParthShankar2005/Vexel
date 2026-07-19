const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const sharp = require('sharp');
const archiver = require('archiver');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const prisma = new PrismaClient();

// Configure Multer for uploading product PNGs
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `product_${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only PNG images are supported. Transparent background preferred.'), false);
    }
  }
});

// Default high-quality e-commerce advertisement prompt
const DEFAULT_PROMPT = 'Luxury studio product advertisement background, premium studio tabletop surface, cinematic soft lighting, soft shadows, clean aesthetic environment, botanical leaf reflections, commercial photography, photorealistic, 8k resolution';

// Helper function to call Cloudflare AI with fallback models to handle 429 quota exhaustion
async function runCloudflareAiImage(cfAccountId, cfApiToken, prompt) {
  const models = [
    '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    '@cf/bytedance/stable-diffusion-xl-lightning',
    '@cf/lykon/dreamshaper-8-lcm'
  ];

  let lastError = null;

  for (const model of models) {
    try {
      console.log(`[Cloudflare AI] Attempting image generation with model: ${model}`);
      const response = await axios({
        method: 'POST',
        url: `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/${model}`,
        headers: {
          Authorization: `Bearer ${cfApiToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          prompt,
          height: 1024,
          width: 1024
        },
        responseType: 'arraybuffer',
        timeout: 45000 // 45 seconds timeout per model attempt
      });

      // Verify response body is not a JSON error block
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        const jsonText = Buffer.from(response.data).toString('utf8');
        const parsed = JSON.parse(jsonText);
        if (parsed.errors && parsed.errors.length > 0) {
          throw new Error(parsed.errors[0].message || 'Cloudflare internal error message');
        }
      }

      console.log(`[Cloudflare AI] Successfully generated background using model: ${model}`);
      return Buffer.from(response.data);
    } catch (error) {
      const statusText = error.response ? `HTTP ${error.response.status}` : 'Request Error';
      let errorDetails = error.message || error;
      
      if (error.response && error.response.data) {
        try {
          const rawData = Buffer.isBuffer(error.response.data) 
            ? error.response.data.toString('utf8')
            : error.response.data;
          const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
          if (parsed.errors && parsed.errors.length > 0) {
            errorDetails = parsed.errors[0].message;
          }
        } catch (_) {}
      }
      
      console.warn(`[Cloudflare AI] Model ${model} failed (${statusText}): ${errorDetails}`);
      lastError = new Error(`Model ${model} failed (${statusText}): ${errorDetails}`);
    }
  }

  throw lastError || new Error('All Cloudflare AI image models failed to generate backgrounds.');
}

// 1. GENERATE IMAGES (Cloudflare AI + Sharp Compositing)
router.post('/images', authenticateToken, (req, res) => {
  upload.single('productImage')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    // Force system default prompt
    const prompt = DEFAULT_PROMPT;
    const changeBackgroundOnly = req.body.changeBackgroundOnly || 'true';
    const imageCount = parseInt(req.body.count) || 4;
    const creditsRequired = imageCount * 2;

    let tempFilePath = null;
    let isBase64Created = false;

    if (req.file) {
      tempFilePath = req.file.path;
    } else if (req.body.productImage && req.body.productImage.includes(';base64,')) {
      try {
        const matches = req.body.productImage.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const buffer = Buffer.from(matches[2], 'base64');
          const filename = `product_b64_${Date.now()}.png`;
          tempFilePath = path.join(uploadDir, filename);
          fs.writeFileSync(tempFilePath, buffer);
          req.file = { path: tempFilePath, filename, mimetype: matches[1] };
          isBase64Created = true;
        }
      } catch (error) {
        return res.status(400).json({ error: 'Failed to process base64 image data' });
      }
    }

    try {
      // Check wallet balance
      const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.userId } });
      if (!wallet || wallet.credits < creditsRequired) {
        if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return res.status(402).json({ error: `Insufficient credits. Generation requires ${creditsRequired} credits, but you have ${wallet?.credits || 0}.` });
      }

      const settings = await prisma.systemSetting.findUnique({ where: { id: 'singleton' } });
      const cfAccountId = settings?.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID;
      const cfApiToken = settings?.cloudflareApiToken || process.env.CLOUDFLARE_API_TOKEN;

      if (!cfAccountId || !cfApiToken) {
        if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return res.status(500).json({ error: 'Cloudflare AI credentials are not configured' });
      }

      // Create ImageJob entry
      const job = await prisma.imageJob.create({
        data: {
          userId: req.user.userId,
          prompt,
          imageCount,
          creditsCharged: creditsRequired,
          status: 'PROCESSING'
        }
      });

      const outputDir = path.join(__dirname, '../public/generated');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const generatedImageUrls = [];
      const generatedImagePaths = [];

      const generationPromises = Array.from({ length: imageCount }).map(async (_, index) => {
        const backgroundBuffer = await runCloudflareAiImage(cfAccountId, cfApiToken, prompt);
        let finalImageBuffer = backgroundBuffer;

        if (changeBackgroundOnly === 'true' && req.file) {
          const productBuffer = fs.readFileSync(req.file.path);

          const resizedProduct = await sharp(productBuffer)
            .resize({
              width: 750,
              height: 750,
              fit: 'inside',
              withoutEnlargement: true
            })
            .toBuffer();

          finalImageBuffer = await sharp(backgroundBuffer)
            .resize(1000, 1000)
            .composite([
              {
                input: resizedProduct,
                gravity: 'center'
              }
            ])
            .png()
            .toBuffer();
        } else {
          finalImageBuffer = await sharp(backgroundBuffer)
            .resize(1000, 1000)
            .png()
            .toBuffer();
        }

        const filename = `gen_${job.id}_${index + 1}_${Date.now()}.png`;
        const filePath = path.join(outputDir, filename);
        fs.writeFileSync(filePath, finalImageBuffer);

        const relativeUrl = `/generated/${filename}`;
        return { filePath, relativeUrl };
      });

      const results = await Promise.all(generationPromises);

      await prisma.$transaction(async (tx) => {
        for (const res of results) {
          await tx.generatedImage.create({
            data: {
              jobId: job.id,
              localPath: res.filePath,
              url: res.relativeUrl
            }
          });
          generatedImageUrls.push(res.relativeUrl);
          generatedImagePaths.push(res.filePath);
        }

        await tx.wallet.update({
          where: { userId: req.user.userId },
          data: { credits: { decrement: creditsRequired } }
        });

        await tx.imageJob.update({
          where: { id: job.id },
          data: { status: 'COMPLETED' }
        });

        await tx.auditLog.create({
          data: {
            userId: req.user.userId,
            action: 'IMAGE_GENERATION',
            details: `Generated ${imageCount} advertisements with system default prompt. Charged ${creditsRequired} credits.`
          }
        });
      });

      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (err) {
          console.error('Failed to delete temp product upload:', err);
        }
      }

      res.json({
        success: true,
        jobId: job.id,
        images: generatedImageUrls,
        creditsCharged: creditsRequired,
        message: 'Images generated successfully'
      });
    } catch (error) {
      console.error('AI Image generation error:', error);
      
      if (req.body.jobId || (typeof job !== 'undefined' && job.id)) {
        await prisma.imageJob.update({
          where: { id: req.body.jobId || job.id },
          data: {
            status: 'FAILED',
            errorMessage: error.message
          }
        });
      }

      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

      res.status(500).json({ error: 'AI image generation failed: ' + error.message });
    }
  });
});

// 2. GET HISTORICAL GENERATED IMAGES
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const jobs = await prisma.imageJob.findMany({
      where: { userId: req.user.userId, status: 'COMPLETED' },
      include: { images: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(jobs);
  } catch (error) {
    console.error('Fetch image history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. DOWNLOAD SELECTED IMAGES ZIP
router.post('/download-zip', authenticateToken, async (req, res) => {
  const { imageIds } = req.body;
  if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
    return res.status(400).json({ error: 'Array of imageIds is required' });
  }

  try {
    const images = await prisma.generatedImage.findMany({
      where: {
        id: { in: imageIds },
        job: { userId: req.user.userId }
      }
    });

    if (images.length === 0) {
      return res.status(404).json({ error: 'No matching generated images found' });
    }

    const settings = await prisma.systemSetting.findUnique({ where: { id: 'singleton' } });
    const zipFolder = settings?.zipStoragePath || 'D:\\VEXEL ZIPs';

    if (!fs.existsSync(zipFolder)) {
      fs.mkdirSync(zipFolder, { recursive: true });
    }

    const zipFilename = `vexel_archive_${Date.now()}.zip`;
    const zipPath = path.join(zipFolder, zipFilename);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      res.json({
        success: true,
        zipPath,
        zipFilename,
        size: archive.pointer(),
        message: 'ZIP created successfully'
      });
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(output);

    for (const img of images) {
      if (fs.existsSync(img.localPath)) {
        archive.file(img.localPath, { name: path.basename(img.localPath) });
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error('ZIP generation error:', error);
    res.status(500).json({ error: 'Failed to create ZIP package: ' + error.message });
  }
});

module.exports = router;
