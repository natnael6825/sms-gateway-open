const { Router } = require('express');
const deviceController = require('../controllers/device.controller');
const authMiddleware = require('../middleware/auth.middleware');
const deviceAuthMiddleware = require('../middleware/deviceAuth.middleware');

const router = Router();

// Public — called by mobile before pairing
router.post('/pair', deviceController.pairDevice);

// Device-authenticated
router.post('/heartbeat', deviceAuthMiddleware, deviceController.heartbeat);
router.post('/disconnect', deviceAuthMiddleware, deviceController.disconnect);
router.post('/info', deviceAuthMiddleware, deviceController.updateDeviceInfo);
router.get('/activity', deviceAuthMiddleware, deviceController.getActivity);

// User (JWT) authenticated
router.get('/list', authMiddleware, deviceController.listDevices);
router.get('/:id', authMiddleware, deviceController.getDeviceDetails);
router.delete('/:id', authMiddleware, deviceController.removeDevice);

module.exports = router;
