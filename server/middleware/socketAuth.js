const jwt = require('jsonwebtoken');

module.exports = (io, next) => {
  const token = io.handshake.auth && io.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: Token required'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Extract user data from nested structure
    io.user = decoded.user;  // Extract the nested user object
    io.user.isAuthenticated = true;  // Mark as authenticated
    return next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid token'));
  }
};
