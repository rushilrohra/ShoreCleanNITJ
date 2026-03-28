const jwt = require('jsonwebtoken');

function getBearerToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.split(' ')[1];
}

function verifyUserToken(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ message: 'Authorization token missing' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
}

function signUserToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function verifyVolunteerToken(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ message: 'Authorization token missing' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Scanner access is restricted to NGO/admin users for now.
    if (req.user.role !== 'ngo' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Volunteer or NGO access required' });
    }

    return next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
}

function authenticateUser(req, res, next) {
  return verifyUserToken(req, res, next);
}

function authenticateVolunteer(req, res, next) {
  return verifyVolunteerToken(req, res, next);
}

module.exports = {
  signUserToken,
  verifyUserToken,
  verifyVolunteerToken,
  authenticateUser,
  authenticateVolunteer,
};
