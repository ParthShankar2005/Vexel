const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const prisma = new PrismaClient();

// Multer storage for support attachments
const supportUploadDir = path.join(__dirname, '../uploads/support');
if (!fs.existsSync(supportUploadDir)) {
  fs.mkdirSync(supportUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, supportUploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `support_${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB attachment limit
});

// 1. CREATE SUPPORT TICKET
router.post('/ticket', authenticateToken, async (req, res) => {
  try {
    const ticket = await prisma.ticket.create({
      data: {
        userId: req.user.userId,
        status: 'OPEN'
      }
    });

    res.json(ticket);
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. GET USER TICKETS
router.get('/tickets', authenticateToken, async (req, res) => {
  try {
    const tickets = await prisma.ticket.findMany({
      where: { userId: req.user.userId },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(tickets);
  } catch (error) {
    console.error('Fetch tickets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. GET ALL TICKETS (Admin Only)
router.get('/admin/tickets', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const tickets = await prisma.ticket.findMany({
      include: {
        user: { select: { email: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(tickets);
  } catch (error) {
    console.error('Admin fetch tickets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. GET TICKET MESSAGES
router.get('/messages/:ticketId', authenticateToken, async (req, res) => {
  const { ticketId } = req.params;

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (ticket.userId !== req.user.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied to support ticket logs' });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' }
    });

    res.json(messages);
  } catch (error) {
    console.error('Fetch messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. SEND MESSAGE WITH ATTACHMENT
router.post('/message', authenticateToken, (req, res) => {
  upload.single('attachment')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    const { ticketId, message } = req.body;
    if (!ticketId || (!message && !req.file && !req.body.attachment)) {
      return res.status(400).json({ error: 'TicketId and message content/attachment are required' });
    }

    try {
      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) {
        return res.status(404).json({ error: 'Support ticket not found' });
      }

      if (ticket.userId !== req.user.userId && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Unauthorized to post messages in this ticket' });
      }

      let attachmentPath = null;

      if (req.file) {
        attachmentPath = `/uploads/support/${req.file.filename}`;
      } else if (req.body.attachment && req.body.attachment.startsWith('data:')) {
        try {
          const matches = req.body.attachment.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const buffer = Buffer.from(matches[2], 'base64');
            const fileExt = matches[1].split('/')[1] || 'png';
            const filename = `support_b64_${Date.now()}.${fileExt}`;
            const localPath = path.join(supportUploadDir, filename);
            fs.writeFileSync(localPath, buffer);
            attachmentPath = `/uploads/support/${filename}`;
          }
        } catch (error) {
          return res.status(400).json({ error: 'Failed to process attachment data' });
        }
      }

      const chatMessage = await prisma.chatMessage.create({
        data: {
          ticketId,
          senderId: req.user.userId,
          senderRole: req.user.role,
          message: message || '',
          attachmentPath
        }
      });

      // Update ticket time
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() }
      });

      res.json(chatMessage);
    } catch (error) {
      console.error('Post support message error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// 6. CLOSE SUPPORT TICKET
router.post('/ticket/close', authenticateToken, async (req, res) => {
  const { ticketId } = req.body;
  if (!ticketId) {
    return res.status(400).json({ error: 'ticketId is required' });
  }

  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (ticket.userId !== req.user.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Unauthorized configuration' });
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'CLOSED' }
    });

    res.json(updated);
  } catch (error) {
    console.error('Close ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
