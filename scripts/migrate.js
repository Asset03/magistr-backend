const mongoose = require('mongoose');
const database = require('../src/config/database');
const logger = require('../src/utils/logger');

async function migrate() {
  try {
    logger.info('Starting database migration...');
    
    // Connect to database
    await database.connect();
    
    // Create indexes
    logger.info('Creating database indexes...');
    
    const Publication = require('../src/models/Publication');
    const Author = require('../src/models/Author');
    const Citation = require('../src/models/Citation');
    const Topic = require('../src/models/Topic');
    const User = require('../src/models/User');

    // Create indexes for each model
    await Promise.all([
      Publication.createIndexes(),
      Author.createIndexes(),
      Citation.createIndexes(),
      Topic.createIndexes(),
      User.createIndexes()
    ]);
    
    logger.info('Database indexes created successfully');
    
    // Run any custom migration logic here
    await runCustomMigrations();
    
    logger.info('Database migration completed successfully');
    
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
}

async function runCustomMigrations() {
  // Add custom migration logic here
  logger.info('Running custom migrations...');
  
  // Example: Add default admin user if not exists
  const User = require('../src/models/User');
  const adminExists = await User.findOne({ role: 'admin' });
  
  if (!adminExists) {
    const adminUser = new User({
      username: 'admin',
      email: 'admin@scientific-publications.com',
      password: 'admin123', // This should be changed immediately
      role: 'admin',
      status: 'active',
      email_verified: true,
      first_name: 'System',
      last_name: 'Administrator'
    });
    
    await adminUser.save();
    logger.info('Default admin user created');
  }
  
  // Example: Initialize default topics
  const Topic = require('../src/models/Topic');
  const topicCount = await Topic.countDocuments();
  
  if (topicCount === 0) {
    const defaultTopics = [
      {
        name: 'Machine Learning',
        category: 'stem',
        description: 'Machine learning and artificial intelligence research',
        keywords: [
          { term: 'machine learning', weight: 1.0, source: 'manual' },
          { term: 'artificial intelligence', weight: 0.9, source: 'manual' },
          { term: 'neural networks', weight: 0.8, source: 'manual' }
        ],
        validation_status: 'validated',
        source: 'manual'
      },
      {
        name: 'Natural Language Processing',
        category: 'stem',
        description: 'Natural language processing and computational linguistics',
        keywords: [
          { term: 'natural language processing', weight: 1.0, source: 'manual' },
          { term: 'computational linguistics', weight: 0.9, source: 'manual' },
          { term: 'text mining', weight: 0.8, source: 'manual' }
        ],
        validation_status: 'validated',
        source: 'manual'
      },
      {
        name: 'Bioinformatics',
        category: 'stem',
        description: 'Bioinformatics and computational biology',
        keywords: [
          { term: 'bioinformatics', weight: 1.0, source: 'manual' },
          { term: 'computational biology', weight: 0.9, source: 'manual' },
          { term: 'genomics', weight: 0.8, source: 'manual' }
        ],
        validation_status: 'validated',
        source: 'manual'
      },
      {
        name: 'Data Science',
        category: 'stem',
        description: 'Data science and big data analytics',
        keywords: [
          { term: 'data science', weight: 1.0, source: 'manual' },
          { term: 'big data', weight: 0.9, source: 'manual' },
          { term: 'analytics', weight: 0.8, source: 'manual' }
        ],
        validation_status: 'validated',
        source: 'manual'
      },
      {
        name: 'Computer Vision',
        category: 'stem',
        description: 'Computer vision and image processing',
        keywords: [
          { term: 'computer vision', weight: 1.0, source: 'manual' },
          { term: 'image processing', weight: 0.9, source: 'manual' },
          { term: 'object detection', weight: 0.8, source: 'manual' }
        ],
        validation_status: 'validated',
        source: 'manual'
      }
    ];
    
    await Topic.insertMany(defaultTopics);
    logger.info('Default topics created');
  }
  
  logger.info('Custom migrations completed');
}

// Run migration if called directly
if (require.main === module) {
  migrate();
}

module.exports = migrate;
