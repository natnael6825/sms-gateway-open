const jwt = require('jsonwebtoken');

/**
 * JWT authentication middleware.
 * Reads the Authorization: Bearer <token> header, verifies the token
 * using JWT_SECRET from environment, and attaches decoded userId to req.user.
 * Returns HTTP 401 with { "error": "Unauthorized" } if token is missing or invalid.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.mustChangePassword && req.originalUrl !== '/api/user/change-password') {
      return res.status(403).json({ error: 'Password change required', code: 'PASSWORD_CHANGE_REQUIRED' });
    }
    req.user = { userId: decoded.userId };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = authMiddleware;
