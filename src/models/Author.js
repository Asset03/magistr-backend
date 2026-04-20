const mongoose = require('mongoose');

const publicationReferenceSchema = new mongoose.Schema({
  publication_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Publication',
    required: true
  },
  title: String,
  year: Number,
  journal: String,
  citations_count: Number,
  role: String
}, { _id: false });

const affiliationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  department: String,
  institution: String,
  country: String,
  city: String,
  start_year: Number,
  end_year: Number,
  current: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const socialProfileSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ['orcid', 'google_scholar', 'researchgate', 'twitter', 'linkedin', 'github']
  },
  url: String,
  username: String,
  verified: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const authorSchema = new mongoose.Schema({
  // Basic Information
  first_name: {
    type: String,
    required: true,
    trim: true
  },
  last_name: {
    type: String,
    required: true,
    trim: true
  },
  middle_name: String,
  full_name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    sparse: true
  },
  
  // Academic Identifiers
  orcid: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  scopus_id: String,
  researcher_id: String,
  openalex_id: String,
  
  // Affiliations
  affiliations: [affiliationSchema],
  current_affiliation: affiliationSchema,
  
  // Academic Metrics
  h_index: {
    type: Number,
    default: 0,
    min: 0
  },
  g_index: {
    type: Number,
    default: 0,
    min: 0
  },
  i10_index: {
    type: Number,
    default: 0,
    min: 0
  },
  total_citations: {
    type: Number,
    default: 0,
    min: 0
  },
  total_publications: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Publications
  publications: [publicationReferenceSchema],
  
  // Research Interests and Expertise
  research_interests: [{
    term: String,
    weight: Number,
    source: String
  }],
  expertise_areas: [{
    area: String,
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'expert', 'pioneer']
    },
    years_experience: Number
  }],
  
  // Collaboration Network
  collaborators: [{
    author_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Author'
    },
    name: String,
    collaboration_count: Number,
    last_collaboration_year: Number
  }],
  
  // Social and Professional Profiles
  social_profiles: [socialProfileSchema],
  personal_website: String,
  academic_profile: String,
  
  // Geographic Information
  country: String,
  city: String,
  region: String,
  
  // Career Information
  career_stage: {
    type: String,
    enum: ['phd_student', 'postdoc', 'assistant_professor', 'associate_professor', 'professor', 'researcher', 'industry_professional', 'retired']
  },
  years_active: Number,
  first_publication_year: Number,
  last_publication_year: Number,
  
  // NLP and ML Features
  embeddings: {
    name_vector: [Number],
    interests_vector: [Number],
    publications_vector: [Number],
    model_version: String,
    generated_at: Date
  },
  
  // Activity and Engagement
  last_active: Date,
  profile_completeness: {
    type: Number,
    min: 0,
    max: 1
  },
  
  // Verification and Status
  verified: {
    type: Boolean,
    default: false
  },
  verification_method: String,
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  
  // Data Source
  source: {
    type: String,
    enum: ['manual', 'openalex', 'orcid', 'scopus', 'crossref', 'import'],
    default: 'manual'
  },
  source_id: String,
  
  // Timestamps
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  last_synced_at: Date
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'authors'
});

// Indexes for performance
authorSchema.index({ full_name: 'text', first_name: 'text', last_name: 'text' });
authorSchema.index({ orcid: 1 }, { unique: true, sparse: true });
authorSchema.index({ openalex_id: 1 }, { sparse: true });
authorSchema.index({ scopus_id: 1 }, { sparse: true });
authorSchema.index({ email: 1 }, { sparse: true });
authorSchema.index({ h_index: -1 });
authorSchema.index({ total_citations: -1 });
authorSchema.index({ total_publications: -1 });
authorSchema.index({ 'affiliations.name': 1 });
authorSchema.index({ country: 1 });
authorSchema.index({ career_stage: 1 });
authorSchema.index({ research_interests: 1 });
authorSchema.index({ created_at: -1 });
authorSchema.index({ updated_at: -1 });

// Compound indexes
authorSchema.index({ h_index: -1, total_publications: -1 });
authorSchema.index({ country: 1, h_index: -1 });
authorSchema.index({ 'affiliations.name': 1, total_citations: -1 });

// Virtual fields
authorSchema.virtual('citations_per_publication').get(function() {
  return this.total_publications > 0 ? this.total_citations / this.total_publications : 0;
});

authorSchema.virtual('publications_per_year').get(function() {
  const yearsActive = Math.max(1, this.years_active || 1);
  return this.total_publications / yearsActive;
});

