// server/routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');

// @route   POST /api/auth/signup
router.post('/signup', authController.signup);

// @route   POST /api/auth/register (alias for signup)
router.post('/register', authController.signup);

// @route   POST /api/auth/login
router.post('/login', authController.login);

// @route   GET /api/auth/me
router.get('/me', auth, authController.getMe);

module.exports = router;
