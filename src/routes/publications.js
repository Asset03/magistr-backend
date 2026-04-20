const express = require('express');
const router = express.Router();
const Publication = require('../models/Publication');
const Author = require('../models/Author');
const Citation = require('../models/Citation');
const Topic = require('../models/Topic');
const { auth } = require('../middleware/auth');
const { body, validationResult, query } = require('express-validator');
const axios = require('axios');
const logger = require('../utils/logger');

// Get all publications with pagination and filtering
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('year').optional().isInt({ min: 1800, max: new Date().getFullYear() + 1 }),
  query('author').optional().isString(),
  query('journal').optional().isString(),
  query('minCitations').optional().isInt({ min: 0 }),
  query('keyword').optional().isString(),
  query('sortBy').optional().isIn(['citations_count', 'publication_year', 'created_at', 'title']),
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
    const query = { status: 'published' };

    // Apply filters
    if (req.query.year) {
      query.publication_year = parseInt(req.query.year);
    }

    if (req.query.author) {
      query['authors.name'] = { $regex: req.query.author, $options: 'i' };
    }

    if (req.query.journal) {
      query['journal.name'] = { $regex: req.query.journal, $options: 'i' };
    }

    if (req.query.minCitations) {
      query.citations_count = { $gte: parseInt(req.query.minCitations) };
    }

    if (req.query.keyword) {
      query['keywords.term'] = { $regex: req.query.keyword, $options: 'i' };
    }

    // Text search
    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }

    // Sorting
    const sortField = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sort = {};
    sort[sortField] = sortOrder;

    // Execute query
    const publications = await Publication.find(query)
      .populate('authors.author_id', 'full_name orcid affiliations.name')
      .populate('topics.topic_id', 'name category')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Publication.countDocuments(query);

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
    logger.error('Error fetching publications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get publication by ID
router.get('/:id', async (req, res) => {
  try {
    const publication = await Publication.findById(req.params.id)
      .populate('authors.author_id', 'full_name orcid affiliations.name h_index total_citations')
      .populate('topics.topic_id', 'name description category')
      .populate('citations.publication_id', 'title authors publication_year')
      .populate('references.publication_id', 'title authors publication_year');

    if (!publication) {
      return res.status(404).json({ error: 'Publication not found' });
    }

    // Increment view count
    await publication.incrementViews();

    res.json(publication);

  } catch (error) {
    logger.error('Error fetching publication:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new publication
router.post('/', [
  auth,
  body('title').notEmpty().withMessage('Title is required'),
  body('abstract').optional().isString(),
  body('publication_year').optional().isInt({ min: 1800, max: new Date().getFullYear() + 1 }),
  body('authors').optional().isArray(),
  body('doi').optional().isString(),
  body('keywords').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const publicationData = {
      ...req.body,
      source: 'manual',
      processing_status: 'pending'
    };

    // Check for duplicate DOI
    if (publicationData.doi) {
      const existingPub = await Publication.findOne({ doi: publicationData.doi });
      if (existingPub) {
        return res.status(409).json({ error: 'Publication with this DOI already exists' });
      }
    }

    const publication = new Publication(publicationData);
    await publication.save();

    // Trigger NLP processing
    await _processPublicationWithNLP(publication._id);

    res.status(201).json(publication);

  } catch (error) {
    logger.error('Error creating publication:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update publication
router.put('/:id', [
  auth,
  body('title').optional().notEmpty().withMessage('Title cannot be empty'),
  body('abstract').optional().isString(),
  body('publication_year').optional().isInt({ min: 1800, max: new Date().getFullYear() + 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const publication = await Publication.findById(req.params.id);
    if (!publication) {
      return res.status(404).json({ error: 'Publication not found' });
    }

    // Check for duplicate DOI if being updated
    if (req.body.doi && req.body.doi !== publication.doi) {
      const existingPub = await Publication.findOne({ doi: req.body.doi });
      if (existingPub) {
        return res.status(409).json({ error: 'Publication with this DOI already exists' });
      }
    }

    Object.assign(publication, req.body);
    publication.updated_at = new Date();
    await publication.save();

    // Re-trigger NLP processing if content changed
    if (req.body.title || req.body.abstract) {
      await _processPublicationWithNLP(publication._id);
    }

    res.json(publication);

  } catch (error) {
    logger.error('Error updating publication:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete publication
router.delete('/:id', auth, async (req, res) => {
  try {
    const publication = await Publication.findById(req.params.id);
    if (!publication) {
      return res.status(404).json({ error: 'Publication not found' });
    }

    // Soft delete
    publication.status = 'deleted';
    await publication.save();

    res.json({ message: 'Publication deleted successfully' });

  } catch (error) {
    logger.error('Error deleting publication:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search publications
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

    const publications = await Publication.search(query, filters)
      .populate('authors.author_id', 'full_name')
      .populate('topics.topic_id', 'name')
      .skip(skip)
      .limit(limit);

    const total = await Publication.countDocuments({
      $text: { $search: query }
    });

    res.json({
      publications,
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
    logger.error('Error searching publications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get trending publications
router.get('/trending/:days', async (req, res) => {
  try {
    const days = parseInt(req.params.days) || 30;
    const limit = parseInt(req.query.limit) || 20;

    const publications = await Publication.findTrending(days)
      .populate('authors.author_id', 'full_name')
      .populate('topics.topic_id', 'name')
      .limit(limit);

    res.json({
      publications,
      period_days: days,
      total: publications.length
    });

  } catch (error) {
    logger.error('Error fetching trending publications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get publications by author
router.get('/author/:authorId', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const publications = await Publication.findByAuthor(req.params.authorId)
      .populate('topics.topic_id', 'name')
      .skip(skip)
      .limit(limit);

    const total = await Publication.countDocuments({
      'authors.author_id': req.params.authorId,
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
    logger.error('Error fetching publications by author:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get publications by keyword
router.get('/keyword/:keyword', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const publications = await Publication.findByKeyword(req.params.keyword)
      .populate('authors.author_id', 'full_name')
      .populate('topics.topic_id', 'name')
      .skip(skip)
      .limit(limit);

    const total = await Publication.countDocuments({
      'keywords.term': { $regex: req.params.keyword, $options: 'i' },
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
    logger.error('Error fetching publications by keyword:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Import publication from external source (OpenAlex, Crossref, etc.)
router.post('/import', [
  auth,
  body('source').isIn(['openalex', 'crossref', 'arxiv', 'pubmed']),
  body('identifier').notEmpty().withMessage('Identifier is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { source, identifier } = req.body;

    let publicationData;
    switch (source) {
      case 'openalex':
        publicationData = await _importFromOpenAlex(identifier);
        break;
      case 'crossref':
        publicationData = await _importFromCrossref(identifier);
        break;
      case 'arxiv':
        publicationData = await _importFromArXiv(identifier);
        break;
      case 'pubmed':
        publicationData = await _importFromPubMed(identifier);
        break;
      default:
        return res.status(400).json({ error: 'Unsupported source' });
    }

    if (!publicationData) {
      return res.status(404).json({ error: 'Publication not found in external source' });
    }

    // Check for existing publication
    const existingPub = await Publication.findOne({
      $or: [
        { doi: publicationData.doi },
        { openalex_id: publicationData.openalex_id },
        { arxiv_id: publicationData.arxiv_id }
      ]
    });

    if (existingPub) {
      return res.status(409).json({ 
        error: 'Publication already exists',
        existingPublication: existingPub
      });
    }

    const publication = new Publication({
      ...publicationData,
      source: source,
      processing_status: 'pending'
    });

    await publication.save();

    // Trigger NLP processing
    await _processPublicationWithNLP(publication._id);

    res.status(201).json(publication);

  } catch (error) {
    logger.error('Error importing publication:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions
async function _processPublicationWithNLP(publicationId) {
  try {
    const publication = await Publication.findById(publicationId);
    if (!publication) return;

    const nlpServiceUrl = process.env.NLP_SERVICE_URL || 'http://localhost:5000';
    
    const response = await axios.post(`${nlpServiceUrl}/process/publication`, {
      title: publication.title,
      abstract: publication.abstract || '',
      full_text: publication.full_text || ''
    });

    if (response.data) {
      // Update publication with NLP results
      publication.keywords = response.data.keywords.combined || [];
      publication.sentiment_score = response.data.sentiment;
      publication.embeddings = {
        title_vector: response.data.embeddings.title,
        abstract_vector: response.data.embeddings.abstract,
        full_text_vector: response.data.embeddings.full_text,
        model_version: 'sentence-transformers',
        generated_at: new Date()
      };
      publication.processing_status = 'completed';
      await publication.save();
    }

  } catch (error) {
    logger.error('Error processing publication with NLP:', error);
    
    // Mark as failed
    await Publication.findByIdAndUpdate(publicationId, {
      processing_status: 'failed',
      processing_errors: [error.message]
    });
  }
}

async function _importFromOpenAlex(identifier) {
  try {
    const response = await axios.get(`${process.env.OPENALEX_API_URL}/works/${identifier}`);
    const work = response.data;
    
    return {
      title: work.title,
      abstract: work.abstract,
      publication_year: work.publication_year,
      doi: work.doi,
      openalex_id: work.id,
      authors: work.authorships?.map(authorship => ({
        author_id: null, // Would need to match/create author
        name: authorship.author.display_name,
        order: authorship.author_position
      })) || [],
      journal: work.primary_location?.source ? {
        name: work.primary_location.source.display_name,
        issn: work.primary_location.source.issn_l
      } : null,
      citations_count: work.cited_by_count,
      references_count: work.referenced_works?.length || 0,
      keywords: work.concepts?.map(concept => ({
        term: concept.display_name,
        weight: concept.score,
        source: 'openalex'
      })) || []
    };
  } catch (error) {
    logger.error('Error importing from OpenAlex:', error);
    return null;
  }
}

async function _importFromCrossref(identifier) {
  try {
    const response = await axios.get(`${process.env.CROSSREF_API_URL}/works/${identifier}`);
    const work = response.data.message;
    
    return {
      title: work.title?.[0],
      abstract: work.abstract,
      publication_year: work.published?.['date-parts']?.[0]?.[0],
      doi: work.DOI,
      authors: work.author?.map(author => ({
        author_id: null,
        name: `${author.given} ${author.family}`,
        order: author.sequence
      })) || [],
      journal: work['container-title']?.[0] ? {
        name: work['container-title'][0]
      } : null,
      citations_count: work['is-referenced-by-count'] || 0,
      references_count: work.reference?.length || 0
    };
  } catch (error) {
    logger.error('Error importing from Crossref:', error);
    return null;
  }
}

async function _importFromArXiv(identifier) {
  try {
    const response = await axios.get(`http://export.arxiv.org/api/query?id_list=${identifier}`);
    // Parse XML response and convert to our format
    // This is a simplified version - would need proper XML parsing
    return null;
  } catch (error) {
    logger.error('Error importing from ArXiv:', error);
    return null;
  }
}

async function _importFromPubMed(identifier) {
  try {
    // PubMed API integration
    // This is a placeholder - would need actual PubMed API integration
    return null;
  } catch (error) {
    logger.error('Error importing from PubMed:', error);
    return null;
  }
}

module.exports = router;
