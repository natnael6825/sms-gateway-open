const { Router } = require('express');
const deviceAuthMiddleware = require('../middleware/deviceAuth.middleware');
const webhookController = require('../controllers/webhook.controller');

const router = Router();

router.post('/:id', deviceAuthMiddleware, webhookController.reportDelivery);

module.exports = router;
