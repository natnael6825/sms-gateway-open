const { Router } = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const userController = require('../controllers/user.controller');

const router = Router();

router.get('/api-keys', authMiddleware, userController.listApiKeys);
router.post('/api-keys', authMiddleware, userController.createApiKey);
router.get('/api-keys/:id', authMiddleware, userController.getApiKeyDetails);
router.get('/pairing-code', authMiddleware, userController.getOrCreateDeviceKey);
router.post('/device-key/reset', authMiddleware, userController.resetDeviceKey);
router.get('/profile', authMiddleware, userController.getProfile);
router.post('/change-password', authMiddleware, userController.changePassword);

module.exports = router;
