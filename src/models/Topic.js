const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  // Topic Hierarchy
  parent_topic_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    default: null
  },
  level: {
    type: Number,
    default: 0,
    min: 0
  },
  path: [String], // Hierarchical path for nested topics
  children: [{
    topic_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic'
    },
    weight: Number
  }],
  
  // Topic Classification
  category: {
    type: String,
    enum: ['stem', 'social_sciences', 'humanities', 'arts', 'interdisciplinary', 'other'],
    default: 'stem'
  },
  subcategory: String,
  field: String,
  subfield: String,
  
  // Keywords and Terms
  keywords: [{
    term: String,
    weight: Number,
    frequency: Number,
    source: String // manual, extracted, ml
  }],
  related_terms: [{
    term: String,
    similarity_score: Number,
    co_occurrence_frequency: Number
  }],
  synonyms: [String],
  
  // Topic Modeling Data
  topic_model_id: String, // ID from topic modeling algorithm
  algorithm: {
    type: String,
    enum: ['lda', 'nmf', 'bertopic', 'manual', 'hierarchical'],
    default: 'manual'
  },
  model_version: String,
  model_parameters: mongoose.Schema.Types.Mixed,
  
  // Topic Distribution and Weights
  topic_distribution: [{
    term: String,
    probability: Number,
    weight: Number
  }],
  coherence_score: {
    type: Number,
    min: 0,
    max: 1
  },
  perplexity_score: Number,
  
  // Temporal Information
  emergence_year: Number,
  peak_year: Number,
  decline_year: Number,
  trend_direction: {
    type: String,
    enum: ['emerging', 'growing', 'stable', 'declining', 'resurgent'],
    default: 'stable'
  },
  
  // Geographic and Institutional Context
  geographic_distribution: [{
    country: String,
    region: String,
    publication_count: Number,
    percentage: Number
  }],
  institutional_leaders: [{
    institution: String,
    country: String,
    publication_count: Number,
    impact_score: Number
  }],
  
  // Publication Metrics
  total_publications: {
    type: Number,
    default: 0,
    min: 0
  },
  total_citations: {
    type: Number,
    default: 0,
    min: 0
  },
  average_citations_per_publication: Number,
  h_index_topic: Number,
  
  // Author and Collaboration Metrics
  total_authors: {
    type: Number,
    default: 0,
    min: 0
  },
  top_authors: [{
    author_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Author'
    },
    name: String,
    publication_count: Number,
    citation_count: Number
  }],
  collaboration_density: Number,
  
  // Journal and Conference Metrics
  top_journals: [{
    journal_name: String,
    publication_count: Number,
    impact_factor: Number,
    quartile: String
  }],
  top_conferences: [{
    conference_name: String,
    publication_count: Number,
    acceptance_rate: Number
  }],
  
  // NLP and ML Features
  embeddings: {
    topic_vector: [Number],
    keywords_vector: [Number],
    description_vector: [Number],
    model_version: String,
    generated_at: Date
  },
  
  // Topic Relationships
  related_topics: [{
    topic_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic'
    },
    name: String,
    relationship_type: {
      type: String,
      enum: ['similar', 'parent', 'child', 'overlapping', 'competing', 'complementary'],
      default: 'similar'
    },
    similarity_score: Number,
    co_occurrence_frequency: Number
  }],
  
  // Interdisciplinary Connections
  interdisciplinary_connections: [{
    field: String,
    connection_strength: Number,
    bridge_papers: [{
      publication_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Publication'
      },
      title: String,
      year: Number
    }]
  }],
  
  // Quality and Validation
  confidence_score: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5
  },
  validation_status: {
    type: String,
    enum: ['pending', 'validated', 'disputed', 'deprecated'],
    default: 'pending'
  },
  validated_by: String,
  validation_notes: String,
  
  // Usage and Popularity
  popularity_score: {
    type: Number,
    min: 0,
    max: 1,
    default: 0
  },
  search_frequency: {
    type: Number,
    default: 0,
    min: 0
  },
  last_accessed: Date,
  
  // Data Source and Processing
  source: {
    type: String,
    enum: ['manual', 'topic_modeling', 'automated_extraction', 'ontology_import'],
    default: 'manual'
  },
  source_id: String,
  processing_status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processing_errors: [String],
  
  // Additional Metadata
  tags: [String],
  notes: String,
  external_links: [{
    title: String,
    url: String,
    type: String
  }],
  
  // Timestamps
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  last_analyzed: Date
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'topics'
});

