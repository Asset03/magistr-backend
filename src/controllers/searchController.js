const Publication = require('../models/Publication');
const User = require('../models/User');

// Global search across publications and authors
const globalSearch = async (req, res, next) => {
  try {
    const { q } = req.query;
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters long'
      });
    }

    const searchQuery = q.trim();

    // Search publications
    const publicationResults = await Publication.find(
      { $text: { $search: searchQuery } },
      { score: { $meta: 'textScore' } }
    )
    .populate('authors.author', 'name email affiliation')
    .sort({ score: { $meta: 'textScore' } })
    .skip(skip)
    .limit(limit);

    // Search authors by name and affiliation
    const authorResults = await User.find({
      isActive: true,
      $or: [
        { name: { $regex: searchQuery, $options: 'i' } },
        { affiliation: { $regex: searchQuery, $options: 'i' } },
        { researchInterests: { $regex: searchQuery, $options: 'i' } }
      ]
    })
    .select('name email affiliation role researchInterests')
    .skip(skip)
    .limit(limit);

    res.json({
      success: true,
      data: {
        publications: publicationResults,
        authors: authorResults
      },
      pagination: {
        page,
        limit,
        query: searchQuery
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get search suggestions
const getSearchSuggestions = async (req, res, next) => {
  try {
    const { q } = req.query;
    const limit = parseInt(req.query.limit) || 10;

    if (!q || q.trim().length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    const searchQuery = q.trim();

    // Get title suggestions from publications
    const titleSuggestions = await Publication.aggregate([
      {
        $match: {
          title: { $regex: searchQuery, $options: 'i' }
        }
      },
      {
        $project: {
          title: 1,
          matchLength: { $strLenCP: { $substrCP: ['$title', 0, searchQuery.length] } }
        }
      },
      { $match: { matchLength: searchQuery.length } },
      { $limit: limit },
      { $project: { title: 1 } }
    ]);

    // Get author name suggestions
    const authorSuggestions = await User.aggregate([
      {
        $match: {
          isActive: true,
          name: { $regex: searchQuery, $options: 'i' }
        }
      },
      {
        $project: {
          name: 1,
          matchLength: { $strLenCP: { $substrCP: ['$name', 0, searchQuery.length] } }
        }
      },
      { $match: { matchLength: searchQuery.length } },
      { $limit: limit },
      { $project: { name: 1 } }
    ]);

    // Get keyword suggestions
    const keywordSuggestions = await Publication.aggregate([
      { $unwind: '$keywords' },
      {
        $match: {
          keywords: { $regex: searchQuery, $options: 'i' }
        }
      },
      {
        $group: {
          _id: '$keywords',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { keyword: '$_id', count: 1 } }
    ]);

    // Get journal name suggestions
    const journalSuggestions = await Publication.aggregate([
      {
        $match: {
          'journal.name': { $regex: searchQuery, $options: 'i' }
        }
      },
      {
        $group: {
          _id: '$journal.name',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { journal: '$_id', count: 1 } }
    ]);

    // Combine all suggestions
    const suggestions = [
      ...titleSuggestions.map(item => item.title),
      ...authorSuggestions.map(item => item.name),
      ...keywordSuggestions.map(item => item.keyword),
      ...journalSuggestions.map(item => item.journal)
    ].slice(0, limit);

    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    next(error);
  }
};

// Advanced search with filters
const advancedSearch = async (req, res, next) => {
  try {
    const {
      query,
      title,
      abstract,
      authors,
      keywords,
      journal,
      publicationType,
      accessType,
      language,
      yearRange,
      citationsRange,
      limit = 20,
      page = 1,
      sortBy = 'relevance',
      sortOrder = 'desc'
    } = req.body;

    const skip = (page - 1) * limit;

    // Build search criteria
    const searchCriteria = {};

    // Text search
    if (query) {
      searchCriteria.$text = { $search: query };
    }

    // Specific field searches
    if (title) {
      searchCriteria.title = { $regex: title, $options: 'i' };
    }

    if (abstract) {
      searchCriteria.abstract = { $regex: abstract, $options: 'i' };
    }

    // Author filter
    if (authors && authors.length > 0) {
      searchCriteria['authors.author'] = { $in: authors };
    }

    // Keywords filter
    if (keywords && keywords.length > 0) {
      searchCriteria.keywords = { $in: keywords };
    }

    // Journal filter
    if (journal) {
      searchCriteria['journal.name'] = { $regex: journal, $options: 'i' };
    }

    // Publication type filter
    if (publicationType) {
      searchCriteria.publicationType = publicationType;
    }

    // Access type filter
    if (accessType) {
      searchCriteria.accessType = accessType;
    }

    // Language filter
    if (language) {
      searchCriteria.language = language;
    }

    // Year range filter
    if (yearRange) {
      const yearFilter = {};
      if (yearRange.start) yearFilter.$gte = yearRange.start;
      if (yearRange.end) yearFilter.$lte = yearRange.end;
      if (Object.keys(yearFilter).length > 0) {
        searchCriteria.publicationYear = yearFilter;
      }
    }

    // Citations range filter
    if (citationsRange) {
      const citationsFilter = {};
      if (citationsRange.min) citationsFilter.$gte = citationsRange.min;
      if (citationsRange.max) citationsFilter.$lte = citationsRange.max;
      if (Object.keys(citationsFilter).length > 0) {
        searchCriteria.citationsCount = citationsFilter;
      }
    }

    // Build sort criteria
    let sort = {};
    if (sortBy === 'relevance' && query) {
      sort = { score: { $meta: 'textScore' } };
    } else if (sortBy === 'citations') {
      sort = { citationsCount: sortOrder === 'desc' ? -1 : 1 };
    } else if (sortBy === 'year') {
      sort = { publicationYear: sortOrder === 'desc' ? -1 : 1 };
    } else if (sortBy === 'title') {
      sort = { title: sortOrder === 'desc' ? -1 : 1 };
    } else {
      sort = { createdAt: -1 };
    }

    const publications = await Publication.find(searchCriteria)
      .populate('authors.author', 'name email affiliation')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Publication.countDocuments(searchCriteria);

    // Get facets for filtering
    const facets = await Promise.all([
      // Publication types
      Publication.distinct('publicationType', searchCriteria),
      // Access types
      Publication.distinct('accessType', searchCriteria),
      // Languages
      Publication.distinct('language', searchCriteria),
      // Year range
      Publication.aggregate([
        { $match: searchCriteria },
        {
          $group: {
            _id: null,
            minYear: { $min: '$publicationYear' },
            maxYear: { $max: '$publicationYear' }
          }
        }
      ]),
      // Keywords
      Publication.aggregate([
        { $match: searchCriteria },
        { $unwind: '$keywords' },
        {
          $group: {
            _id: '$keywords',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ])
    ]);

    res.json({
      success: true,
      data: publications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      facets: {
        publicationTypes: facets[0],
        accessTypes: facets[1],
        languages: facets[2],
        yearRange: facets[3][0] || { minYear: 1900, maxYear: new Date().getFullYear() },
        keywords: facets[4]
      }
    });
  } catch (error) {
    next(error);
  }
};

// Search similar publications by content
const searchSimilar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const publication = await Publication.findById(id);
    if (!publication) {
      return res.status(404).json({
        success: false,
        error: 'Publication not found'
      });
    }

    // Find similar publications based on keywords and authors
    const similarPublications = await Publication.find({
      _id: { $ne: id },
      $or: [
        { keywords: { $in: publication.keywords } },
        { 'authors.author': { $in: publication.authors.map(a => a.author) } },
        { title: { $regex: publication.title.split(' ').slice(0, 3).join(' '), $options: 'i' } }
      ]
    })
    .populate('authors.author', 'name email affiliation')
    .limit(limit);

    // Calculate similarity scores
    const scoredPublications = similarPublications.map(pub => {
      let score = 0;
      
      // Keyword similarity
      const commonKeywords = publication.keywords.filter(k => pub.keywords.includes(k));
      score += commonKeywords.length * 2;
      
      // Author similarity
      const commonAuthors = publication.authors
        .map(a => a.author.toString())
        .filter(authorId => pub.authors.some(a => a.author.toString() === authorId));
      score += commonAuthors.length * 3;
      
      // Title similarity (simple word overlap)
      const pubWords = new Set(pub.title.toLowerCase().split(/\s+/));
      const origWords = new Set(publication.title.toLowerCase().split(/\s+/));
      const commonWords = [...pubWords].filter(word => origWords.has(word));
      score += commonWords.length;
      
      return {
        ...pub.toObject(),
        similarityScore: score
      };
    });

    // Sort by similarity score
    scoredPublications.sort((a, b) => b.similarityScore - a.similarityScore);

    res.json({
      success: true,
      data: scoredPublications
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  globalSearch,
  getSearchSuggestions,
  advancedSearch,
  searchSimilar
};
