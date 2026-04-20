const express = require('express');
const router = express.Router();
const Topic = require('../models/Topic');
const Publication = require('../models/Publication');
const { auth, authorize } = require('../middleware/auth');
const { body, validationResult, query } = require('express-validator');
const logger = require('../utils/logger');

// Get all topics with pagination and filtering
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('category').optional().isIn(['stem', 'social_sciences', 'humanities', 'arts', 'interdisciplinary', 'other']),
  query('field').optional().isString(),
  query('trendDirection').optional().isIn(['emerging', 'growing', 'stable', 'declining', 'resurgent']),
  query('sortBy').optional().isIn(['total_publications', 'total_citations', 'popularity_score', 'name']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query
    const query = { validation_status: 'validated' };

    // Apply filters
    if (req.query.category) {
      query.category = req.query.category;
    }

    if (req.query.field) {
      query.field = { $regex: req.query.field, $options: 'i' };
    }

    if (req.query.trendDirection) {
      query.trend_direction = req.query.trendDirection;
    }

    // Text search
    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }

    // Sorting
    const sortField = req.query.sortBy || 'total_publications';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sort = {};
    sort[sortField] = sortOrder;

    // Execute query
    const topics = await Topic.find(query)
      .populate('parent_topic_id', 'name')
      .populate('children.topic_id', 'name total_publications')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Topic.countDocuments(query);

    res.json({
      topics,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });

  } catch (error) {
    logger.error('Error fetching topics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get topic by ID
router.get('/:id', async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id)
      .populate('parent_topic_id', 'name category')
      .populate('children.topic_id', 'name total_publications popularity_score')
      .populate('related_topics.topic_id', 'name relationship_type similarity_score')
      .populate('top_authors.author_id', 'full_name h_index total_citations')
      .populate('top_journals');

    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Get topic analytics
    const analytics = await Topic.getTopicAnalytics(req.params.id);

    res.json({
      topic,
      analytics
    });

  } catch (error) {
    logger.error('Error fetching topic:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new topic
router.post('/', [
  auth,
  authorize('admin', 'researcher'),
  body('name').notEmpty().withMessage('Topic name is required'),
  body('description').optional().isString(),
  body('category').isIn(['stem', 'social_sciences', 'humanities', 'arts', 'interdisciplinary', 'other']),
  body('keywords').optional().isArray(),
  body('parent_topic_id').optional().isMongoId()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const topicData = {
      ...req.body,
      source: 'manual',
      validation_status: 'pending'
    };

    // Check for duplicate topic name
    const existingTopic = await Topic.findOne({ name: topicData.name });
    if (existingTopic) {
      return res.status(409).json({ error: 'Topic with this name already exists' });
    }

    // Set level and path if parent is specified
    if (topicData.parent_topic_id) {
      const parentTopic = await Topic.findById(topicData.parent_topic_id);
      if (parentTopic) {
        topicData.level = parentTopic.level + 1;
        topicData.path = [...(parentTopic.path || []), parentTopic.name];
      }
    } else {
      topicData.level = 0;
      topicData.path = [];
    }

    const topic = new Topic(topicData);
    await topic.save();

    // Add to parent's children if parent exists
    if (topicData.parent_topic_id) {
      await Topic.findByIdAndUpdate(topicData.parent_topic_id, {
        $push: {
          children: {
            topic_id: topic._id,
            weight: 1.0
          }
        }
      });
    }

    logger.info(`New topic created: ${topic.name}`);

    res.status(201).json(topic);

  } catch (error) {
    logger.error('Error creating topic:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update topic
router.put('/:id', [
  auth,
  authorize('admin', 'researcher'),
  body('name').optional().notEmpty().withMessage('Topic name cannot be empty'),
  body('description').optional().isString(),
  body('category').optional().isIn(['stem', 'social_sciences', 'humanities', 'arts', 'interdisciplinary', 'other']),
  body('keywords').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const topic = await Topic.findById(req.params.id);
    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Check for duplicate name if being updated
    if (req.body.name && req.body.name !== topic.name) {
      const existingTopic = await Topic.findOne({ 
        name: req.body.name,
        _id: { $ne: req.params.id }
      });
      if (existingTopic) {
        return res.status(409).json({ error: 'Topic with this name already exists' });
      }
    }

    Object.assign(topic, req.body);
    topic.updated_at = new Date();
    await topic.save();

    logger.info(`Topic updated: ${topic.name}`);

    res.json(topic);

  } catch (error) {
    logger.error('Error updating topic:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete topic
router.delete('/:id', [
  auth,
  authorize('admin')
], async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Check if topic has children
    if (topic.children && topic.children.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete topic with child topics. Delete children first.' 
      });
    }

    // Remove from parent's children
    if (topic.parent_topic_id) {
      await Topic.findByIdAndUpdate(topic.parent_topic_id, {
        $pull: {
          children: { topic_id: topic._id }
        }
      });
    }

    await Topic.findByIdAndDelete(req.params.id);

    logger.info(`Topic deleted: ${topic.name}`);

    res.json({ message: 'Topic deleted successfully' });

  } catch (error) {
    logger.error('Error deleting topic:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search topics
router.post('/search', [
  body('query').notEmpty().withMessage('Search query is required'),
  body('filters').optional().isObject(),
  body('page').optional().isInt({ min: 1 }),
  body('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { query, filters = {}, page = 1, limit = 20 } = req.body;
    const skip = (page - 1) * limit;

    const topics = await Topic.search(query, filters)
      .populate('parent_topic_id', 'name')
      .skip(skip)
      .limit(limit);

    const total = await Topic.countDocuments({
      $text: { $search: query },
      validation_status: 'validated'
    });

    res.json({
      topics,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      },
      query,
      filters
    });

  } catch (error) {
    logger.error('Error searching topics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get trending topics
router.get('/trending/:limit', async (req, res) => {
  try {
    const limit = parseInt(req.params.limit) || 20;

    const topics = await Topic.findTrendingTopics(limit)
      .populate('top_authors.author_id', 'full_name')
      .populate('top_journals');

    res.json({
      topics,
      total: topics.length
    });

  } catch (error) {
    logger.error('Error fetching trending topics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get top topics by metrics
router.get('/top/:metric', [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('category').optional().isIn(['stem', 'social_sciences', 'humanities', 'arts', 'interdisciplinary', 'other'])
], async (req, res) => {
  try {
    const metric = req.params.metric;
    const limit = parseInt(req.query.limit) || 50;
    const category = req.query.category;

    if (!['total_publications', 'total_citations', 'popularity_score'].includes(metric)) {
      return res.status(400).json({ error: 'Invalid metric' });
    }

    let query = { validation_status: 'validated' };
    if (category) {
      query.category = category;
    }

    const sort = {};
    sort[metric] = -1;

    const topics = await Topic.find(query)
      .select('name category total_publications total_citations popularity_score trend_direction')
      .sort(sort)
      .limit(limit);

    res.json({
      topics,
      metric,
      total: topics.length
    });

  } catch (error) {
    logger.error('Error fetching top topics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get topic hierarchy
router.get('/hierarchy/:rootId', async (req, res) => {
  try {
    const hierarchy = await Topic.findTopicHierarchy(req.params.rootId);

    if (!hierarchy) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    res.json(hierarchy);

  } catch (error) {
    logger.error('Error fetching topic hierarchy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get topic words
router.get('/:id/words', [
  query('nWords').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const nWords = parseInt(req.query.nWords) || 10;

    const words = await Topic.getTopicWords(req.params.id, nWords);

    res.json({
      topic_id: req.params.id,
      words,
      count: words.words ? words.words.length : 0
    });

  } catch (error) {
    logger.error('Error fetching topic words:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get publications for topic
router.get('/:id/publications', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sortBy').optional().isIn(['publication_year', 'citations_count', 'created_at']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const sortField = req.query.sortBy || 'publication_year';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sort = {};
    sort[sortField] = sortOrder;

    const publications = await Publication.find({
      'topics.topic_id': req.params.id,
      status: 'published'
    })
      .populate('authors.author_id', 'full_name')
      .populate('topics.topic_id', 'name confidence')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Publication.countDocuments({
      'topics.topic_id': req.params.id,
      status: 'published'
    });

    res.json({
      publications,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });

  } catch (error) {
    logger.error('Error fetching topic publications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get related topics
router.get('/:id/related', [
  query('limit').optional().isInt({ min: 1, max: 20 }),
  query('relationshipType').optional().isIn(['similar', 'parent', 'child', 'overlapping', 'competing', 'complementary'])
], async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const relationshipType = req.query.relationshipType;

    const topic = await Topic.findById(req.params.id)
      .populate('related_topics.topic_id', 'name relationship_type similarity_score');

    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    let relatedTopics = topic.related_topics || [];

    // Filter by relationship type if specified
    if (relationshipType) {
      relatedTopics = relatedTopics.filter(rt => rt.relationship_type === relationshipType);
    }

    // Sort by similarity score and limit
    relatedTopics = relatedTopics
      .sort((a, b) => (b.similarity_score || 0) - (a.similarity_score || 0))
      .slice(0, limit);

    res.json({
      topic_id: req.params.id,
      related_topics: relatedTopics,
      total: relatedTopics.length
    });

  } catch (error) {
    logger.error('Error fetching related topics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update topic validation status
router.put('/:id/validate', [
  auth,
  authorize('admin'),
  body('validation_status').isIn(['pending', 'validated', 'disputed', 'deprecated']),
  body('validation_notes').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const topic = await Topic.findById(req.params.id);
    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    topic.validation_status = req.body.validation_status;
    topic.validated_by = req.user.id;
    topic.validation_notes = req.body.validation_notes;
    topic.updated_at = new Date();
    await topic.save();

    logger.info(`Topic validation status updated: ${topic.name} -> ${req.body.validation_status}`);

    res.json({
      message: 'Topic validation status updated',
      validation_status: topic.validation_status
    });

  } catch (error) {
    logger.error('Error updating topic validation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get topic statistics
router.get('/:id/statistics', async (req, res) => {
  try {
    const analytics = await Topic.getTopicAnalytics(req.params.id);

    res.json({
      topic_id: req.params.id,
      analytics
    });

  } catch (error) {
    logger.error('Error fetching topic statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
