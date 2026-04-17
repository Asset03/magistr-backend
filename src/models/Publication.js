const mongoose = require('mongoose');

const authorSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  order: {
    type: Number,
    required: true
  },
  isCorresponding: {
    type: Boolean,
    default: false
  }
});

const publicationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [500, 'Title cannot exceed 500 characters']
  },
  abstract: {
    type: String,
    required: [true, 'Abstract is required'],
    trim: true,
    maxlength: [5000, 'Abstract cannot exceed 5000 characters']
  },
  authors: [authorSchema],
  keywords: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  publicationYear: {
    type: Number,
    required: [true, 'Publication year is required'],
    min: [1900, 'Publication year must be after 1900'],
    max: [new Date().getFullYear() + 1, 'Publication year cannot be in the distant future']
  },
  journal: {
    name: {
      type: String,
      trim: true,
      maxlength: [200, 'Journal name cannot exceed 200 characters']
    },
    volume: {
      type: String,
      trim: true
    },
    issue: {
      type: String,
      trim: true
    },
    pages: {
      type: String,
      trim: true
    },
    issn: {
      type: String,
      trim: true,
      match: [/^\d{4}-\d{3}[\dX]$/, 'Please enter a valid ISSN']
    }
  },
  conference: {
    name: {
      type: String,
      trim: true,
      maxlength: [200, 'Conference name cannot exceed 200 characters']
    },
    location: {
      type: String,
      trim: true
    },
    dates: {
      start: Date,
      end: Date
    }
  },
  doi: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
    match: [/^10.\d{4,9}\/[-._;()\/:A-Z0-9]+$/, 'Please enter a valid DOI']
  },
  citationsCount: {
    type: Number,
    default: 0,
    min: 0
  },
  references: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Publication'
  }],
  citations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Publication'
  }],
  fullText: {
    type: String,
    trim: true
  },
  pdfUrl: {
    type: String,
    trim: true
  },
  openAlexId: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  crossrefId: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  embeddings: {
    title: [Number],
    abstract: [Number],
    fullText: [Number]
  },
  topics: [{
    name: {
      type: String,
      required: true
    },
    weight: {
      type: Number,
      min: 0,
      max: 1
    },
    keywords: [String]
  }],
  language: {
    type: String,
    default: 'en',
    enum: ['en', 'kk', 'ru', 'zh', 'es', 'fr', 'de', 'ja', 'ko']
  },
  publicationType: {
    type: String,
    enum: ['journal', 'conference', 'book', 'thesis', 'preprint', 'report', 'other'],
    default: 'journal'
  },
  accessType: {
    type: String,
    enum: ['open', 'closed', 'hybrid'],
    default: 'closed'
  },
  status: {
    type: String,
    enum: ['published', 'in_press', 'preprint', 'draft'],
    default: 'published'
  },
  indexedIn: [{
    type: String,
    enum: ['scopus', 'wos', 'pubmed', 'google_scholar', 'other']
  }],
  metrics: {
    views: {
      type: Number,
      default: 0,
      min: 0
    },
    downloads: {
      type: Number,
      default: 0,
      min: 0
    },
    shares: {
      type: Number,
      default: 0,
      min: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
publicationSchema.index({ title: 'text', abstract: 'text', keywords: 'text' });
publicationSchema.index({ authors: 1 });
publicationSchema.index({ publicationYear: -1 });
publicationSchema.index({ citationsCount: -1 });
publicationSchema.index({ 'journal.name': 1 });
publicationSchema.index({ keywords: 1 });
publicationSchema.index({ doi: 1 }, { unique: true, sparse: true });
publicationSchema.index({ openAlexId: 1 }, { unique: true, sparse: true });
publicationSchema.index({ createdAt: -1 });

// Virtual for author count
publicationSchema.virtual('authorCount', {
  get() {
    return this.authors ? this.authors.length : 0;
  }
});

// Virtual for reference count
publicationSchema.virtual('referenceCount', {
  get() {
    return this.references ? this.references.length : 0;
  }
});

// Virtual for citation count (explicit field already exists)
publicationSchema.virtual('citationCount', {
  get() {
    return this.citations ? this.citations.length : 0;
  }
});

// Pre-save middleware to update citations count
publicationSchema.pre('save', function(next) {
  if (this.isModified('citations')) {
    this.citationsCount = this.citations ? this.citations.length : 0;
  }
  next();
});

// Static method to find similar publications
publicationSchema.statics.findSimilar = async function(publicationId, limit = 10) {
  const publication = await this.findById(publicationId).populate('authors.author');
  if (!publication) return [];

  // Find publications with similar keywords or authors
  const similarPublications = await this.find({
    _id: { $ne: publicationId },
    $or: [
      { keywords: { $in: publication.keywords } },
      { 'authors.author': { $in: publication.authors.map(a => a.author) } }
    ]
  })
  .populate('authors.author')
  .limit(limit)
  .exec();

  return similarPublications;
};

// Static method to get citation network
publicationSchema.statics.getCitationNetwork = async function(publicationId, depth = 2) {
  const getCitationsRecursive = async (id, currentDepth, visited = new Set()) => {
    if (currentDepth <= 0 || visited.has(id)) return [];
    
    visited.add(id);
    const pub = await this.findById(id).populate('citations references');
    if (!pub) return [];

    const result = [pub.toObject()];
    
    for (const citation of pub.citations) {
      const citationNetwork = await getCitationsRecursive(citation._id, currentDepth - 1, visited);
      result.push(...citationNetwork);
    }
    
    return result;
  };

  return await getCitationsRecursive(publicationId, depth);
};

module.exports = mongoose.model('Publication', publicationSchema);
