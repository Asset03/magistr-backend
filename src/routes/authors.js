const express = require('express');
const router = express.Router();
const Author = require('../models/Author');
const Publication = require('../models/Publication');
const Citation = require('../models/Citation');
const { auth } = require('../middleware/auth');
const { body, validationResult, query } = require('express-validator');
const logger = require('../utils/logger');

// Get all authors with pagination and filtering
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('country').optional().isString(),
  query('affiliation').optional().isString(),
  query('minHIndex').optional().isInt({ min: 0 }),
  query('careerStage').optional().isIn(['phd_student', 'postdoc', 'assistant_professor', 'associate_professor', 'professor', 'researcher', 'industry_professional', 'retired']),
  query('sortBy').optional().isIn(['h_index', 'total_citations', 'total_publications', 'full_name']),
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
    const query = { status: 'active' };

    // Apply filters
    if (req.query.country) {
      query.country = { $regex: req.query.country, $options: 'i' };
    }

    if (req.query.affiliation) {
      query['affiliations.name'] = { $regex: req.query.affiliation, $options: 'i' };
    }

    if (req.query.minHIndex) {
      query.h_index = { $gte: parseInt(req.query.minHIndex) };
    }

    if (req.query.careerStage) {
      query.career_stage = req.query.careerStage;
    }

    // Text search
    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }

    // Sorting
    const sortField = req.query.sortBy || 'h_index';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sort = {};
    sort[sortField] = sortOrder;

    // Execute query
    const authors = await Author.find(query)
      .select('-__v')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Author.countDocuments(query);

    res.json({
      authors,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });

  } catch (error) {
    logger.error('Error fetching authors:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get author by ID
router.get('/:id', async (req, res) => {
  try {
    const author = await Author.findById(req.params.id)
      .populate('publications.publication_id', 'title publication_year citations_count journal.name')
      .populate('collaborators.author_id', 'full_name h_index total_citations')
      .populate('social_profiles');

    if (!author) {
      return res.status(404).json({ error: 'Author not found' });
    }

    // Calculate additional metrics
    const authorData = author.toObject();
    authorData.citations_per_publication = author.citations_per_publication;
    authorData.publications_per_year = author.publications_per_year;
    authorData.collaboration_count = author.collaboration_count;

    res.json(authorData);

  } catch (error) {
    logger.error('Error fetching author:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new author
router.post('/', [
  auth,
  body('first_name').notEmpty().withMessage('First name is required'),
  body('last_name').notEmpty().withMessage('Last name is required'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('orcid').optional().matches(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/).withMessage('Invalid ORCID format'),
  body('affiliations').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const authorData = {
      ...req.body,
      full_name: `${req.body.first_name} ${req.body.middle_name ? req.body.middle_name + ' ' : ''}${req.body.last_name}`,
      source: 'manual'
    };

    // Check for duplicate ORCID
    if (authorData.orcid) {
      const existingAuthor = await Author.findOne({ orcid: authorData.orcid });
      if (existingAuthor) {
        return res.status(409).json({ error: 'Author with this ORCID already exists' });
      }
    }

    // Check for duplicate email
    if (authorData.email) {
      const existingAuthor = await Author.findOne({ email: authorData.email });
      if (existingAuthor) {
        return res.status(409).json({ error: 'Author with this email already exists' });
      }
    }

    const author = new Author(authorData);
    await author.save();

    // Calculate profile completeness
    await author.calculateProfileCompleteness();

    res.status(201).json(author);

  } catch (error) {
    logger.error('Error creating author:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update author
router.put('/:id', [
  auth,
  body('first_name').optional().notEmpty().withMessage('First name cannot be empty'),
  body('last_name').optional().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('orcid').optional().matches(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/).withMessage('Invalid ORCID format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const author = await Author.findById(req.params.id);
    if (!author) {
      return res.status(404).json({ error: 'Author not found' });
    }

    // Check for duplicate ORCID if being updated
    if (req.body.orcid && req.body.orcid !== author.orcid) {
      const existingAuthor = await Author.findOne({ orcid: req.body.orcid });
      if (existingAuthor) {
        return res.status(409).json({ error: 'Author with this ORCID already exists' });
      }
    }

    // Check for duplicate email if being updated
    if (req.body.email && req.body.email !== author.email) {
      const existingAuthor = await Author.findOne({ email: req.body.email });
      if (existingAuthor) {
        return res.status(409).json({ error: 'Author with this email already exists' });
      }
    }

    Object.assign(author, req.body);
    author.updated_at = new Date();
    await author.save();

    // Recalculate profile completeness
    await author.calculateProfileCompleteness();

    res.json(author);

  } catch (error) {
    logger.error('Error updating author:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete author
router.delete('/:id', auth, async (req, res) => {
  try {
    const author = await Author.findById(req.params.id);
    if (!author) {
      return res.status(404).json({ error: 'Author not found' });
    }

    // Soft delete
    author.status = 'inactive';
    await author.save();

    res.json({ message: 'Author deleted successfully' });

  } catch (error) {
    logger.error('Error deleting author:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search authors
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

    const authors = await Author.search(query, filters)
      .select('-__v')
      .skip(skip)
      .limit(limit);

    const total = await Author.countDocuments({
      $text: { $search: query }
    });

    res.json({
      authors,
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
    logger.error('Error searching authors:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get top authors by metrics
router.get('/top/:metric', async (req, res) => {
  try {
    const metric = req.params.metric;
    const limit = parseInt(req.query.limit) || 50;
    const country = req.query.country;

    if (!['h_index', 'total_citations', 'total_publications'].includes(metric)) {
      return res.status(400).json({ error: 'Invalid metric' });
    }

    let query = { status: 'active' };
    if (country) {
      query.country = { $regex: country, $options: 'i' };
    }

    const sort = {};
    sort[metric] = -1;

    const authors = await Author.find(query)
      .select('full_name h_index total_citations total_publications affiliations.name country')
      .sort(sort)
      .limit(limit);

    res.json({
      authors,
      metric,
      total: authors.length
    });

  } catch (error) {
    logger.error('Error fetching top authors:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get author's publications
router.get('/:id/publications', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const publications = await Publication.find({ 
      'authors.author_id': req.params.id,
      status: 'published'
    })
      .populate('topics.topic_id', 'name')
      .sort({ publication_year: -1, citations_count: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Publication.countDocuments({
      'authors.author_id': req.params.id,
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
    logger.error('Error fetching author publications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get author's collaborators
router.get('/:id/collaborators', async (req, res) => {
  try {
    const author = await Author.findById(req.params.id)
      .populate('collaborators.author_id', 'full_name h_index total_citations affiliations.name');

    if (!author) {
      return res.status(404).json({ error: 'Author not found' });
    }

    // Sort collaborators by collaboration count
    const collaborators = author.collaborators
      .sort((a, b) => b.collaboration_count - a.collaboration_count)
      .map(collab => ({
        author: collab.author_id,
        collaboration_count: collab.collaboration_count,
        last_collaboration_year: collab.last_collaboration_year
      }));

    res.json({
      author_id: author._id,
      author_name: author.full_name,
      collaborators,
      total_collaborators: collaborators.length
    });

  } catch (error) {
    logger.error('Error fetching author collaborators:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get author's citation network
router.get('/:id/citation-network', async (req, res) => {
  try {
    const author = await Author.findById(req.params.id);
    if (!author) {
      return res.status(404).json({ error: 'Author not found' });
    }

    // Get author's publications
    const publications = await Publication.find({
      'authors.author_id': req.params.id,
      status: 'published'
    }).select('_id title');

    const publicationIds = publications.map(p => p._id);

    // Get citations where this author's work is cited
    const incomingCitations = await Citation.find({
      cited_publication_id: { $in: publicationIds }
    })
      .populate('citing_publication_id', 'title authors')
      .populate('cited_publication_id', 'title');

    // Get citations where this author's work cites others
    const outgoingCitations = await Citation.find({
      citing_publication_id: { $in: publicationIds }
    })
      .populate('citing_publication_id', 'title authors')
      .populate('cited_publication_id', 'title authors');

    res.json({
      author_id: author._id,
      author_name: author.full_name,
      publications: publications.length,
      citation_network: {
        incoming_citations: incomingCitations,
        outgoing_citations: outgoingCitations,
        total_incoming: incomingCitations.length,
        total_outgoing: outgoingCitations.length
      }
    });

  } catch (error) {
    logger.error('Error fetching author citation network:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update author metrics
router.put('/:id/metrics', [
  auth,
  body('h_index').optional().isInt({ min: 0 }),
  body('g_index').optional().isInt({ min: 0 }),
  body('i10_index').optional().isInt({ min: 0 }),
  body('total_citations').optional().isInt({ min: 0 }),
  body('total_publications').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const author = await Author.findById(req.params.id);
    if (!author) {
      return res.status(404).json({ error: 'Author not found' });
    }

    const metrics = {};
    if (req.body.h_index !== undefined) metrics.h_index = req.body.h_index;
    if (req.body.g_index !== undefined) metrics.g_index = req.body.g_index;
    if (req.body.i10_index !== undefined) metrics.i10_index = req.body.i10_index;
    if (req.body.total_citations !== undefined) metrics.total_citations = req.body.total_citations;
    if (req.body.total_publications !== undefined) metrics.total_publications = req.body.total_publications;

    await author.updateMetrics(metrics);

    res.json({
      message: 'Author metrics updated successfully',
      metrics
    });

  } catch (error) {
    logger.error('Error updating author metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get authors by affiliation
router.get('/affiliation/:affiliationName', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const authors = await Author.findByAffiliation(req.params.affiliationName)
      .select('full_name h_index total_citations affiliations')
      .skip(skip)
      .limit(limit);

    const total = await Author.countDocuments({
      'affiliations.name': { $regex: req.params.affiliationName, $options: 'i' },
      status: 'active'
    });

    res.json({
      authors,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      },
      affiliation: req.params.affiliationName
    });

  } catch (error) {
    logger.error('Error fetching authors by affiliation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get authors by country
router.get('/country/:countryName', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const authors = await Author.findByCountry(req.params.countryName)
      .select('full_name h_index total_citations affiliations')
      .skip(skip)
      .limit(limit);

    const total = await Author.countDocuments({
      country: { $regex: req.params.countryName, $options: 'i' },
      status: 'active'
    });

    res.json({
      authors,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      },
      country: req.params.countryName
    });

  } catch (error) {
    logger.error('Error fetching authors by country:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
