const { body, validationResult } = require('express-validator');
const User = require('../models/User');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errorMessages
    });
  }
  
  next();
};

// User registration validation
const validateRegister = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .custom(async (value) => {
      const existingUser = await User.findOne({ email: value });
      if (existingUser) {
        throw new Error('Email already exists');
      }
      return true;
    }),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('role')
    .optional()
    .isIn(['user', 'researcher', 'admin'])
    .withMessage('Role must be one of: user, researcher, admin'),
  
  body('affiliation')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Affiliation cannot exceed 200 characters'),
  
  handleValidationErrors
];

// User login validation
const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

// Publication validation
const validatePublication = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 500 })
    .withMessage('Title cannot exceed 500 characters'),
  
  body('abstract')
    .trim()
    .notEmpty()
    .withMessage('Abstract is required')
    .isLength({ max: 5000 })
    .withMessage('Abstract cannot exceed 5000 characters'),
  
  body('authors')
    .isArray({ min: 1 })
    .withMessage('At least one author is required')
    .custom((authors) => {
      if (!authors.every(author => author.author && typeof author.author === 'string')) {
        throw new Error('Each author must have a valid author ID');
      }
      return true;
    }),
  
  body('publicationYear')
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage('Publication year must be valid'),
  
  body('keywords')
    .optional()
    .isArray()
    .withMessage('Keywords must be an array'),
  
  body('doi')
    .optional()
    .matches(/^10.\d{4,9}\/[-._;()\/:A-Z0-9]+$/i)
    .withMessage('Please provide a valid DOI'),
  
  handleValidationErrors
];

// Search filters validation
const validateSearchFilters = [
  body('query')
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Search query must be between 1 and 500 characters'),
  
  body('authors')
    .optional()
    .isArray()
    .withMessage('Authors filter must be an array'),
  
  body('yearRange')
    .optional()
    .isObject()
    .custom((yearRange) => {
      if (yearRange.start && yearRange.end) {
        if (yearRange.start > yearRange.end) {
          throw new Error('Start year cannot be greater than end year');
        }
      }
      return true;
    }),
  
  body('keywords')
    .optional()
    .isArray()
    .withMessage('Keywords filter must be an array'),
  
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  body('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  handleValidationErrors
];

// Password change validation
const validatePasswordChange = [
  body('oldPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  handleValidationErrors
];

// Profile update validation
const validateProfileUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  
  body('affiliation')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Affiliation cannot exceed 200 characters'),
  
  body('researchInterests')
    .optional()
    .isArray()
    .withMessage('Research interests must be an array'),
  
  handleValidationErrors
];

module.exports = {
  validateRegister,
  validateLogin,
  validatePublication,
  validateSearchFilters,
  validatePasswordChange,
  validateProfileUpdate,
  handleValidationErrors
};
