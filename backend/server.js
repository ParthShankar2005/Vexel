const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const planRoutes = require('./routes/plans');
const offerRoutes = require('./routes/offers');
const paymentRoutes = require('./routes/payments');
const generateRoutes = require('./routes/generate');
const supportRoutes = require('./routes/support');
const settingsRoutes = require('./routes/settings');

const app = express();
const server = http.createServer(app);

// Configure Socket.io
const io = socketIo(server, {
  cors: {
    origin: '*', // Allow connections from Electron renderer
    methods: ['GET', 'POST']
  }
});

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static folders
app.use('/generated', express.static(path.join(__dirname, 'public/generated')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Register Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/settings', settingsRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'VEXEL AI API Server Running' });
});

// Support Chat WebSocket Event Handling
io.on('connection', (socket) => {
  console.log('Socket client connected:', socket.id);

  // User joins room based on their userId
  socket.on('join_room', (userId) => {
    socket.join(`room_${userId}`);
    console.log(`User ${userId} joined room_${userId}`);
  });

  // Admin joins global support room to receive all ticket updates
  socket.on('join_admin', () => {
    socket.join('admin_room');
    console.log('Admin joined admin_room');
  });

  // Handle support message from user
  socket.on('send_message', (data) => {
    // data: { ticketId, senderId, senderRole, message, attachmentPath, createdAt, ticketUserId }
    const targetRoom = `room_${data.ticketUserId || data.senderId}`;
    
    // Broadcast to user room
    socket.to(targetRoom).emit('receive_message', data);
    
    // Broadcast to admin room
    socket.to('admin_room').emit('receive_message', data);
    
    console.log(`Message in ticket ${data.ticketId} broadcasted to ${targetRoom} and admin_room`);
  });

  socket.on('disconnect', () => {
    console.log('Socket client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