// Indexes for performance
topicSchema.index({ name: 'text', description: 'text', keywords: 1 });
topicSchema.index({ parent_topic_id: 1 });
topicSchema.index({ level: 1 });
topicSchema.index({ category: 1 });
topicSchema.index({ field: 1 });
topicSchema.index({ subfield: 1 });
topicSchema.index({ total_publications: -1 });
topicSchema.index({ total_citations: -1 });
topicSchema.index({ popularity_score: -1 });
topicSchema.index({ trend_direction: 1 });
topicSchema.index({ emergence_year: 1 });
topicSchema.index({ algorithm: 1 });
topicSchema.index({ validation_status: 1 });
topicSchema.index({ created_at: -1 });
topicSchema.index({ updated_at: -1 });

// Compound indexes
topicSchema.index({ category: 1, total_publications: -1 });
topicSchema.index({ field: 1, total_citations: -1 });
topicSchema.index({ trend_direction: 1, popularity_score: -1 });

// Virtual fields
topicSchema.virtual('citations_per_publication').get(function() {
  return this.total_publications > 0 ? this.total_citations / this.total_publications : 0;
});

topicSchema.virtual('has_children').get(function() {
  return this.children && this.children.length > 0;
});

topicSchema.virtual('depth').get(function() {
  return this.path ? this.path.length : 0;
});

// Methods
topicSchema.methods.addChildTopic = function(childTopicData) {
  this.children.push({
    topic_id: childTopicData.topic_id,
    weight: childTopicData.weight || 1.0
  });
  return this.save();
};

topicSchema.methods.updateMetrics = function(metrics) {
  if (metrics.total_publications !== undefined) this.total_publications = metrics.total_publications;
  if (metrics.total_citations !== undefined) this.total_citations = metrics.total_citations;
  if (metrics.total_authors !== undefined) this.total_authors = metrics.total_authors;
  
  // Calculate derived metrics
  if (this.total_publications > 0) {
    this.average_citations_per_publication = this.total_citations / this.total_publications;
  }
  
  return this.save();
};

topicSchema.methods.addRelatedTopic = function(relatedTopicData) {
  const existingRelation = this.related_topics.find(
    t => t.topic_id.toString() === relatedTopicData.topic_id.toString()
  );
  
  if (existingRelation) {
    existingRelation.similarity_score = relatedTopicData.similarity_score;
    existingRelation.co_occurrence_frequency = relatedTopicData.co_occurrence_frequency;
  } else {
    this.related_topics.push(relatedTopicData);
  }
  
  return this.save();
};

topicSchema.methods.updateTrendDirection = function() {
  // This would analyze temporal data to determine trend
  const currentYear = new Date().getFullYear();
  const recentYears = 5;
  
  // Placeholder logic - would use actual temporal analysis
  if (this.emergence_year && currentYear - this.emergence_year <= recentYears) {
    this.trend_direction = 'emerging';
  } else if (this.peak_year && currentYear - this.peak_year <= recentYears) {
    this.trend_direction = 'growing';
  } else if (this.decline_year && currentYear - this.decline_year <= recentYears) {
    this.trend_direction = 'declining';
  } else {
    this.trend_direction = 'stable';
  }
  
  return this.save();
};

