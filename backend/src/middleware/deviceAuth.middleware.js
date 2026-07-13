const jwt = require('jsonwebtoken');
const prisma = require('../prisma/client');

/**
 * Device JWT authentication middleware.
 * Reads the X-Device-Token header and verifies it using the deployment secret.
 * from environment, and attaches decoded userId and deviceId to req.device.
 * Returns HTTP 401 with { "error": "Unauthorized" } if token is missing or invalid.
 */
async function deviceAuthMiddleware(req, res, next) {
  const deviceToken = req.headers['x-device-token'];

  if (!deviceToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(deviceToken, process.env.JWT_SECRET);
    const device = await prisma.device.findFirst({
      where: { id: decoded.deviceId, user_id: decoded.userId, is_active: true },
    });
    if (!device) return res.status(401).json({ error: 'Unauthorized' });
    req.device = { userId: decoded.userId, deviceId: decoded.deviceId };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = deviceAuthMiddleware;
