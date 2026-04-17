const express = require('express');
const router = express.Router();

const dashboardController = require('../controllers/dashboardController');
const { protect, optionalAuth } = require('../middleware/auth');

// Public routes with optional authentication
router.get('/stats', optionalAuth, dashboardController.getDashboardStats);
router.get('/recent', optionalAuth, dashboardController.getRecentPublications);
router.get('/top-authors', optionalAuth, dashboardController.getTopAuthors);
router.get('/most-cited', optionalAuth, dashboardController.getMostCitedPublications);
router.get('/trending-topics', optionalAuth, dashboardController.getTrendingTopics);
router.get('/publication-trends', optionalAuth, dashboardController.getPublicationTrends);
router.get('/research-areas', optionalAuth, dashboardController.getResearchAreas);

module.exports = router;
