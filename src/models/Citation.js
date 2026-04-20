const mongoose = require('mongoose');

const citationSchema = new mongoose.Schema({
  // Citation Relationship
  citing_publication_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Publication',
    required: true
  },
  cited_publication_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Publication',
    required: true
  },
  
  // Citation Context
  citation_text: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  citation_position: {
    type: String,
    enum: ['introduction', 'methodology', 'results', 'discussion', 'conclusion', 'references'],
    default: 'references'
  },
  page_number: String,
  paragraph_number: Number,
  
  // Citation Type and Strength
  citation_type: {
    type: String,
    enum: ['supporting', 'contradicting', 'mentioning', 'background', 'methodology', 'comparison'],
    default: 'mentioning'
  },
  citation_strength: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5
  },
  sentiment: {
    type: String,
    enum: ['positive', 'negative', 'neutral'],
    default: 'neutral'
  },
  
  // Citation Analysis
  self_citation: {
    type: Boolean,
    default: false
  },
  author_self_citation: {
    type: Boolean,
    default: false
  },
  institutional_self_citation: {
    type: Boolean,
    default: false
  },
  
  // Temporal Information
  citation_year: {
    type: Number,
    min: 1800,
    max: new Date().getFullYear() + 1
  },
  citation_date: Date,
  
  // Geographic and Institutional Context
  citing_country: String,
  citing_institution: String,
  cited_country: String,
  cited_institution: String,
  
  // Journal and Field Context
  citing_journal: String,
  cited_journal: String,
  field_context: String,
  subfield_context: String,
  
  // NLP and ML Features
  semantic_similarity: {
    type: Number,
    min: 0,
    max: 1
  },
  topic_similarity: {
    type: Number,
    min: 0,
    max: 1
  },
  embeddings: {
    context_vector: [Number],
    similarity_scores: mongoose.Schema.Types.Mixed,
    model_version: String,
    generated_at: Date
  },
  
  // Citation Network Metrics
  citation_depth: {
    type: Number,
    min: 1,
    default: 1
  },
  citation_breadth: {
    type: Number,
    min: 0,
    default: 0
  },
  bibliographic_coupling: [{
    publication_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Publication'
    },
    similarity_score: Number
  }],
  co_citation: [{
    publication_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Publication'
    },
    co_citation_count: Number
  }],
  
  // Quality and Reliability
  confidence_score: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5
  },
  verification_status: {
    type: String,
    enum: ['verified', 'unverified', 'disputed'],
    default: 'unverified'
  },
  
  // Data Source and Processing
  source: {
    type: String,
    enum: ['manual', 'extracted', 'crossref', 'openalex', 'semantic_scholar', 'parsed'],
    default: 'extracted'
  },
  extraction_method: String,
  processing_status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processing_errors: [String],
  
  // Additional Metadata
  notes: String,
  tags: [String],
  
  // Timestamps
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  verified_at: Date
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'citations'
});

// Indexes for performance
citationSchema.index({ citing_publication_id: 1 });
citationSchema.index({ cited_publication_id: 1 });
citationSchema.index({ citing_publication_id: 1, cited_publication_id: 1 }, { unique: true });
citationSchema.index({ citation_year: -1 });
citationSchema.index({ citation_type: 1 });
citationSchema.index({ self_citation: 1 });
citationSchema.index({ sentiment: 1 });
citationSchema.index({ semantic_similarity: -1 });
citationSchema.index({ confidence_score: -1 });
citationSchema.index({ citing_journal: 1 });
citationSchema.index({ cited_journal: 1 });
citationSchema.index({ field_context: 1 });
citationSchema.index({ created_at: -1 });
citationSchema.index({ updated_at: -1 });

// Compound indexes
citationSchema.index({ citing_publication_id: 1, citation_year: -1 });
citationSchema.index({ cited_publication_id: 1, citation_year: -1 });
citationSchema.index({ citation_type: 1, semantic_similarity: -1 });

// Virtual fields
citationSchema.virtual('citation_age_years').get(function() {
  const currentYear = new Date().getFullYear();
  return this.citation_year ? currentYear - this.citation_year : null;
});

// Methods
citationSchema.methods.analyzeSentiment = function() {
  // This would integrate with NLP service
  // For now, basic sentiment analysis based on keywords
  const positiveWords = ['support', 'confirm', 'demonstrate', 'prove', 'validate'];
  const negativeWords = ['contradict', 'dispute', 'refute', 'challenge', 'question'];
  
  const text = (this.citation_text || '').toLowerCase();
  
  const positiveCount = positiveWords.filter(word => text.includes(word)).length;
  const negativeCount = negativeWords.filter(word => text.includes(word)).length;
  
  if (positiveCount > negativeCount) {
    this.sentiment = 'positive';
  } else if (negativeCount > positiveCount) {
    this.sentiment = 'negative';
  } else {
    this.sentiment = 'neutral';
  }
  
  return this.save();
};

citationSchema.methods.calculateSemanticSimilarity = function(embeddings) {
  // This would integrate with ML service for actual similarity calculation
  if (embeddings && this.embeddings) {
    // Placeholder for cosine similarity calculation
    this.semantic_similarity = 0.75; // Placeholder value
  }
  return this.save();
};

