const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma/client');

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  try {
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id, mustChangePassword: user.must_change_password }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.status(200).json({ token, must_change_password: user.must_change_password });
  } catch (error) {
    console.error('login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
module.exports = { login };