authorSchema.virtual('collaboration_count').get(function() {
  return this.collaborators.length;
});

// Methods
authorSchema.methods.addPublication = function(publicationData) {
  this.publications.push(publicationData);
  this.total_publications = this.publications.length;
  this.last_publication_year = Math.max(this.last_publication_year || 0, publicationData.year || new Date().getFullYear());
  this.first_publication_year = this.first_publication_year || this.last_publication_year;
  this.years_active = this.last_publication_year - this.first_publication_year + 1;
  return this.save();
};

authorSchema.methods.updateMetrics = function(metrics) {
  if (metrics.h_index !== undefined) this.h_index = metrics.h_index;
  if (metrics.g_index !== undefined) this.g_index = metrics.g_index;
  if (metrics.i10_index !== undefined) this.i10_index = metrics.i10_index;
  if (metrics.total_citations !== undefined) this.total_citations = metrics.total_citations;
  return this.save();
};

authorSchema.methods.addCollaborator = function(collaboratorData) {
  const existingCollaborator = this.collaborators.find(
    c => c.author_id.toString() === collaboratorData.author_id.toString()
  );
  
  if (existingCollaborator) {
    existingCollaborator.collaboration_count += 1;
    existingCollaborator.last_collaboration_year = collaboratorData.year;
  } else {
    this.collaborators.push(collaboratorData);
  }
  
  return this.save();
};

authorSchema.methods.calculateProfileCompleteness = function() {
  let completeness = 0;
  const fields = [
    'first_name', 'last_name', 'email', 'orcid',
    'affiliations', 'research_interests', 'social_profiles'
  ];
  
  fields.forEach(field => {
    if (this[field] && (Array.isArray(this[field]) ? this[field].length > 0 : true)) {
      completeness += 1;
    }
  });
  
  this.profile_completeness = completeness / fields.length;
  return this.save();
};

// Static methods
authorSchema.statics.findByName = function(name) {
  return this.find({
    $or: [
      { full_name: { $regex: name, $options: 'i' } },
      { first_name: { $regex: name, $options: 'i' } },
      { last_name: { $regex: name, $options: 'i' } }
    ]
  });
};

authorSchema.statics.findByAffiliation = function(affiliationName) {
  return this.find({
    'affiliations.name': { $regex: affiliationName, $options: 'i' }
  }).sort({ h_index: -1 });
};

authorSchema.statics.findByCountry = function(country) {
  return this.find({
    country: { $regex: country, $options: 'i' }
  }).sort({ h_index: -1 });
};

authorSchema.statics.findTopAuthors = function(limit = 50) {
  return this.find({ status: 'active' })
    .sort({ h_index: -1, total_citations: -1 })
    .limit(limit);
};

authorSchema.statics.findCollaborators = function(authorId, maxDepth = 2) {
  return this.findById(authorId)
    .populate({
      path: 'collaborators.author_id',
      populate: {
        path: 'collaborators.author_id',
        match: { 'collaborators.author_id': authorId }
      }
    });
};

authorSchema.statics.search = function(query, filters = {}) {
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
  if (filters.country) {
    searchQuery.$and.push({
      country: { $regex: filters.country, $options: 'i' }
    });
  }

  if (filters.affiliation) {
    searchQuery.$and.push({
      'affiliations.name': { $regex: filters.affiliation, $options: 'i' }
    });
  }

  if (filters.minHIndex) {
    searchQuery.$and.push({
      h_index: { $gte: filters.minHIndex }
    });
  }

  if (filters.careerStage) {
    searchQuery.$and.push({
      career_stage: filters.careerStage
    });
  }

  return this.find(searchQuery.$and.length > 0 ? searchQuery : {})
    .sort({ score: { $meta: 'textScore' }, h_index: -1 });
};

// Pre-save middleware
authorSchema.pre('save', function(next) {
  if (this.isModified('updated_at')) {
    this.updated_at = new Date();
  }
  
  // Update full_name if first_name or last_name changed
  if (this.isModified('first_name') || this.isModified('last_name')) {
    this.full_name = `${this.first_name} ${this.middle_name ? this.middle_name + ' ' : ''}${this.last_name}`.trim();
  }
  
  next();
});

// Post-save middleware
authorSchema.post('save', function(doc) {
  // Trigger reindexing in Elasticsearch
  if (process.env.NODE_ENV !== 'test') {
    console.log(`Author ${doc._id} saved - triggering reindex`);
  }
});

module.exports = mongoose.model('Author', authorSchema);
