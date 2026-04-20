const express = require('express');
const router = express.Router();
const Publication = require('../models/Publication');
const Author = require('../models/Author');
const Citation = require('../models/Citation');
const Topic = require('../models/Topic');
const auth = require('../middleware/auth');
const { query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

// Get dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalPublications,
      totalAuthors,
      totalCitations,
      totalTopics
    ] = await Promise.all([
      Publication.countDocuments({ status: 'published' }),
      Author.countDocuments({ status: 'active' }),
      Citation.countDocuments(),
      Topic.countDocuments({ validation_status: 'validated' })
    ]);

    // Get recent activity
    const recentPublications = await Publication.find({ status: 'published' })
      .sort({ created_at: -1 })
      .limit(5)
      .select('title created_at');

    const topAuthors = await Author.find({ status: 'active' })
      .sort({ h_index: -1 })
      .limit(5)
      .select('full_name h_index total_citations');

    const topPublications = await Publication.find({ status: 'published' })
      .sort({ citations_count: -1 })
      .limit(5)
      .select('title citations_count');

    // Get trending topics
    const trendingTopics = await Topic.find({
      trend_direction: { $in: ['emerging', 'growing'] }
    })
      .sort({ popularity_score: -1 })
      .limit(5)
      .select('name popularity_score total_publications');

    res.json({
      overview: {
        total_publications: totalPublications,
        total_authors: totalAuthors,
        total_citations: totalCitations,
        total_topics: totalTopics
      },
      recent_activity: {
        recent_publications: recentPublications,
        top_authors: topAuthors,
        top_publications: topPublications,
        trending_topics: trendingTopics
      }
    });

  } catch (error) {
    logger.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get publication trends over time
router.get('/publications/trends', [
  query('period').optional().isIn(['year', 'month', 'quarter']),
  query('years').optional().isString() // comma-separated years
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const period = req.query.period || 'year';
    const years = req.query.years ? 
      req.query.years.split(',').map(y => parseInt(y)) :
      [new Date().getFullYear() - 4, new Date().getFullYear() - 3, new Date().getFullYear() - 2, new Date().getFullYear() - 1, new Date().getFullYear()];

    let groupFormat;
    switch (period) {
      case 'month':
        groupFormat = { $dateToString: { format: "%Y-%m", date: "$created_at" } };
        break;
      case 'quarter':
        groupFormat = { 
          $dateToString: { 
            format: "%Y-Q", 
            date: "$created_at" 
          } 
        };
        break;
      default:
        groupFormat = { $dateToString: { format: "%Y", date: "$created_at" } };
    }

    const trends = await Publication.aggregate([
      {
        $match: {
          status: 'published',
          created_at: {
            $gte: new Date(`${Math.min(...years)}-01-01`),
            $lte: new Date(`${Math.max(...years)}-12-31`)
          }
        }
      },
      {
        $group: {
          _id: groupFormat,
          count: { $sum: 1 },
          total_citations: { $sum: "$citations_count" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      trends,
      period,
      years
    });

  } catch (error) {
    logger.error('Error fetching publication trends:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get citation trends over time
router.get('/citations/trends', [
  query('period').optional().isIn(['year', 'month', 'quarter']),
  query('years').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const period = req.query.period || 'year';
    const years = req.query.years ? 
      req.query.years.split(',').map(y => parseInt(y)) :
      [new Date().getFullYear() - 4, new Date().getFullYear() - 3, new Date().getFullYear() - 2, new Date().getFullYear() - 1, new Date().getFullYear()];

    let groupFormat;
    switch (period) {
      case 'month':
        groupFormat = { $dateToString: { format: "%Y-%m", date: "$created_at" } };
        break;
      case 'quarter':
        groupFormat = { 
          $dateToString: { 
            format: "%Y-Q", 
            date: "$created_at" 
          } 
        };
        break;
      default:
        groupFormat = { $dateToString: { format: "%Y", date: "$created_at" } };
    }

    const trends = await Citation.aggregate([
      {
        $match: {
          created_at: {
            $gte: new Date(`${Math.min(...years)}-01-01`),
            $lte: new Date(`${Math.max(...years)}-12-31`)
          }
        }
      },
      {
        $group: {
          _id: groupFormat,
          count: { $sum: 1 },
          unique_citing_papers: { $addToSet: "$citing_publication_id" },
          unique_cited_papers: { $addToSet: "$cited_publication_id" }
        }
      },
      {
        $addFields: {
          unique_citing_count: { $size: "$unique_citing_papers" },
          unique_cited_count: { $size: "$unique_cited_papers" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      trends,
      period,
      years
    });

  } catch (error) {
    logger.error('Error fetching citation trends:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get topic trends and analysis
router.get('/topics/trends', [
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('sortBy').optional().isIn(['total_publications', 'total_citations', 'popularity_score'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const limit = parseInt(req.query.limit) || 20;
    const sortBy = req.query.sortBy || 'total_publications';

    const trends = await Topic.findTrendingTopics(limit)
      .select('name category total_publications total_citations popularity_score trend_direction');

    // Get topic distribution by category
    const categoryDistribution = await Topic.aggregate([
      {
        $match: { validation_status: 'validated' }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          total_publications: { $sum: '$total_publications' },
          total_citations: { $sum: '$total_citations' }
        }
      },
      { $sort: { total_publications: -1 } }
    ]);

    res.json({
      trending_topics: trends,
      category_distribution: categoryDistribution
    });

  } catch (error) {
    logger.error('Error fetching topic trends:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get author productivity metrics
router.get('/authors/productivity', [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('metric').optional().isIn(['total_publications', 'total_citations', 'h_index', 'publications_per_year'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const limit = parseInt(req.query.limit) || 50;
    const metric = req.query.metric || 'total_publications';

    const sort = {};
    sort[metric] = -1;

    const authors = await Author.find({ status: 'active' })
      .select('full_name total_publications total_citations h_index years_active affiliations.name')
      .sort(sort)
      .limit(limit);

    // Calculate additional metrics
    const authorsWithMetrics = authors.map(author => ({
      ...author.toObject(),
      publications_per_year: author.publications_per_year,
      citations_per_publication: author.citations_per_publication
    }));

    res.json({
      authors: authorsWithMetrics,
      metric,
      total: authors.length
    });

  } catch (error) {
    logger.error('Error fetching author productivity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get collaboration network analysis
router.get('/collaborations/network', [
  query('minCollaborations').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const minCollaborations = parseInt(req.query.minCollaborations) || 5;
    const limit = parseInt(req.query.limit) || 50;

    // Get authors with high collaboration counts
    const collaborativeAuthors = await Author.find({
      status: 'active',
      'collaborators.0': { $exists: true }
    })
      .select('full_name collaborators')
      .lean();

    // Build network data
    const nodes = [];
    const edges = [];
    const authorMap = new Map();

    collaborativeAuthors.forEach(author => {
      if (author.collaborators.length >= minCollaborations) {
        const nodeId = author._id.toString();
        authorMap.set(nodeId, author.full_name);
        
        nodes.push({
          id: nodeId,
          name: author.full_name,
          collaboration_count: author.collaborators.length
        });

        author.collaborators.forEach(collaborator => {
          if (collaborator.author_id && collaborator.collaboration_count >= minCollaborations) {
            const collaboratorId = collaborator.author_id.toString();
            
            edges.push({
              source: nodeId,
              target: collaboratorId,
              weight: collaborator.collaboration_count,
              last_collaboration_year: collaborator.last_collaboration_year
            });
          }
        });
      }
    });

    // Limit results
    const limitedNodes = nodes.slice(0, limit);
    const nodeIds = new Set(limitedNodes.map(n => n.id));
    const limitedEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

    res.json({
      nodes: limitedNodes,
      edges: limitedEdges,
      metrics: {
        total_nodes: limitedNodes.length,
        total_edges: limitedEdges.length,
        min_collaborations: minCollaborations
      }
    });

  } catch (error) {
    logger.error('Error fetching collaboration network:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get geographic distribution analysis
router.get('/geographic/distribution', [
  query('type').optional().isIn(['authors', 'publications', 'citations']),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const type = req.query.type || 'authors';
    const limit = parseInt(req.query.limit) || 20;

    let distribution = [];

    switch (type) {
      case 'authors':
        distribution = await Author.aggregate([
          { $match: { status: 'active', country: { $exists: true, $ne: null } } },
          {
            $group: {
              _id: '$country',
              count: { $sum: 1 },
              total_citations: { $sum: '$total_citations' },
              avg_h_index: { $avg: '$h_index' }
            }
          },
          { $sort: { count: -1 } },
          { $limit: limit }
        ]);
        break;

      case 'publications':
        distribution = await Publication.aggregate([
          { $match: { status: 'published' } },
          { $unwind: '$authors' },
          {
            $lookup: {
              from: 'authors',
              localField: 'authors.author_id',
              foreignField: '_id',
              as: 'author_info'
            }
          },
          { $unwind: '$author_info' },
          {
            $group: {
              _id: '$author_info.country',
              count: { $sum: 1 },
              total_citations: { $sum: '$citations_count' }
            }
          },
          { $match: { _id: { $exists: true, $ne: null } } },
          { $sort: { count: -1 } },
          { $limit: limit }
        ]);
        break;

      case 'citations':
        distribution = await Citation.aggregate([
          {
            $lookup: {
              from: 'publications',
              localField: 'citing_publication_id',
              foreignField: '_id',
              as: 'citing_pub'
            }
          },
          { $unwind: '$citing_pub' },
          { $unwind: '$citing_pub.authors' },
          {
            $lookup: {
              from: 'authors',
              localField: 'citing_pub.authors.author_id',
              foreignField: '_id',
              as: 'author_info'
            }
          },
          { $unwind: '$author_info' },
          {
            $group: {
              _id: '$author_info.country',
              count: { $sum: 1 }
            }
          },
          { $match: { _id: { $exists: true, $ne: null } } },
          { $sort: { count: -1 } },
          { $limit: limit }
        ]);
        break;
    }

    res.json({
      type,
      distribution: distribution.map(item => ({
        country: item._id,
        count: item.count,
        total_citations: item.total_citations || 0,
        avg_h_index: item.avg_h_index || 0
      }))
    });

  } catch (error) {
    logger.error('Error fetching geographic distribution:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get journal/conference analysis
router.get('/venues/analysis', [
  query('type').optional().isIn(['journals', 'conferences']),
  query('metric').optional().isIn(['publications', 'citations', 'impact']),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const type = req.query.type || 'journals';
    const metric = req.query.metric || 'publications';
    const limit = parseInt(req.query.limit) || 20;

    let venueField = type === 'journals' ? 'journal.name' : 'conference.name';

    const analysis = await Publication.aggregate([
      { $match: { status: 'published', [venueField]: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: `$${venueField}`,
          publication_count: { $sum: 1 },
          total_citations: { $sum: '$citations_count' },
          avg_citations: { $avg: '$citations_count' },
          unique_authors: { $addToSet: '$authors.author_id' }
        }
      },
      {
        $addFields: {
          unique_author_count: { $size: '$unique_authors' }
        }
      },
      { $sort: { [metric === 'impact' ? 'avg_citations' : `${metric}_count`]: -1 } },
      { $limit: limit }
    ]);

    res.json({
      type,
      metric,
      venues: analysis.map(item => ({
        name: item._id,
        publication_count: item.publication_count,
        total_citations: item.total_citations,
        avg_citations: Math.round(item.avg_citations * 100) / 100,
        unique_authors: item.unique_author_count
      }))
    });

  } catch (error) {
    logger.error('Error fetching venue analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get citation impact analysis
router.get('/citations/impact', [
  query('timeframe').optional().isIn(['1year', '3years', '5years', '10years']),
  query('minCitations').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const timeframe = req.query.timeframe || '5years';
    const minCitations = parseInt(req.query.minCitations) || 10;

    // Calculate date range
    const years = parseInt(timeframe.replace('years', '').replace('year', ''));
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - years);

    // Get high-impact publications
    const highImpactPubs = await Publication.find({
      status: 'published',
      publication_date: { $gte: cutoffDate },
      citations_count: { $gte: minCitations }
    })
      .select('title citations_count publication_year authors')
      .populate('authors.author_id', 'full_name')
      .sort({ citations_count: -1 })
      .limit(100);

    // Calculate impact metrics
    const totalHighImpact = highImpactPubs.length;
    const avgCitations = highImpactPubs.reduce((sum, pub) => sum + pub.citations_count, 0) / totalHighImpact;

    // Get top contributing authors
    const authorContributions = new Map();
    highImpactPubs.forEach(pub => {
      pub.authors.forEach(author => {
        const authorName = author.author_id?.full_name || 'Unknown';
        authorContributions.set(authorName, (authorContributions.get(authorName) || 0) + 1);
      });
    });

    const topAuthors = Array.from(authorContributions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ author_name: name, high_impact_pubs: count }));

    res.json({
      timeframe,
      min_citations: minCitations,
      metrics: {
        total_high_impact_publications: totalHighImpact,
        average_citations: Math.round(avgCitations * 100) / 100,
        cutoff_date: cutoffDate
      },
      top_contributing_authors: topAuthors,
      sample_publications: highImpactPubs.slice(0, 10)
    });

  } catch (error) {
    logger.error('Error fetching citation impact:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get research trends and predictions
router.get('/research/trends', [
  query('years').optional().isInt({ min: 1, max: 20 }),
  query('topicCount').optional().isInt({ min: 5, max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const years = parseInt(req.query.years) || 5;
    const topicCount = parseInt(req.query.topicCount) || 20;

    // Get topic trends over years
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - years + 1;

    const topicTrends = await Topic.aggregate([
      {
        $match: {
          validation_status: 'validated',
          emergence_year: { $gte: startYear }
        }
      },
      {
        $group: {
          _id: '$emergence_year',
          topics: { $push: '$name' },
          count: { $sum: 1 },
          avg_popularity: { $avg: '$popularity_score' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get emerging topics
    const emergingTopics = await Topic.find({
      trend_direction: 'emerging',
      validation_status: 'validated'
    })
      .sort({ popularity_score: -1 })
      .limit(topicCount)
      .select('name category popularity_score total_publications emergence_year');

    // Get declining topics
    const decliningTopics = await Topic.find({
      trend_direction: 'declining',
      validation_status: 'validated'
    })
      .sort({ popularity_score: -1 })
      .limit(topicCount / 2)
      .select('name category popularity_score total_publications peak_year');

    res.json({
      analysis_period: {
        start_year: startYear,
        end_year: currentYear,
        years: years
      },
      topic_trends: topicTrends,
      emerging_topics: emergingTopics,
      declining_topics: decliningTopics
    });

  } catch (error) {
    logger.error('Error fetching research trends:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
