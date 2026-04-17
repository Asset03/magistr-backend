const User = require('../models/User');
const AuthorProfile = require('../models/Author');
const Publication = require('../models/Publication');

// Get all authors
const getAllAuthors = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { isActive: true };
    
    if (req.query.role) {
      filter.role = req.query.role;
    }

    if (req.query.affiliation) {
      filter.affiliation = new RegExp(req.query.affiliation, 'i');
    }

    let sort = {};
    if (req.query.sort) {
      sort[req.query.sort] = req.query.order === 'desc' ? -1 : 1;
    } else {
      sort.name = 1;
    }

    const users = await User.find(filter)
      .select('name email affiliation role createdAt')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get author by ID
const getAuthorById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Author not found'
      });
    }

    const authorProfile = await AuthorProfile.findOne({ user: id })
      .populate('collaborationNetwork.collaborator', 'user')
      .populate('user');

    const publications = await Publication.find({ 'authors.author': id })
      .populate('authors.author', 'name email affiliation')
      .sort({ publicationYear: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        user: user.getPublicProfile(),
        profile: authorProfile,
        recentPublications: publications
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get author's publications
const getAuthorPublications = async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { 'authors.author': id };

    // Additional filters
    if (req.query.year) {
      filter.publicationYear = parseInt(req.query.year);
    }

    if (req.query.journal) {
      filter['journal.name'] = new RegExp(req.query.journal, 'i');
    }

    if (req.query.keywords) {
      const keywords = Array.isArray(req.query.keywords) 
        ? req.query.keywords 
        : req.query.keywords.split(',');
      filter.keywords = { $in: keywords };
    }

    let sort = {};
    if (req.query.sort) {
      sort[req.query.sort] = req.query.order === 'desc' ? -1 : 1;
    } else {
      sort.publicationYear = -1;
    }

    const publications = await Publication.find(filter)
      .populate('authors.author', 'name email affiliation')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Publication.countDocuments(filter);

    res.json({
      success: true,
      data: publications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get co-authors
const getCoAuthors = async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Find all publications by this author
    const authorPublications = await Publication.find({ 'authors.author': id });
    
    // Get all co-author IDs
    const coAuthorIds = new Set();
    authorPublications.forEach(pub => {
      pub.authors.forEach(author => {
        if (author.author.toString() !== id) {
          coAuthorIds.add(author.author.toString());
        }
      });
    });

    // Count collaborations
    const collaborationCounts = {};
    authorPublications.forEach(pub => {
      pub.authors.forEach(author => {
        if (author.author.toString() !== id) {
          const authorId = author.author.toString();
          collaborationCounts[authorId] = (collaborationCounts[authorId] || 0) + 1;
        }
      });
    });

    // Get co-author details
    const coAuthors = await User.find({
      _id: { $in: Array.from(coAuthorIds) },
      isActive: true
    })
    .select('name email affiliation role')
    .skip(skip)
    .limit(limit);

    // Add collaboration count
    const coAuthorsWithCount = coAuthors.map(author => ({
      ...author.toObject(),
      collaborationCount: collaborationCounts[author._id.toString()] || 0
    }));

    // Sort by collaboration count
    coAuthorsWithCount.sort((a, b) => b.collaborationCount - a.collaborationCount);

    const total = coAuthorIds.size;

    res.json({
      success: true,
      data: coAuthorsWithCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Create or update author profile
const createOrUpdateProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const profileData = req.body;

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Only the user themselves or admin can update profile
    if (req.user.id !== id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const profile = await AuthorProfile.findOneAndUpdate(
      { user: id },
      { ...profileData, user: id },
      { new: true, upsert: true, runValidators: true }
    ).populate('user');

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

// Get author metrics
const getAuthorMetrics = async (req, res, next) => {
  try {
    const { id } = req.params;

    const publications = await Publication.find({ 'authors.author': id });
    
    const totalPublications = publications.length;
    const totalCitations = publications.reduce((sum, pub) => sum + (pub.citationsCount || 0), 0);
    
    // Calculate h-index
    const citationCounts = publications.map(pub => pub.citationsCount || 0).sort((a, b) => b - a);
    let hIndex = 0;
    for (let i = 0; i < citationCounts.length; i++) {
      if (citationCounts[i] >= i + 1) {
        hIndex = i + 1;
      } else {
        break;
      }
    }

    // Calculate i10-index
    const i10Index = citationCounts.filter(count => count >= 10).length;

    // Publications by year
    const publicationsByYear = {};
    publications.forEach(pub => {
      const year = pub.publicationYear;
      publicationsByYear[year] = (publicationsByYear[year] || 0) + 1;
    });

    // Top journals
    const journalCounts = {};
    publications.forEach(pub => {
      if (pub.journal && pub.journal.name) {
        const journal = pub.journal.name;
        journalCounts[journal] = (journalCounts[journal] || 0) + 1;
      }
    });

    const topJournals = Object.entries(journalCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([journal, count]) => ({ journal, count }));

    res.json({
      success: true,
      data: {
        totalPublications,
        totalCitations,
        hIndex,
        i10Index,
        publicationsByYear,
        topJournals
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get potential collaborators
const getPotentialCollaborators = async (req, res, next) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const potentialCollaborators = await AuthorProfile.findPotentialCollaborators(id, limit);

    res.json({
      success: true,
      data: potentialCollaborators
    });
  } catch (error) {
    next(error);
  }
};

// Update author metrics (admin only)
const updateAuthorMetrics = async (req, res, next) => {
  try {
    const { id } = req.params;

    await AuthorProfile.updateMetrics(id);

    res.json({
      success: true,
      message: 'Author metrics updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllAuthors,
  getAuthorById,
  getAuthorPublications,
  getCoAuthors,
  createOrUpdateProfile,
  getAuthorMetrics,
  getPotentialCollaborators,
  updateAuthorMetrics
};
