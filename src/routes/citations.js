const express = require('express');
const router = express.Router();
const Citation = require('../models/Citation');
const Publication = require('../models/Publication');
const Author = require('../models/Author');
const { auth } = require('../middleware/auth');
const { body, validationResult, query } = require('express-validator');
const logger = require('../utils/logger');

// Get all citations with pagination and filtering
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('citingPublicationId').optional().isMongoId(),
  query('citedPublicationId').optional().isMongoId(),
  query('citationType').optional().isIn(['supporting', 'contradicting', 'mentioning', 'background', 'methodology', 'comparison']),
  query('sentiment').optional().isIn(['positive', 'negative', 'neutral']),
  query('selfCitation').optional().isBoolean(),
  query('minConfidence').optional().isFloat({ min: 0, max: 1 }),
  query('sortBy').optional().isIn(['created_at', 'citation_year', 'confidence_score', 'semantic_similarity']),
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
    const query = {};

    // Apply filters
    if (req.query.citingPublicationId) {
      query.citing_publication_id = req.query.citingPublicationId;
    }

    if (req.query.citedPublicationId) {
      query.cited_publication_id = req.query.citedPublicationId;
    }

    if (req.query.citationType) {
      query.citation_type = req.query.citationType;
    }

    if (req.query.sentiment) {
      query.sentiment = req.query.sentiment;
    }

    if (req.query.selfCitation !== undefined) {
      query.self_citation = req.query.selfCitation === 'true';
    }

    if (req.query.minConfidence) {
      query.confidence_score = { $gte: parseFloat(req.query.minConfidence) };
    }

    // Sorting
    const sortField = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sort = {};
    sort[sortField] = sortOrder;

    // Execute query
    const citations = await Citation.find(query)
      .populate('citing_publication_id', 'title authors publication_year')
      .populate('cited_publication_id', 'title authors publication_year')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Citation.countDocuments(query);

    res.json({
      citations,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });

  } catch (error) {
    logger.error('Error fetching citations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get citation by ID
router.get('/:id', async (req, res) => {
  try {
    const citation = await Citation.findById(req.params.id)
      .populate('citing_publication_id', 'title authors publication_year journal.name')
      .populate('cited_publication_id', 'title authors publication_year journal.name');

    if (!citation) {
      return res.status(404).json({ error: 'Citation not found' });
    }

    res.json(citation);

  } catch (error) {
    logger.error('Error fetching citation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new citation
router.post('/', [
  auth,
  body('citing_publication_id').isMongoId().withMessage('Valid citing publication ID is required'),
  body('cited_publication_id').isMongoId().withMessage('Valid cited publication ID is required'),
  body('citation_text').optional().isString(),
  body('citation_type').optional().isIn(['supporting', 'contradicting', 'mentioning', 'background', 'methodology', 'comparison']),
  body('citation_position').optional().isIn(['introduction', 'methodology', 'results', 'discussion', 'conclusion', 'references'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { citing_publication_id, cited_publication_id } = req.body;

    // Check if publications exist
    const citingPub = await Publication.findById(citing_publication_id);
    const citedPub = await Publication.findById(cited_publication_id);

    if (!citingPub || !citedPub) {
      return res.status(404).json({ error: 'One or both publications not found' });
    }

    // Check for duplicate citation
    const existingCitation = await Citation.findOne({
      citing_publication_id,
      cited_publication_id
    });

    if (existingCitation) {
      return res.status(409).json({ error: 'Citation already exists' });
    }

    const citationData = {
      ...req.body,
      source: 'manual',
      processing_status: 'pending'
    };

    const citation = new Citation(citationData);
    await citation.save();

    // Trigger citation analysis
    await _analyzeCitationWithNLP(citation._id);

    // Update citation counts in publications
    await _updatePublicationCitationCounts(citing_publication_id, cited_publication_id);

    res.status(201).json(citation);

  } catch (error) {
    logger.error('Error creating citation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update citation
router.put('/:id', [
  auth,
  body('citation_text').optional().isString(),
  body('citation_type').optional().isIn(['supporting', 'contradicting', 'mentioning', 'background', 'methodology', 'comparison']),
  body('citation_position').optional().isIn(['introduction', 'methodology', 'results', 'discussion', 'conclusion', 'references'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const citation = await Citation.findById(req.params.id);
    if (!citation) {
      return res.status(404).json({ error: 'Citation not found' });
    }

    Object.assign(citation, req.body);
    citation.updated_at = new Date();
    await citation.save();

    // Re-trigger NLP analysis if text changed
    if (req.body.citation_text) {
      await _analyzeCitationWithNLP(citation._id);
    }

    res.json(citation);

  } catch (error) {
    logger.error('Error updating citation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete citation
router.delete('/:id', auth, async (req, res) => {
  try {
    const citation = await Citation.findById(req.params.id);
    if (!citation) {
      return res.status(404).json({ error: 'Citation not found' });
    }

    const { citing_publication_id, cited_publication_id } = citation;

    await Citation.findByIdAndDelete(req.params.id);

    // Update citation counts in publications
    await _updatePublicationCitationCountsAfterDeletion(citing_publication_id, cited_publication_id);

    res.json({ message: 'Citation deleted successfully' });

  } catch (error) {
    logger.error('Error deleting citation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get citations for a publication (cited by)
router.get('/publication/:publicationId/cited-by', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const citations = await Citation.findByCitedPublication(req.params.publicationId)
      .sort({ citation_year: -1, created_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Citation.countDocuments({
      cited_publication_id: req.params.publicationId
    });

    res.json({
      citations,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });

  } catch (error) {
    logger.error('Error fetching cited-by citations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get citations for a publication (citing)
router.get('/publication/:publicationId/citing', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const citations = await Citation.findByCitingPublication(req.params.publicationId)
      .sort({ citation_year: -1, created_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Citation.countDocuments({
      citing_publication_id: req.params.publicationId
    });

    res.json({
      citations,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });

  } catch (error) {
    logger.error('Error fetching citing citations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get citation network for a publication
router.get('/publication/:publicationId/network', async (req, res) => {
  try {
    const depth = parseInt(req.query.depth) || 2;

    const network = await Citation.findCitationNetwork(req.params.publicationId, depth);

    res.json({
      publication_id: req.params.publicationId,
      network,
      depth
    });

  } catch (error) {
    logger.error('Error fetching citation network:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get self-citations for an author
router.get('/author/:authorId/self-citations', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const selfCitations = await Citation.findSelfCitations(req.params.authorId)
      .skip(skip)
      .limit(limit);

    const total = await Citation.countDocuments({
      self_citation: true
    });

    res.json({
      self_citations: selfCitations,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });

  } catch (error) {
    logger.error('Error fetching self-citations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get citation metrics for a publication
router.get('/publication/:publicationId/metrics', async (req, res) => {
  try {
    const metrics = await Citation.getCitationMetrics(req.params.publicationId);

    res.json({
      publication_id: req.params.publicationId,
      metrics
    });

  } catch (error) {
    logger.error('Error fetching citation metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get bibliographic coupling for a publication
router.get('/publication/:publicationId/bibliographic-coupling', async (req, res) => {
  try {
    const threshold = parseFloat(req.query.threshold) || 0.1;

    const coupling = await Citation.findBibliographicCoupling(req.params.publicationId, threshold);

    res.json({
      publication_id: req.params.publicationId,
      bibliographic_coupling: coupling,
      threshold
    });

  } catch (error) {
    logger.error('Error fetching bibliographic coupling:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Analyze citation relationship
router.post('/analyze', [
  auth,
  body('citing_text').notEmpty().withMessage('Citing text is required'),
  body('cited_text').notEmpty().withMessage('Cited text is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { citing_text, cited_text } = req.body;

    const nlpServiceUrl = process.env.NLP_SERVICE_URL || 'http://localhost:5000';
    
    const response = await axios.post(`${nlpServiceUrl}/analyze/citations`, {
      citing_text,
      cited_text
    });

    res.json(response.data);

  } catch (error) {
    logger.error('Error analyzing citation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Batch create citations
router.post('/batch', [
  auth,
  body('citations').isArray().withMessage('Citations array is required'),
  body('citations.*.citing_publication_id').isMongoId(),
  body('citations.*.cited_publication_id').isMongoId()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { citations } = req.body;
    const results = [];

    for (let i = 0; i < citations.length; i++) {
      try {
        const citationData = {
          ...citations[i],
          source: 'manual',
          processing_status: 'pending'
        };

        // Check for duplicate
        const existing = await Citation.findOne({
          citing_publication_id: citationData.citing_publication_id,
          cited_publication_id: citationData.cited_publication_id
        });

        if (existing) {
          results.push({
            index: i,
            status: 'duplicate',
            citation_id: existing._id
          });
          continue;
        }

        const citation = new Citation(citationData);
        await citation.save();

        // Trigger analysis
        await _analyzeCitationWithNLP(citation._id);

        results.push({
          index: i,
          status: 'success',
          citation_id: citation._id
        });

      } catch (error) {
        results.push({
          index: i,
          status: 'error',
          error: error.message
        });
      }
    }

    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;
    const duplicates = results.filter(r => r.status === 'duplicate').length;

    res.status(201).json({
      results,
      summary: {
        total: citations.length,
        successful,
        failed,
        duplicates
      }
    });

  } catch (error) {
    logger.error('Error creating batch citations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update citation verification status
router.put('/:id/verify', [
  auth,
  body('verification_status').isIn(['verified', 'unverified', 'disputed']),
  body('notes').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const citation = await Citation.findById(req.params.id);
    if (!citation) {
      return res.status(404).json({ error: 'Citation not found' });
    }

    await citation.updateVerificationStatus(
      req.body.verification_status,
      req.user.id
    );

    if (req.body.notes) {
      citation.validation_notes = req.body.notes;
      await citation.save();
    }

    res.json({
      message: 'Citation verification status updated',
      verification_status: citation.verification_status
    });

  } catch (error) {
    logger.error('Error updating citation verification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions
async function _analyzeCitationWithNLP(citationId) {
  try {
    const citation = await Citation.findById(citationId)
      .populate('citing_publication_id', 'title abstract')
      .populate('cited_publication_id', 'title abstract');

    if (!citation) return;

    const nlpServiceUrl = process.env.NLP_SERVICE_URL || 'http://localhost:5000';
    
    const citingText = citation.citation_text || 
      `${citation.citing_publication_id?.title} ${citation.citing_publication_id?.abstract}`;
    const citedText = citation.cited_publication_id?.title || '';

    const response = await axios.post(`${nlpServiceUrl}/analyze/citations`, {
      citing_text: citingText,
      cited_text: citedText
    });

    if (response.data) {
      citation.semantic_similarity = response.data.similarity_score;
      citation.citation_type = response.data.citation_type;
      citation.sentiment = response.data.sentiment;
      citation.processing_status = 'completed';
      await citation.save();
    }

  } catch (error) {
    logger.error('Error analyzing citation with NLP:', error);
    
    await Citation.findByIdAndUpdate(citationId, {
      processing_status: 'failed',
      processing_errors: [error.message]
    });
  }
}

async function _updatePublicationCitationCounts(citingPublicationId, citedPublicationId) {
  try {
    // Update cited publication's citations count
    const citedCount = await Citation.countDocuments({
      cited_publication_id: citedPublicationId
    });

    await Publication.findByIdAndUpdate(citedPublicationId, {
      citations_count: citedCount,
      last_cited_at: new Date()
    });

    // Update citing publication's references count
    const citingCount = await Citation.countDocuments({
      citing_publication_id: citingPublicationId
    });

    await Publication.findByIdAndUpdate(citingPublicationId, {
      references_count: citingCount
    });

  } catch (error) {
    logger.error('Error updating publication citation counts:', error);
  }
}

async function _updatePublicationCitationCountsAfterDeletion(citingPublicationId, citedPublicationId) {
  try {
    // Update cited publication's citations count
    const citedCount = await Citation.countDocuments({
      cited_publication_id: citedPublicationId
    });

    await Publication.findByIdAndUpdate(citedPublicationId, {
      citations_count: citedCount
    });

    // Update citing publication's references count
    const citingCount = await Citation.countDocuments({
      citing_publication_id: citingPublicationId
    });

    await Publication.findByIdAndUpdate(citingPublicationId, {
      references_count: citingCount
    });

  } catch (error) {
    logger.error('Error updating publication citation counts after deletion:', error);
  }
}

module.exports = router;