topicSchema.methods.calculatePopularityScore = function() {
  // Calculate popularity based on multiple factors
  const publicationWeight = 0.3;
  const citationWeight = 0.3;
  const authorWeight = 0.2;
  const searchWeight = 0.2;
  
  const maxPublications = 10000; // Normalization factor
  const maxCitations = 100000;
  const maxAuthors = 1000;
  const maxSearches = 1000;
  
  const publicationScore = Math.min(this.total_publications / maxPublications, 1);
  const citationScore = Math.min(this.total_citations / maxCitations, 1);
  const authorScore = Math.min(this.total_authors / maxAuthors, 1);
  const searchScore = Math.min(this.search_frequency / maxSearches, 1);
  
  this.popularity_score = (
    publicationScore * publicationWeight +
    citationScore * citationWeight +
    authorScore * authorWeight +
    searchScore * searchWeight
  );
  
  return this.save();
};

// Static methods
topicSchema.statics.findByName = function(name) {
  return this.find({
    name: { $regex: name, $options: 'i' }
  });
};

topicSchema.statics.findByCategory = function(category) {
  return this.find({ category })
    .sort({ total_publications: -1 });
};

topicSchema.statics.findByField = function(field) {
  return this.find({ field })
    .sort({ total_citations: -1 });
};

topicSchema.statics.findTrendingTopics = function(limit = 20) {
  return this.find({
    trend_direction: { $in: ['emerging', 'growing'] }
  })
    .sort({ popularity_score: -1, total_publications: -1 })
    .limit(limit);
};

topicSchema.statics.findTopTopics = function(limit = 50, sortBy = 'total_publications') {
  const sortField = {};
  sortField[sortBy] = -1;
  
  return this.find({ validation_status: 'validated' })
    .sort(sortField)
    .limit(limit);
};

topicSchema.statics.findTopicHierarchy = function(topicId) {
  return this.findById(topicId)
    .populate('parent_topic_id', 'name level path')
    .populate('children.topic_id', 'name level total_publications')
    .populate('related_topics.topic_id', 'name similarity_score');
};

topicSchema.statics.search = function(query, filters = {}) {
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
  if (filters.category) {
    searchQuery.$and.push({
      category: filters.category
    });
  }

  if (filters.field) {
    searchQuery.$and.push({
      field: { $regex: filters.field, $options: 'i' }
    });
  }

  if (filters.trendDirection) {
    searchQuery.$and.push({
      trend_direction: filters.trendDirection
    });
  }

  if (filters.minPublications) {
    searchQuery.$and.push({
      total_publications: { $gte: filters.minPublications }
    });
  }

  return this.find(searchQuery.$and.length > 0 ? searchQuery : {})
    .sort({ score: { $meta: 'textScore' }, popularity_score: -1 });
};

topicSchema.statics.getTopicAnalytics = function(topicId) {
  return this.aggregate([
    { $match: { _id: mongoose.Types.ObjectId(topicId) } },
    {
      $lookup: {
        from: 'publications',
        let: { topicId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $in: ['$$topicId', '$topics.topic_id']
              }
            }
          }
        ],
        as: 'publications'
      }
    },
    {
      $lookup: {
        from: 'authors',
        let: { topicId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: '$research_interests',
                        cond: {
                          // This would need to be adjusted based on actual schema
                          $eq: ['$$this.term', '$topicId']
                        }
                      }
                    }
                  },
                  0
                ]
              }
            }
          }
        ],
        as: 'authors'
      }
    },
    {
      $addFields: {
        publication_count: { $size: '$publications' },
        author_count: { $size: '$authors' },
        total_citations: { $sum: '$publications.citations_count' },
        average_year: { $avg: '$publications.publication_year' }
      }
    }
  ]);
};

// Pre-save middleware
topicSchema.pre('save', function(next) {
  if (this.isModified('updated_at')) {
    this.updated_at = new Date();
  }
  
  // Update path if parent or level changed
  if (this.isModified('parent_topic_id') || this.isModified('level')) {
    // This would recursively build the path
    // For now, basic implementation
    if (this.parent_topic_id) {
      this.level = 1; // Would be calculated based on parent
    } else {
      this.level = 0;
    }
  }
  
  next();
});

// Post-save middleware
topicSchema.post('save', function(doc) {
  // Trigger reindexing in Elasticsearch
  if (process.env.NODE_ENV !== 'test') {
    console.log(`Topic ${doc._id} saved - triggering reindex`);
  }
});

module.exports = mongoose.model('Topic', topicSchema);
