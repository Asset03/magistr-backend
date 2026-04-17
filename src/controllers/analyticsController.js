const Publication = require('../models/Publication');
const User = require('../models/User');
const AuthorProfile = require('../models/Author');

// Get comprehensive analytics data
const getAnalyticsData = async (req, res, next) => {
  try {
    const timeRange = req.query.timeRange || 'year'; // year, month, week, all
    
    let dateFilter = {};
    const now = new Date();
    
    if (timeRange === 'year') {
      dateFilter.createdAt = { $gte: new Date(now.getFullYear(), 0, 1) };
    } else if (timeRange === 'month') {
      dateFilter.createdAt = { $gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    } else if (timeRange === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter.createdAt = { $gte: weekAgo };
    }

    // Publication metrics
    const publicationMetrics = await Publication.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalPublications: { $sum: 1 },
          totalCitations: { $sum: '$citationsCount' },
          avgCitationsPerPublication: { $avg: '$citationsCount' },
          totalViews: { $sum: '$metrics.views' },
          totalDownloads: { $sum: '$metrics.downloads' }
        }
      }
    ]);

    // Author metrics
    const authorMetrics = await User.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: 'publications',
          localField: '_id',
          foreignField: 'authors.author',
          as: 'publications'
        }
      },
      {
        $group: {
          _id: null,
          totalAuthors: { $sum: 1 },
          avgPublicationsPerAuthor: { $avg: { $size: '$publications' } }
        }
      }
    ]);

    // Publication type distribution
    const publicationTypes = await Publication.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$publicationType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Access type distribution
    const accessTypes = await Publication.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$accessType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Language distribution
    const languages = await Publication.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$language',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const analyticsData = {
      publicationMetrics: publicationMetrics[0] || {},
      authorMetrics: authorMetrics[0] || {},
      publicationTypes,
      accessTypes,
      languages
    };

    res.json({
      success: true,
      data: analyticsData
    });
  } catch (error) {
    next(error);
  }
};

// Get publication trends over time
const getPublicationTrends = async (req, res, next) => {
  try {
    const period = req.query.period || 'month'; // day, week, month, year
    const years = parseInt(req.query.years) || 5;

    let groupFormat;
    if (period === 'day') {
      groupFormat = '%Y-%m-%d';
    } else if (period === 'week') {
      groupFormat = '%Y-%U';
    } else if (period === 'month') {
      groupFormat = '%Y-%m';
    } else if (period === 'year') {
      groupFormat = '%Y';
    }

    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - years);

    const trends = await Publication.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
          publications: { $sum: 1 },
          citations: { $sum: '$citationsCount' },
          views: { $sum: '$metrics.views' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    next(error);
  }
};

