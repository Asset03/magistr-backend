const express = require('express');
const router = express.Router();

const searchController = require('../controllers/searchController');
const { optionalAuth } = require('../middleware/auth');
const { validateSearchFilters } = require('../middleware/validation');

// Public routes with optional authentication
router.get('/', optionalAuth, searchController.globalSearch);
router.get('/suggestions', optionalAuth, searchController.getSearchSuggestions);
router.post('/advanced', optionalAuth, validateSearchFilters, searchController.advancedSearch);
router.get('/similar/:id', optionalAuth, searchController.searchSimilar);

module.exports = router;
