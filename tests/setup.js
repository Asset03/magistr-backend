const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Setup test database
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri);
});

// Cleanup test database
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Clear database between tests
afterEach(async () => {
  const collections = mongoose.connection.collections;
  
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Global test utilities
global.createTestUser = async (userData = {}) => {
  const User = require('../src/models/User');
  const defaultUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    role: 'user',
    ...userData
  };
  
  return await User.create(defaultUser);
};

global.createTestPublication = async (publicationData = {}) => {
  const Publication = require('../src/models/Publication');
  const testUser = await global.createTestUser();
  
  const defaultPublication = {
    title: 'Test Publication',
    abstract: 'This is a test publication for testing purposes.',
    authors: [{
      author: testUser._id,
      order: 1,
      isCorresponding: true
    }],
    keywords: ['test', 'publication'],
    publicationYear: 2023,
    publicationType: 'journal',
    accessType: 'open',
    language: 'en',
    ...publicationData
  };
  
  return await Publication.create(defaultPublication);
};

global.createTestAuthorProfile = async (profileData = {}) => {
  const AuthorProfile = require('../src/models/Author');
  const testUser = await global.createTestUser();
  
  const defaultProfile = {
    user: testUser._id,
    academicTitle: 'professor',
    department: 'Computer Science',
    faculty: 'Engineering',
    bio: 'Test author profile',
    researchInterests: [
      { name: 'Machine Learning', weight: 0.9 }
    ],
    ...profileData
  };
  
  return await AuthorProfile.create(defaultProfile);
};

global.generateTestToken = (user) => {
  const jwt = require('jsonwebtoken');
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret');
};
