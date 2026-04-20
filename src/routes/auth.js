const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { 
  auth, 
  generateToken, 
  generateRefreshToken, 
  verifyToken,
  authRateLimit,
  generalRateLimit
} = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Register new user
router.post('/register', [
  authRateLimit,
  body('username')
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('first_name').optional().isLength({ max: 50 }),
  body('last_name').optional().isLength({ max: 50 }),
  body('institution.name').optional().isLength({ max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ 
        error: 'username already exists',
        field: 'username'
      });
    }

    // Create new user
    const user = new User({
      ...req.body,
      status: 'active'
    });

    await user.save();

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    logger.info(`New user registered: ${user.username}`);

    res.status(201).json({
      message: 'User registered successfully.',
      user: {
        id: user._id,
        username: user.username,
        full_name: user.full_name_calc,
        role: user.role,
        status: user.status
      },
      token,
      refreshToken
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login user
router.post('/login', [
  authRateLimit,
  body('identifier').notEmpty().withMessage('Username or email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { identifier, password } = req.body;

    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier }
      ]
    });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check account status
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended' });
    }

    // Update last login
    await user.updateLastLogin();

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    logger.info(`User logged in: ${user.username}`);

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        full_name: user.full_name_calc,
        role: user.role,
        status: user.status,
        last_login: user.last_login
      },
      token,
      refreshToken
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { refreshToken } = req.body;

    try {
      const decoded = verifyToken(refreshToken);
      
      if (decoded.type !== 'refresh') {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      const user = await User.findById(decoded.id);
      if (!user || user.status !== 'active') {
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      // Generate new tokens
      const newToken = generateToken(user._id);
      const newRefreshToken = generateRefreshToken(user._id);

      res.json({
        token: newToken,
        refreshToken: newRefreshToken
      });

    } catch (tokenError) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout user
router.post('/logout', auth, async (req, res) => {
  try {
    logger.info(`User logged out: ${req.user.username}`);

    res.json({ message: 'Logout successful' });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
router.post('/change-password', [
  auth,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const isCurrentPasswordValid = await req.user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Update password
    req.user.password = newPassword;
    await req.user.save();

    logger.info(`Password changed: ${req.user.username}`);

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    logger.error('Password change error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
router.get('/profile', auth, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        full_name: req.user.full_name_calc,
        first_name: req.user.first_name,
        last_name: req.user.last_name,
        avatar: req.user.avatar,
        bio: req.user.bio,
        role: req.user.role,
        status: req.user.status,
        institution: req.user.institution,
        research_interests: req.user.research_interests,
        academic_profile: req.user.academic_profile,
        orcid: req.user.orcid,
        preferences: req.user.preferences,
        statistics: req.user.statistics,
        profile_completion: req.user.profile_completion,
        created_at: req.user.created_at,
        last_login: req.user.last_login
      }
    });

  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', [
  auth,
  body('first_name').optional().isLength({ max: 50 }),
  body('last_name').optional().isLength({ max: 50 }),
  body('bio').optional().isLength({ max: 500 }),
  body('institution.name').optional().isLength({ max: 100 }),
  body('research_interests').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const allowedFields = [
      'first_name', 'last_name', 'bio', 'institution', 
      'research_interests', 'academic_profile', 'preferences'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        req.user[field] = req.body[field];
      }
    });

    await req.user.save();

    logger.info(`Profile updated: ${req.user.username}`);

    res.json({
      message: 'Profile updated successfully',
      user: req.user.getPublicProfile()
    });

  } catch (error) {
    logger.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
