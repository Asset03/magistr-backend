const express = require('express');
const router = express.Router();

const analyticsController = require('../controllers/analyticsController');
const { protect, optionalAuth } = require('../middleware/auth');

// Public routes with optional authentication
router.get('/', optionalAuth, analyticsController.getAnalyticsData);
router.get('/trends', optionalAuth, analyticsController.getPublicationTrends);
router.get('/topics', optionalAuth, analyticsController.getTopicDistribution);
router.get('/author-network', optionalAuth, analyticsController.getAuthorNetwork);
router.get('/citation-network', optionalAuth, analyticsController.getCitationNetwork);
router.get('/journal-metrics', optionalAuth, analyticsController.getJournalMetrics);
router.get('/productivity', optionalAuth, analyticsController.getProductivityMetrics);

module.exports = router;
