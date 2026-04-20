const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Information
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-zA-Z0-9_]+$/
  },
  email: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: {
    type: String,
    required: function() {
      return !this.oauth_provider; // Password not required for OAuth users
    },
    minlength: 6
  },
  
  // Profile Information
  first_name: {
    type: String,
    trim: true,
    maxlength: 50
  },
  last_name: {
    type: String,
    trim: true,
    maxlength: 50
  },
  full_name: {
    type: String,
    trim: true,
    maxlength: 100
  },
  avatar: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    maxlength: 500
  },
  
  // OAuth Information
  oauth_provider: {
    type: String,
    enum: ['google', 'orcid', 'github', null],
    default: null
  },
  oauth_id: {
    type: String,
    sparse: true
  },
  
  // Role and Permissions
  role: {
    type: String,
    enum: ['admin', 'researcher', 'user', 'guest'],
    default: 'user'
  },
  permissions: [{
    type: String,
    enum: [
      'read:all', 'write:all', 'delete:all', 'manage:users',
      'manage:system', 'access:analytics', 'import:data', 'export:data',
      'read:public', 'write:own', 'delete:own', 'export:own'
    ]
  }],
  
  // Institutional Information
  institution: {
    name: String,
    department: String,
    position: String,
    country: String,
    website: String
  },
  
  // Research Interests
  research_interests: [String],
  specializations: [String],
  
  // Academic Information
  orcid: {
    type: String,
    unique: true,
    sparse: true,
    match: /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/
  },
  academic_profile: {
    google_scholar: String,
    researchgate: String,
    linkedin: String,
    personal_website: String
  },
  
  // Preferences
  preferences: {
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ru']
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    email_notifications: {
      type: Boolean,
      default: true
    },
    newsletter: {
      type: Boolean,
      default: false
    },
    privacy: {
      profile_visibility: {
        type: String,
        enum: ['public', 'registered', 'private'],
        default: 'public'
      },
      show_email: {
        type: Boolean,
        default: false
      },
      show_institution: {
        type: Boolean,
        default: true
      }
    }
  },
  
  // Activity Tracking
  last_login: Date,
  login_count: {
    type: Number,
    default: 0
  },
  last_activity: Date,
  
  // Account Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  
  // Statistics
  statistics: {
    publications_viewed: {
      type: Number,
      default: 0
    },
    searches_performed: {
      type: Number,
      default: 0
    },
    downloads: {
      type: Number,
      default: 0
    },
    citations_added: {
      type: Number,
      default: 0
    }
  },
  
  // Metadata
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  deleted_at: Date
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'users'
});

// Indexes
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ orcid: 1 }, { unique: true, sparse: true });
userSchema.index({ oauth_provider: 1, oauth_id: 1 }, { sparse: true });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ 'institution.country': 1 });
userSchema.index({ created_at: -1 });
userSchema.index({ last_login: -1 });

// Virtual fields
userSchema.virtual('full_name_calc').get(function() {
  if (this.full_name) return this.full_name;
  return `${this.first_name || ''} ${this.last_name || ''}`.trim();
});

userSchema.virtual('is_active').get(function() {
  return this.status === 'active';
});

userSchema.virtual('profile_completion').get(function() {
  let completed = 0;
  const total = 8; // Total fields to check
  
  if (this.first_name) completed++;
  if (this.last_name) completed++;
  if (this.institution?.name) completed++;
  if (this.research_interests?.length > 0) completed++;
  if (this.bio) completed++;
  if (this.avatar) completed++;
  if (this.academic_profile?.google_scholar) completed++;
  if (this.orcid) completed++;
  
  return Math.round((completed / total) * 100);
});

// Pre-save middleware
userSchema.pre('save', async function(next) {
  // Hash password if modified
  if (this.isModified('password') && this.password) {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
  }
  
  // Update full_name if first_name or last_name changed
  if (this.isModified('first_name') || this.isModified('last_name')) {
    this.full_name = `${this.first_name || ''} ${this.last_name || ''}`.trim();
  }
  
  // Update updated_at
  if (this.isNew || this.isModified()) {
    this.updated_at = new Date();
  }
  
  next();
});

// Methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

userSchema.methods.updateLastLogin = function() {
  this.last_login = new Date();
  this.login_count = (this.login_count || 0) + 1;
  this.last_activity = new Date();
  return this.save();
};

userSchema.methods.updateActivity = function() {
  this.last_activity = new Date();
  return this.save();
};

userSchema.methods.incrementStatistic = function(statistic, amount = 1) {
  if (this.statistics[statistic] !== undefined) {
    this.statistics[statistic] += amount;
    return this.save();
  }
  throw new Error(`Invalid statistic: ${statistic}`);
};

userSchema.methods.getPublicProfile = function() {
  const publicFields = {
    username: this.username,
    full_name: this.full_name_calc,
    avatar: this.avatar,
    bio: this.bio,
    institution: this.preferences.privacy.show_institution ? this.institution : null,
    research_interests: this.research_interests,
    academic_profile: this.academic_profile,
    orcid: this.orcid,
    created_at: this.created_at,
    profile_completion: this.profile_completion
  };
  
  if (this.preferences.privacy.profile_visibility === 'public') {
    return publicFields;
  } else if (this.preferences.privacy.profile_visibility === 'registered') {
    // Would need to check if requester is authenticated
    return publicFields;
  }
  
  // Private profile
  return {
    username: this.username,
    avatar: this.avatar
  };
};

// Static methods
userSchema.statics.findByUsernameOrEmail = function(identifier) {
  return this.findOne({
    $or: [
      { username: identifier },
      { email: identifier }
    ]
  });
};

userSchema.statics.findByOAuth = function(provider, oauthId) {
  return this.findOne({
    oauth_provider: provider,
    oauth_id: oauthId
  });
};

userSchema.statics.findActiveUsers = function() {
  return this.find({
    status: 'active'
  });
};

userSchema.statics.getUserStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        statuses: {
          $push: {
            status: '$_id',
            count: '$count'
          }
        },
        total: { $sum: '$count' }
      }
    }
  ]);
};

userSchema.statics.getActivityStats = function(days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        last_activity: { $gte: cutoffDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$last_activity' },
          month: { $month: '$last_activity' },
          day: { $dayOfMonth: '$last_activity' }
        },
        active_users: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);
};

module.exports = mongoose.model('User', userSchema);
