const mongoose = require('mongoose');

const citationSchema = new mongoose.Schema({
  publication_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Publication',
    required: true
  },
  title: String,
  authors: [String],
  year: Number,
  doi: String,
  context: String
}, { _id: false });

const authorReferenceSchema = new mongoose.Schema({
  author_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Author',
    required: true
  },
  name: String,
  affiliation: String,
  order: Number
}, { _id: false });

const publicationSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  abstract: {
    type: String,
    trim: true,
    maxlength: 5000
  },
  full_text: {
    type: String,
    trim: true
  },
  
  // Authors
  authors: [authorReferenceSchema],
  
  // Publication Details
  publication_year: {
    type: Number,
    min: 1800,
    max: new Date().getFullYear() + 1
  },
  publication_date: Date,
  journal: {
    name: String,
    volume: String,
    issue: String,
    pages: String,
    issn: String,
    publisher: String
  },
  conference: {
    name: String,
    location: String,
    dates: String,
    proceedings: String
  },
  
  // Identifiers
  doi: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  isbn: String,
  pmid: String,
  arxiv_id: String,
  openalex_id: String,
  
  // Keywords and Topics
  keywords: [{
    term: String,
    weight: Number,
    source: String // manual, extracted, ml
  }],
  topics: [{
    topic_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic'
    },
    confidence: Number,
    method: String
  }],
  
  // Metrics
  citations_count: {
    type: Number,
    default: 0,
    min: 0
  },
  references_count: {
    type: Number,
    default: 0,
    min: 0
  },
  downloads_count: {
    type: Number,
    default: 0,
    min: 0
  },
  views_count: {
    type: Number,
    default: 0,
    min: 0
  },
  altmetric_score: Number,
  h_index_authors: [Number],
  
  // Citations and References
  citations: [citationSchema],
  references: [citationSchema],
  
  // NLP and ML Features
  embeddings: {
    title_vector: [Number],
    abstract_vector: [Number],
    full_text_vector: [Number],
    model_version: String,
    generated_at: Date
  },
  
  language: {
    type: String,
    default: 'en',
    lowercase: true,
    minlength: 2,
    maxlength: 2
  },
  
  // Content Analysis
  readability_score: Number,
  sentiment_score: {
    positive: Number,
    negative: Number,
    neutral: Number
  },
  topic_distribution: [{
    topic: String,
    probability: Number
  }],
  
  // File Information
  file_info: {
    filename: String,
    file_type: String,
    file_size: Number,
    file_path: String,
    uploaded_at: Date
  },
  
  // Data Source and Processing
  source: {
    type: String,
    enum: ['manual', 'openalex', 'crossref', 'arxiv', 'pubmed', 'upload', 'scraping'],
    default: 'manual'
  },
  source_id: String,
  processing_status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processing_errors: [String],
  
  // Quality and Validation
  quality_score: {
    type: Number,
    min: 0,
    max: 1
  },
  is_peer_reviewed: {
    type: Boolean,
    default: false
  },
  is_open_access: {
    type: Boolean,
    default: false
  },
  
  // Status and Visibility
  status: {
    type: String,
    enum: ['draft', 'published', 'archived', 'deleted'],
    default: 'published'
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'restricted'],
    default: 'public'
  },
  
  // Timestamps
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  indexed_at: Date,
  last_cited_at: Date
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'publications'
});

// Indexes for performance
publicationSchema.index({ title: 'text', abstract: 'text', full_text: 'text' });
publicationSchema.index({ authors: 1 });
publicationSchema.index({ publication_year: -1 });
publicationSchema.index({ citations_count: -1 });
publicationSchema.index({ keywords: 1 });
publicationSchema.index({ doi: 1 }, { unique: true, sparse: true });
publicationSchema.index({ openalex_id: 1 }, { sparse: true });
publicationSchema.index({ arxiv_id: 1 }, { sparse: true });
publicationSchema.index({ 'journal.name': 1 });
publicationSchema.index({ 'conference.name': 1 });
publicationSchema.index({ topics: 1 });
publicationSchema.index({ source: 1 });
publicationSchema.index({ processing_status: 1 });
publicationSchema.index({ created_at: -1 });
publicationSchema.index({ updated_at: -1 });

// Compound indexes
publicationSchema.index({ publication_year: -1, citations_count: -1 });
publicationSchema.index({ authors: 1, publication_year: -1 });
publicationSchema.index({ keywords: 1, citations_count: -1 });

// Virtual fields
publicationSchema.virtual('citations_per_year').get(function() {
  const yearsSincePublication = Math.max(1, new Date().getFullYear() - this.publication_year);
  return this.citations_count / yearsSincePublication;
});

publicationSchema.virtual('author_count').get(function() {
  return this.authors.length;
});

publicationSchema.virtual('reference_count').get(function() {
  return this.references.length;
});

// Methods
publicationSchema.methods.addCitation = function(citationData) {
  this.citations.push(citationData);
  this.citations_count = this.citations.length;
  this.last_cited_at = new Date();
  return this.save();
};

publicationSchema.methods.incrementViews = function() {
  this.views_count += 1;
  return this.save();
};

publicationSchema.methods.incrementDownloads = function() {
  this.downloads_count += 1;
  return this.save();
};

publicationSchema.methods.updateEmbeddings = function(embeddings) {
  this.embeddings = {
    ...this.embeddings,
    ...embeddings,
    generated_at: new Date()
  };
  return this.save();
};

// Static methods
publicationSchema.statics.findByAuthor = function(authorId) {
  return this.find({ 'authors.author_id': authorId })
    .sort({ citations_count: -1 });
};

publicationSchema.statics.findByKeyword = function(keyword) {
  return this.find({ 
    'keywords.term': { $regex: keyword, $options: 'i' }
  }).sort({ citations_count: -1 });
};

publicationSchema.statics.findTrending = function(days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.find({ 
    created_at: { $gte: cutoffDate },
    citations_count: { $gt: 0 }
  }).sort({ citations_count: -1 }).limit(50);
};

publicationSchema.statics.search = function(query, filters = {}) {
  const searchQuery = {
    $and: []
  };

  // Text search
  if (query) {
    searchQuery.$and.push({
      $text: { $search: query }
    });
  }

  // Apply filters
  if (filters.year) {
    searchQuery.$and.push({
      publication_year: filters.year
    });
  }

  if (filters.author) {
    searchQuery.$and.push({
      'authors.name': { $regex: filters.author, $options: 'i' }
    });
  }

  if (filters.journal) {
    searchQuery.$and.push({
      'journal.name': { $regex: filters.journal, $options: 'i' }
    });
  }

  if (filters.minCitations) {
    searchQuery.$and.push({
      citations_count: { $gte: filters.minCitations }
    });
  }

  return this.find(searchQuery.$and.length > 0 ? searchQuery : {})
    .sort({ score: { $meta: 'textScore' }, citations_count: -1 });
};

// Pre-save middleware
publicationSchema.pre('save', function(next) {
  if (this.isModified('updated_at')) {
    this.updated_at = new Date();
  }
  next();
});

// Post-save middleware for indexing
publicationSchema.post('save', function(doc) {
  // Trigger reindexing in Elasticsearch
  if (process.env.NODE_ENV !== 'test') {
    // This would be handled by a separate indexing service
    console.log(`Publication ${doc._id} saved - triggering reindex`);
  }
});

module.exports = mongoose.model('Publication', publicationSchema);
