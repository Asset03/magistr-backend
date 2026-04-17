const Publication = require('../models/Publication');

// Get all publications with pagination and filtering
const getAllPublications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    
    if (req.query.author) {
      filter['authors.author'] = req.query.author;
    }
    
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

    // Build sort
    let sort = {};
    if (req.query.sort) {
      const sortField = req.query.sort;
      const sortOrder = req.query.order === 'desc' ? -1 : 1;
      sort[sortField] = sortOrder;
    } else {
      sort.createdAt = -1;
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

// Get publication by ID
const getPublicationById = async (req, res, next) => {
  try {
    const publication = await Publication.findById(req.params.id)
      .populate('authors.author', 'name email affiliation')
      .populate('references', 'title authors publicationYear citationsCount')
      .populate('citations', 'title authors publicationYear citationsCount');

    if (!publication) {
      return res.status(404).json({
        success: false,
        error: 'Publication not found'
      });
    }

    // Increment view count
    publication.metrics.views += 1;
    await publication.save();

    res.json({
      success: true,
      data: publication
    });
  } catch (error) {
    next(error);
  }
};

// Search publications
const searchPublications = async (req, res, next) => {
  try {
    const {
      query,
      authors,
      yearRange,
      keywords,
      journal,
      publicationType,
      accessType,
      limit = 20,
      page = 1
    } = req.body;

    const skip = (page - 1) * limit;

    // Build search criteria
    const searchCriteria = {};

    // Text search
    if (query) {
      searchCriteria.$text = { $search: query };
    }

    // Author filter
    if (authors && authors.length > 0) {
      searchCriteria['authors.author'] = { $in: authors };
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

    // Keywords filter
    if (keywords && keywords.length > 0) {
      searchCriteria.keywords = { $in: keywords };
    }

    // Journal filter
    if (journal) {
      searchCriteria['journal.name'] = new RegExp(journal, 'i');
    }

    // Publication type filter
    if (publicationType) {
      searchCriteria.publicationType = publicationType;
    }

    // Access type filter
    if (accessType) {
      searchCriteria.accessType = accessType;
    }

    const publications = await Publication.find(searchCriteria)
      .populate('authors.author', 'name email affiliation')
      .sort(query ? { score: { $meta: 'textScore' } } : { citationsCount: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Publication.countDocuments(searchCriteria);

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

// Get similar publications
const getSimilarPublications = async (req, res, next) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const similarPublications = await Publication.findSimilar(id, limit);

    res.json({
      success: true,
      data: similarPublications
    });
  } catch (error) {
    next(error);
  }
};

// Get citations for a publication
const getCitations = async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const publication = await Publication.findById(id);
    if (!publication) {
      return res.status(404).json({
        success: false,
        error: 'Publication not found'
      });
    }

    const citations = await Publication.find({ _id: { $in: publication.citations } })
      .populate('authors.author', 'name email affiliation')
      .sort({ publicationYear: -1 })
      .skip(skip)
      .limit(limit);

    const total = publication.citations.length;

    res.json({
      success: true,
      data: citations,
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

// Get references for a publication
const getReferences = async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const publication = await Publication.findById(id);
    if (!publication) {
      return res.status(404).json({
        success: false,
        error: 'Publication not found'
      });
    }

    const references = await Publication.find({ _id: { $in: publication.references } })
      .populate('authors.author', 'name email affiliation')
      .sort({ publicationYear: -1 })
      .skip(skip)
      .limit(limit);

    const total = publication.references.length;

    res.json({
      success: true,
      data: references,
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

// Create new publication
const createPublication = async (req, res, next) => {
  try {
    const publicationData = req.body;

    const publication = await Publication.create(publicationData);

    const populatedPublication = await Publication.findById(publication._id)
      .populate('authors.author', 'name email affiliation');

    res.status(201).json({
      success: true,
      data: populatedPublication
    });
  } catch (error) {
    next(error);
  }
};

// Update publication
const updatePublication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const publication = await Publication.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('authors.author', 'name email affiliation');

    if (!publication) {
      return res.status(404).json({
        success: false,
        error: 'Publication not found'
      });
    }

    res.json({
      success: true,
      data: publication
    });
  } catch (error) {
    next(error);
  }
};

// Delete publication
const deletePublication = async (req, res, next) => {
  try {
    const { id } = req.params;

    const publication = await Publication.findByIdAndDelete(id);

    if (!publication) {
      return res.status(404).json({
        success: false,
        error: 'Publication not found'
      });
    }

    // Remove references from other publications
    await Publication.updateMany(
      { references: id },
      { $pull: { references: id } }
    );

    await Publication.updateMany(
      { citations: id },
      { $pull: { citations: id } }
    );

    res.json({
      success: true,
      message: 'Publication deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get citation network
const getCitationNetwork = async (req, res, next) => {
  try {
    const { id } = req.params;
    const depth = parseInt(req.query.depth) || 2;

    const network = await Publication.getCitationNetwork(id, depth);

    res.json({
      success: true,
      data: network
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllPublications,
  getPublicationById,
  searchPublications,
  getSimilarPublications,
  getCitations,
  getReferences,
  createPublication,
  updatePublication,
  deletePublication,
  getCitationNetwork
};
