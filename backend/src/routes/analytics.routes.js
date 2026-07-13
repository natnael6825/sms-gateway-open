const { Router } = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const analyticsController = require('../controllers/analytics.controller');

const router = Router();

router.get('/summary', authMiddleware, analyticsController.getSummary);
router.get('/overview', authMiddleware, analyticsController.getOverview);

module.exports = router;
