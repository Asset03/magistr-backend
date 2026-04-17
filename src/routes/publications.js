const express = require('express');
const router = express.Router();

const publicationController = require('../controllers/publicationController');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const { validatePublication, validateSearchFilters } = require('../middleware/validation');

// Public routes
router.get('/', optionalAuth, publicationController.getAllPublications);
router.get('/search', optionalAuth, validateSearchFilters, publicationController.searchPublications);
router.get('/:id', optionalAuth, publicationController.getPublicationById);
router.get('/:id/similar', optionalAuth, publicationController.getSimilarPublications);
router.get('/:id/citations', optionalAuth, publicationController.getCitations);
router.get('/:id/references', optionalAuth, publicationController.getReferences);
router.get('/:id/citation-network', optionalAuth, publicationController.getCitationNetwork);

// Protected routes - create/update/delete require authentication
router.use(protect);

router.post('/', authorize('admin', 'researcher'), validatePublication, publicationController.createPublication);
router.put('/:id', authorize('admin', 'researcher'), publicationController.updatePublication);
router.delete('/:id', authorize('admin'), publicationController.deletePublication);

module.exports = router;
