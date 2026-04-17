const Publication = require('../models/Publication');
const User = require('../models/User');
const AuthorProfile = require('../models/Author');

// Get dashboard statistics
const getDashboardStats = async (req, res, next) => {
  try {
    // Total publications
    const totalPublications = await Publication.countDocuments();
    
    // Total authors
    const totalAuthors = await User.countDocuments({ isActive: true });
    
    // Total citations
    const totalCitations = await Publication.aggregate([
      { $group: { _id: null, total: { $sum: '$citationsCount' } } }
    ]);
    
    // Publications by year
    const publicationsByYear = await Publication.aggregate([
      {
        $group: {
          _id: '$publicationYear',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Top journals
    const topJournals = await Publication.aggregate([
      { $match: { 'journal.name': { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: '$journal.name',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Recent publications
    const recentPublications = await Publication.find()
      .populate('authors.author', 'name email affiliation')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        totalPublications,
        totalAuthors,
        totalCitations: totalCitations[0]?.total || 0,
        publicationsByYear,
        topJournals,
        recentPublications
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get recent publications
const getRecentPublications = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const publications = await Publication.find()
      .populate('authors.author', 'name email affiliation')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      data: publications
    });
  } catch (error) {
    next(error);
  }
};

// Get top authors
const getTopAuthors = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'publications'; // publications, citations, hIndex

    let pipeline = [];

    if (sortBy === 'publications') {
      pipeline = [
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
          $project: {
            name: 1,
            email: 1,
            affiliation: 1,
            role: 1,
            publicationCount: { $size: '$publications' }
          }
        },
        { $sort: { publicationCount: -1 } },
        { $limit: limit }
      ];
    } else if (sortBy === 'citations') {
      pipeline = [
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
          $project: {
            name: 1,
            email: 1,
            affiliation: 1,
            role: 1,
            totalCitations: {
              $sum: '$publications.citationsCount'
            }
          }
        },
        { $sort: { totalCitations: -1 } },
        { $limit: limit }
      ];
    } else if (sortBy === 'hIndex') {
      pipeline = [
        { $match: { isActive: true } },
        {
          $lookup: {
            from: 'authorprofiles',
            localField: '_id',
            foreignField: 'user',
            as: 'profile'
          }
        },
        { $unwind: '$profile' },
        {
          $project: {
            name: 1,
            email: 1,
            affiliation: 1,
            role: 1,
            hIndex: '$profile.metrics.hIndex'
          }
        },
        { $sort: { hIndex: -1 } },
        { $limit: limit }
      ];
    }

    const topAuthors = await User.aggregate(pipeline);

    res.json({
      success: true,
      data: topAuthors
    });
  } catch (error) {
    next(error);
  }
};

// Get most cited publications
const getMostCitedPublications = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const timeRange = req.query.timeRange; // all, year, month

    let filter = {};
    
    if (timeRange === 'year') {
      const currentYear = new Date().getFullYear();
      filter.publicationYear = currentYear;
    } else if (timeRange === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      filter.createdAt = { $gte: oneMonthAgo };
    }

    const publications = await Publication.find(filter)
      .populate('authors.author', 'name email affiliation')
      .sort({ citationsCount: -1 })
      .limit(limit);

    res.json({
      success: true,
      data: publications
    });
  } catch (error) {
    next(error);
  }
};

// Get trending topics
const getTrendingTopics = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const timeRange = req.query.timeRange || 'year'; // year, month, week

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

    // Aggregate keywords from publications
    const trendingKeywords = await Publication.aggregate([
      { $match: dateFilter },
      { $unwind: '$keywords' },
      {
        $group: {
          _id: '$keywords',
          count: { $sum: 1 },
          totalCitations: { $sum: '$citationsCount' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);

    // Aggregate topics
    const trendingTopics = await Publication.aggregate([
      { $match: { ...dateFilter, topics: { $exists: true, $ne: [] } } },
      { $unwind: '$topics' },
      {
        $group: {
          _id: '$topics.name',
          count: { $sum: 1 },
          avgWeight: { $avg: '$topics.weight' },
          totalCitations: { $sum: '$citationsCount' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);

    res.json({
      success: true,
      data: {
        keywords: trendingKeywords,
        topics: trendingTopics
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get publication trends over time
const getPublicationTrends = async (req, res, next) => {
  try {
    const period = req.query.period || 'year'; // year, month, quarter

    let groupFormat;
    if (period === 'year') {
      groupFormat = '%Y';
    } else if (period === 'month') {
      groupFormat = '%Y-%m';
    } else if (period === 'quarter') {
      groupFormat = {
        $concat: [
          { $toString: { $year: '$createdAt' } },
          '-Q',
          { $toString: { $ceil: { $divide: [{ $month: '$createdAt' }, 3] } } }
        ]
      };
    }

    const trends = await Publication.aggregate([
      {
        $group: {
          _id: period === 'quarter' ? groupFormat : { $dateToString: { format: groupFormat, date: '$createdAt' } },
          count: { $sum: 1 },
          totalCitations: { $sum: '$citationsCount' }
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

// Get research areas distribution
const getResearchAreas = async (req, res, next) => {
  try {
    // Get research interests from users
    const researchInterests = await User.aggregate([
      { $match: { isActive: true, researchInterests: { $exists: true, $ne: [] } } },
      { $unwind: '$researchInterests' },
      {
        $group: {
          _id: '$researchInterests',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    // Get topics from publications
    const publicationTopics = await Publication.aggregate([
      { $match: { topics: { $exists: true, $ne: [] } } },
      { $unwind: '$topics' },
      {
        $group: {
          _id: '$topics.name',
          count: { $sum: 1 },
          avgWeight: { $avg: '$topics.weight' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    res.json({
      success: true,
      data: {
        researchInterests,
        publicationTopics
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getRecentPublications,
  getTopAuthors,
  getMostCitedPublications,
  getTrendingTopics,
  getPublicationTrends,
  getResearchAreas
};
