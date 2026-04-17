const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const {
  validateRegister,
  validateLogin,
  validatePasswordChange,
  validateProfileUpdate
} = require('../middleware/validation');

// Public routes
router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Protected routes
router.use(protect); // All routes below this require authentication

router.post('/logout', authController.logout);
router.get('/me', authController.getCurrentUser);
router.put('/profile', validateProfileUpdate, authController.updateProfile);
router.post('/change-password', validatePasswordChange, authController.changePassword);

module.exports = router;
