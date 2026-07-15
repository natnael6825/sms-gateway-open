const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const deviceAuthMiddleware = require('../middleware/deviceAuth.middleware');
const connectedDeviceMiddleware = require('../middleware/connectedDevice.middleware');
const {
  createMessage,
  getUserMessages,
  getPendingMessage,
  markSendStarted,
} = require('../controllers/messages.controller');

// Device-authenticated routes
router.get('/pending', deviceAuthMiddleware, getPendingMessage);
router.post('/:id/send-started', deviceAuthMiddleware, markSendStarted);

// Authenticated routes
router.post('/', authMiddleware, connectedDeviceMiddleware, createMessage);
router.get('/', authMiddleware, getUserMessages);

module.exports = router;
