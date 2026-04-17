const mongoose = require('mongoose');

const authorProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  academicTitle: {
    type: String,
    enum: ['professor', 'associate_professor', 'assistant_professor', 'lecturer', 'researcher', 'phd_candidate', 'msc_student', 'other'],
    default: 'researcher'
  },
  department: {
    type: String,
    trim: true,
    maxlength: [100, 'Department name cannot exceed 100 characters']
  },
  faculty: {
    type: String,
    trim: true,
    maxlength: [100, 'Faculty name cannot exceed 100 characters']
  },
  orcid: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
    match: [/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/, 'Please enter a valid ORCID ID']
  },
  scopusId: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  researchGateId: {
    type: String,
    trim: true
  },
  googleScholarId: {
    type: String,
    trim: true
  },
  bio: {
    type: String,
    trim: true,
    maxlength: [2000, 'Bio cannot exceed 2000 characters']
  },
  researchInterests: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    weight: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    }
  }],
  education: [{
    degree: {
      type: String,
      required: true,
      enum: ['bachelor', 'master', 'phd', 'postdoc', 'other']
    },
    field: {
      type: String,
      required: true,
      trim: true
    },
    institution: {
      type: String,
      required: true,
      trim: true
    },
    year: {
      type: Number,
      required: true,
      min: 1950,
      max: new Date().getFullYear() + 10
    }
  }],
  workExperience: [{
    position: {
      type: String,
      required: true,
      trim: true
    },
    institution: {
      type: String,
      required: true,
      trim: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date
    },
    current: {
      type: Boolean,
      default: false
    }
  }],
  awards: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    organization: {
      type: String,
      trim: true
    },
    year: {
      type: Number,
      required: true,
      min: 1950,
      max: new Date().getFullYear() + 10
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Award description cannot exceed 500 characters']
    }
  }],
  metrics: {
    hIndex: {
      type: Number,
      default: 0,
      min: 0
    },
    i10Index: {
      type: Number,
      default: 0,
      min: 0
    },
    totalCitations: {
      type: Number,
      default: 0,
      min: 0
    },
    publicationsCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  socialLinks: {
    linkedin: String,
    twitter: String,
    website: String,
    github: String
  },
  collaborationNetwork: [{
    collaborator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AuthorProfile'
    },
    collaborationCount: {
      type: Number,
      default: 1
    },
    lastCollaboration: {
      type: Date,
      default: Date.now
    }
  }],
  expertiseAreas: [{
    area: {
      type: String,
      required: true,
      trim: true
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      default: 'intermediate'
    },
    publicationsCount: {
      type: Number,
      default: 0,
      min: 0
    }
  }],
  reviewerInfo: {
    isReviewer: {
      type: Boolean,
      default: false
    },
    reviewerFor: [{
      journal: String,
      conference: String,
      since: Date
    }],
    reviewCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
authorProfileSchema.index({ user: 1 }, { unique: true });
authorProfileSchema.index({ orcid: 1 }, { unique: true, sparse: true });
authorProfileSchema.index({ scopusId: 1 }, { unique: true, sparse: true });
authorProfileSchema.index({ 'researchInterests.name': 1 });
authorProfileSchema.index({ 'metrics.hIndex': -1 });
authorProfileSchema.index({ 'metrics.totalCitations': -1 });
authorProfileSchema.index({ createdAt: -1 });

// Virtual for publications
authorProfileSchema.virtual('publications', {
  ref: 'Publication',
  localField: 'user',
  foreignField: 'authors.author',
  options: { sort: { publicationYear: -1 } }
});

// Virtual for co-authors
authorProfileSchema.virtual('coAuthors', {
  ref: 'AuthorProfile',
  localField: '_id',
  foreignField: 'collaborationNetwork.collaborator'
});

// Pre-save middleware to update lastUpdated
authorProfileSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Static method to update metrics
authorProfileSchema.statics.updateMetrics = async function(authorId) {
  const Publication = mongoose.model('Publication');
  
  const publications = await Publication.find({ 'authors.author': authorId });
  const totalCitations = publications.reduce((sum, pub) => sum + (pub.citationsCount || 0), 0);
  
  // Calculate h-index (simplified version)
  const citationCounts = publications.map(pub => pub.citationsCount || 0).sort((a, b) => b - a);
  let hIndex = 0;
  for (let i = 0; i < citationCounts.length; i++) {
    if (citationCounts[i] >= i + 1) {
      hIndex = i + 1;
    } else {
      break;
    }
  }
  
  // Calculate i10-index (number of publications with at least 10 citations)
  const i10Index = citationCounts.filter(count => count >= 10).length;
  
  await this.findByIdAndUpdate(authorId, {
    'metrics.hIndex': hIndex,
    'metrics.i10Index': i10Index,
    'metrics.totalCitations': totalCitations,
    'metrics.publicationsCount': publications.length
  });
};

// Static method to find potential collaborators
authorProfileSchema.statics.findPotentialCollaborators = async function(authorId, limit = 10) {
  const authorProfile = await this.findById(authorId).populate('user');
  if (!authorProfile) return [];
  
  const researchInterests = authorProfile.researchInterests.map(ri => ri.name);
  
  const potentialCollaborators = await this.find({
    _id: { $ne: authorId },
    'researchInterests.name': { $in: researchInterests },
    isActive: true
  })
  .populate('user')
  .limit(limit)
  .exec();
  
  return potentialCollaborators;
};

module.exports = mongoose.model('AuthorProfile', authorProfileSchema);