citationSchema.methods.updateVerificationStatus = function(status, verifiedBy = null) {
  this.verification_status = status;
  if (status === 'verified') {
    this.verified_at = new Date();
  }
  return this.save();
};

// Static methods
citationSchema.statics.findByCitingPublication = function(publicationId) {
  return this.find({ citing_publication_id: publicationId })
    .populate('cited_publication_id', 'title authors publication_year')
    .sort({ citation_year: -1 });
};

citationSchema.statics.findByCitedPublication = function(publicationId) {
  return this.find({ cited_publication_id: publicationId })
    .populate('citing_publication_id', 'title authors publication_year')
    .sort({ citation_year: -1 });
};

citationSchema.statics.findCitationNetwork = function(publicationId, depth = 2) {
  return this.aggregate([
    { $match: { cited_publication_id: mongoose.Types.ObjectId(publicationId) } },
    {
      $graphLookup: {
        from: 'citations',
        startWith: '$citing_publication_id',
        connectFromField: 'citing_publication_id',
        connectToField: 'cited_publication_id',
        as: 'citation_chain',
        maxDepth: depth
      }
    },
    {
      $lookup: {
        from: 'publications',
        localField: 'citing_publication_id',
        foreignField: '_id',
        as: 'citing_publication'
      }
    },
    {
      $lookup: {
        from: 'publications',
        localField: 'cited_publication_id',
        foreignField: '_id',
        as: 'cited_publication'
      }
    }
  ]);
};

citationSchema.statics.findSelfCitations = function(authorId) {
  return this.aggregate([
    {
      $lookup: {
        from: 'publications',
        localField: 'citing_publication_id',
        foreignField: '_id',
        as: 'citing_publication'
      }
    },
    {
      $lookup: {
        from: 'publications',
        localField: 'cited_publication_id',
        foreignField: '_id',
        as: 'cited_publication'
      }
    },
    { $unwind: '$citing_publication' },
    { $unwind: '$cited_publication' },
    {
      $match: {
        'citing_publication.authors.author_id': mongoose.Types.ObjectId(authorId),
        'cited_publication.authors.author_id': mongoose.Types.ObjectId(authorId)
      }
    }
  ]);
};

citationSchema.statics.getCitationMetrics = function(publicationId) {
  return this.aggregate([
    { $match: { cited_publication_id: mongoose.Types.ObjectId(publicationId) } },
    {
      $group: {
        _id: '$cited_publication_id',
        total_citations: { $sum: 1 },
        citations_by_year: {
          $push: {
            year: '$citation_year',
            count: 1
          }
        },
        citation_types: {
          $push: '$citation_type'
        },
        average_semantic_similarity: { $avg: '$semantic_similarity' },
        self_citations: {
          $sum: { $cond: ['$self_citation', 1, 0] }
        },
        sentiment_distribution: {
          $push: '$sentiment'
        }
      }
    },
    {
      $addFields: {
        citation_type_distribution: {
          $reduce: {
            input: '$citation_types',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [
                    [{ k: '$$this', v: { $add: [{ $ifNull: [{ $getField: { field: '$$this', input: '$$value' } }, 0] }, 1] } }]
                  ]
                }
              ]
            }
          }
        }
      }
    }
  ]);
};

citationSchema.statics.findBibliographicCoupling = function(publicationId, threshold = 0.1) {
  return this.aggregate([
    { $match: { citing_publication_id: mongoose.Types.ObjectId(publicationId) } },
    {
      $lookup: {
        from: 'citations',
        let: { citedId: '$cited_publication_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $ne: ['$citing_publication_id', mongoose.Types.ObjectId(publicationId)] },
                  { $eq: ['$cited_publication_id', '$$citedId'] }
                ]
              }
            }
          }
        ],
        as: 'shared_citations'
      }
    },
    { $unwind: '$shared_citations' },
    {
      $group: {
        _id: '$shared_citations.citing_publication_id',
        shared_citations_count: { $sum: 1 },
        shared_citations: { $push: '$cited_publication_id' }
      }
    },
    { $match: { shared_citations_count: { $gte: 2 } } },
    {
      $lookup: {
        from: 'publications',
        localField: '_id',
        foreignField: '_id',
        as: 'publication'
      }
    },
    { $unwind: '$publication' },
    {
      $project: {
        publication_id: '$_id',
        title: '$publication.title',
        shared_citations_count: 1,
        shared_citations: 1,
        coupling_strength: { $divide: ['$shared_citations_count', { $size: '$shared_citations' }] }
      }
    },
    { $match: { coupling_strength: { $gte: threshold } } },
    { $sort: { coupling_strength: -1 } }
  ]);
};

// Pre-save middleware
citationSchema.pre('save', function(next) {
  if (this.isModified('updated_at')) {
    this.updated_at = new Date();
  }
  
  // Set citation_year if citation_date is provided
  if (this.isModified('citation_date') && this.citation_date) {
    this.citation_year = this.citation_date.getFullYear();
  }
  
  next();
});

// Post-save middleware
citationSchema.post('save', function(doc) {
  // Update citation counts in publications
  if (process.env.NODE_ENV !== 'test') {
    console.log(`Citation ${doc._id} saved - updating publication counts`);
  }
});

module.exports = mongoose.model('Citation', citationSchema);