// Get topic distribution
const getTopicDistribution = async (req, res, next) => {
  try {
    const timeRange = req.query.timeRange || 'year';
    
    let dateFilter = {};
    const now = new Date();
    
    if (timeRange === 'year') {
      dateFilter.createdAt = { $gte: new Date(now.getFullYear(), 0, 1) };
    } else if (timeRange === 'month') {
      dateFilter.createdAt = { $gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    }

    const topics = await Publication.aggregate([
      { $match: { ...dateFilter, topics: { $exists: true, $ne: [] } } },
      { $unwind: '$topics' },
      {
        $group: {
          _id: '$topics.name',
          count: { $sum: 1 },
          avgWeight: { $avg: '$topics.weight' },
          totalCitations: { $sum: '$citationsCount' },
          keywords: { $addToSet: '$topics.keywords' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 50 }
    ]);

    res.json({
      success: true,
      data: topics
    });
  } catch (error) {
    next(error);
  }
};

// Get author collaboration network
const getAuthorNetwork = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const minCollaborations = parseInt(req.query.minCollaborations) || 2;

    // Find collaboration pairs
    const collaborations = await Publication.aggregate([
      { $match: { 'authors.1': { $exists: true } } }, // Publications with at least 2 authors
      { $unwind: '$authors' },
      { $group: {
        _id: '$_id',
        authors: { $push: '$authors.author' }
      }},
      { $unwind: '$authors' },
      { $unwind: '$authors' },
      { $group: {
        _id: '$authors',
        coauthors: { $addToSet: '$authors' }
      }},
      { $unwind: '$coauthors' },
      { $match: { $ne: ['$_id', '$coauthors'] } },
      { $group: {
        _id: { author1: '$_id', author2: '$coauthors' },
        collaborationCount: { $sum: 1 }
      }},
      { $match: { collaborationCount: { $gte: minCollaborations } } },
      { $sort: { collaborationCount: -1 } },
      { $limit: limit }
    ]);

    // Get author details
    const authorIds = new Set();
    collaborations.forEach(collab => {
      authorIds.add(collab._id.author1);
      authorIds.add(collab._id.author2);
    });

    const authors = await User.find({
      _id: { $in: Array.from(authorIds) },
      isActive: true
    }).select('name email affiliation');

    const authorMap = {};
    authors.forEach(author => {
      authorMap[author._id] = author;
    });

    // Format network data
    const nodes = authors.map(author => ({
      id: author._id,
      name: author.name,
      affiliation: author.affiliation
    }));

    const links = collaborations.map(collab => ({
      source: collab._id.author1,
      target: collab._id.author2,
      weight: collab.collaborationCount
    }));

    res.json({
      success: true,
      data: {
        nodes,
        links
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get citation network
const getCitationNetwork = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const minCitations = parseInt(req.query.minCitations) || 5;

    // Find publications with significant citations
    const publications = await Publication.find({
      citationsCount: { $gte: minCitations }
    })
    .select('_id title citationsCount authors')
    .populate('authors.author', 'name')
    .limit(limit);

    // Get citation relationships
    const publicationIds = publications.map(pub => pub._id);
    
    const citationLinks = await Publication.find({
      _id: { $in: publicationIds },
      references: { $in: publicationIds }
    })
    .select('_id references');

    const links = [];
    citationLinks.forEach(pub => {
      pub.references.forEach(refId => {
        if (publicationIds.includes(refId)) {
          links.push({
            source: pub._id,
            target: refId,
            weight: 1
          });
        }
      });
    });

    const nodes = publications.map(pub => ({
      id: pub._id,
      title: pub.title,
      citationsCount: pub.citationsCount,
      authors: pub.authors.map(author => author.author.name).join(', ')
    }));

    res.json({
      success: true,
      data: {
        nodes,
        links
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get journal impact metrics
const getJournalMetrics = async (req, res, next) => {
  try {
    const timeRange = req.query.timeRange || 'year';
    
    let dateFilter = {};
    const now = new Date();
    
    if (timeRange === 'year') {
      dateFilter.createdAt = { $gte: new Date(now.getFullYear(), 0, 1) };
    } else if (timeRange === 'month') {
      dateFilter.createdAt = { $gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    }

    const journalMetrics = await Publication.aggregate([
      { $match: { ...dateFilter, 'journal.name': { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: '$journal.name',
          publicationCount: { $sum: 1 },
          totalCitations: { $sum: '$citationsCount' },
          avgCitationsPerPublication: { $avg: '$citationsCount' },
          totalViews: { $sum: '$metrics.views' },
          uniqueAuthors: { $addToSet: '$authors.author' }
        }
      },
      {
        $addFields: {
          uniqueAuthorCount: { $size: '$uniqueAuthors' }
        }
      },
      {
        $project: {
          uniqueAuthors: 0 // Remove the array from output
        }
      },
      { $sort: { totalCitations: -1 } },
      { $limit: 50 }
    ]);

    res.json({
      success: true,
      data: journalMetrics
    });
  } catch (error) {
    next(error);
  }
};

// Get research productivity metrics
const getProductivityMetrics = async (req, res, next) => {
  try {
    const period = req.query.period || 'year'; // year, quarter, month
    
    let groupFormat;
    if (period === 'year') {
      groupFormat = '%Y';
    } else if (period === 'quarter') {
      groupFormat = {
        $concat: [
          { $toString: { $year: '$publicationYear' } },
          '-Q',
          { $toString: { $ceil: { $divide: [{ $month: { $dateFromString: { dateString: { $toString: '$publicationYear' } } } }, 3] } } }
        ]
      };
    } else if (period === 'month') {
      groupFormat = '%Y-%m';
    }

    const productivityMetrics = await Publication.aggregate([
      {
        $group: {
          _id: period === 'quarter' ? groupFormat : { $dateToString: { format: groupFormat, date: '$createdAt' } },
          publicationCount: { $sum: 1 },
          uniqueAuthors: { $addToSet: '$authors.author' },
          avgCitations: { $avg: '$citationsCount' }
        }
      },
      {
        $addFields: {
          uniqueAuthorCount: { $size: '$uniqueAuthors' }
        }
      },
      {
        $project: {
          uniqueAuthors: 0
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: productivityMetrics
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnalyticsData,
  getPublicationTrends,
  getTopicDistribution,
  getAuthorNetwork,
  getCitationNetwork,
  getJournalMetrics,
  getProductivityMetrics
};
