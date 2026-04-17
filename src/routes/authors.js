const express = require('express');
const router = express.Router();

const authorController = require('../controllers/authorController');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

// Public routes
router.get('/', optionalAuth, authorController.getAllAuthors);
router.get('/:id', optionalAuth, authorController.getAuthorById);
router.get('/:id/publications', optionalAuth, authorController.getAuthorPublications);
router.get('/:id/coauthors', optionalAuth, authorController.getCoAuthors);
router.get('/:id/metrics', optionalAuth, authorController.getAuthorMetrics);
router.get('/:id/potential-collaborators', optionalAuth, authorController.getPotentialCollaborators);

// Protected routes
router.use(protect);

router.put('/:id/profile', authorController.createOrUpdateProfile);
router.put('/:id/metrics', authorize('admin'), authorController.updateAuthorMetrics);

module.exports = router;
