const { Router } = require('express');
const apiKeyAuthMiddleware = require('../middleware/apiKeyAuth.middleware');
const connectedDeviceMiddleware = require('../middleware/connectedDevice.middleware');
const publicApiController = require('../controllers/publicApi.controller');

const router = Router();

router.post('/sms/send', apiKeyAuthMiddleware, connectedDeviceMiddleware, publicApiController.sendSms);
router.get('/sms/:id', apiKeyAuthMiddleware, publicApiController.getSmsStatus);

module.exports = router;
