const request = require('supertest');
const app = require('../src/server');
const Publication = require('../src/models/Publication');

describe('Publications Endpoints', () => {
  describe('GET /api/publications', () => {
    beforeEach(async () => {
      // Create test publications
      await global.createTestPublication({
        title: 'Machine Learning Basics',
        publicationYear: 2023
      });
      
      await global.createTestPublication({
        title: 'Advanced AI Research',
        publicationYear: 2022
      });
    });

    it('should get all publications successfully', async () => {
      const response = await request(app)
        .get('/api/publications')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(2);
    });

    it('should filter publications by author', async () => {
      const testUser = await global.createTestUser();
      const publication = await global.createTestPublication({
        title: 'Author Specific Paper',
        authors: [{
          author: testUser._id,
          order: 1,
          isCorresponding: true
        }]
      });

      const response = await request(app)
        .get(`/api/publications?author=${testUser._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Author Specific Paper');
    });

    it('should filter publications by year', async () => {
      const response = await request(app)
        .get('/api/publications?year=2023')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].publicationYear).toBe(2023);
    });

    it('should sort publications by citations count', async () => {
      await global.createTestPublication({
        title: 'Highly Cited Paper',
        citationsCount: 100
      });

      const response = await request(app)
        .get('/api/publications?sort=citationsCount&order=desc')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data[0].citationsCount).toBe(100);
    });

    it('should paginate results correctly', async () => {
      // Create more publications
      for (let i = 0; i < 5; i++) {
        await global.createTestPublication({
          title: `Test Paper ${i}`
        });
      }

      const response = await request(app)
        .get('/api/publications?page=1&limit=3')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(3);
      expect(response.body.pagination.pages).toBe(3); // 7 total, 3 per page
    });
  });

  describe('GET /api/publications/:id', () => {
    it('should get publication by ID successfully', async () => {
      const publication = await global.createTestPublication();

      const response = await request(app)
        .get(`/api/publications/${publication._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(publication._id.toString());
      expect(response.body.data.title).toBe(publication.title);
    });

    it('should return 404 for non-existent publication', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .get(`/api/publications/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Publication not found');
    });

    it('should increment view count', async () => {
      const publication = await global.createTestPublication({
        metrics: { views: 0 }
      });

      // First request
      await request(app)
        .get(`/api/publications/${publication._id}`)
        .expect(200);

      // Second request to check view count
      const response = await request(app)
        .get(`/api/publications/${publication._id}`)
        .expect(200);

      expect(response.body.data.metrics.views).toBe(1);
    });
  });

  describe('POST /api/publications', () => {
    let token;
    let researcherUser;

    beforeEach(async () => {
      researcherUser = await global.createTestUser({ role: 'researcher' });
      token = global.generateTestToken(researcherUser);
    });

    it('should create publication successfully', async () => {
      const publicationData = {
        title: 'New Research Paper',
        abstract: 'This is a new research paper abstract.',
        authors: [{
          author: researcherUser._id,
          order: 1,
          isCorresponding: true
        }],
        keywords: ['research', 'paper'],
        publicationYear: 2023,
        publicationType: 'journal',
        accessType: 'open'
      };

      const response = await request(app)
        .post('/api/publications')
        .set('Authorization', `Bearer ${token}`)
        .send(publicationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(publicationData.title);
      expect(response.body.data.authors).toHaveLength(1);
    });

    it('should return validation error for missing required fields', async () => {
      const invalidData = {
        title: 'Incomplete Paper'
        // Missing abstract, authors, publicationYear
      };

      const response = await request(app)
        .post('/api/publications')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation failed');
    });

    it('should return 401 for unauthenticated request', async () => {
      const publicationData = {
        title: 'Unauthorized Paper',
        abstract: 'This should not be created.',
        authors: [],
        publicationYear: 2023
      };

      const response = await request(app)
        .post('/api/publications')
        .send(publicationData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-researcher user', async () => {
      const regularUser = await global.createTestUser({ role: 'user' });
      const userToken = global.generateTestToken(regularUser);

      const publicationData = {
        title: 'Forbidden Paper',
        abstract: 'Regular users cannot create publications.',
        authors: [],
        publicationYear: 2023
      };

      const response = await request(app)
        .post('/api/publications')
        .set('Authorization', `Bearer ${userToken}`)
        .send(publicationData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Access denied');
    });
  });

  describe('POST /api/publications/search', () => {
    beforeEach(async () => {
      // Create test publications for search
      await global.createTestPublication({
        title: 'Machine Learning in Healthcare',
        abstract: 'Applying ML algorithms to medical data.',
        keywords: ['machine learning', 'healthcare', 'ai'],
        publicationYear: 2023
      });

      await global.createTestPublication({
        title: 'Deep Neural Networks',
        abstract: 'Advanced neural network architectures.',
        keywords: ['deep learning', 'neural networks'],
        publicationYear: 2022
      });
    });

    it('should search publications by query', async () => {
      const searchData = {
        query: 'machine learning',
        limit: 10
      };

      const response = await request(app)
        .post('/api/publications/search')
        .send(searchData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should filter search results by keywords', async () => {
      const searchData = {
        keywords: ['healthcare'],
        limit: 10
      };

      const response = await request(app)
        .post('/api/publications/search')
        .send(searchData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].keywords).toContain('healthcare');
    });

    it('should filter search results by year range', async () => {
      const searchData = {
        yearRange: {
          start: 2023,
          end: 2023
        },
        limit: 10
      };

      const response = await request(app)
        .post('/api/publications/search')
        .send(searchData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].publicationYear).toBe(2023);
    });

    it('should return empty results for non-matching query', async () => {
      const searchData = {
        query: 'nonexistent topic',
        limit: 10
      };

      const response = await request(app)
        .post('/api/publications/search')
        .send(searchData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/publications/:id/similar', () => {
    it('should find similar publications', async () => {
      const publication = await global.createTestPublication({
        title: 'Machine Learning Research',
        keywords: ['machine learning', 'ai', 'research']
      });

      // Create similar publication
      await global.createTestPublication({
        title: 'AI and Machine Learning',
        keywords: ['machine learning', 'ai', 'artificial intelligence']
      });

      const response = await request(app)
        .get(`/api/publications/${publication._id}/similar`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should return 404 for non-existent publication', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .get(`/api/publications/${fakeId}/similar`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/publications/:id', () => {
    let token;
    let publication;
    let researcherUser;

    beforeEach(async () => {
      researcherUser = await global.createTestUser({ role: 'researcher' });
      token = global.generateTestToken(researcherUser);
      publication = await global.createTestPublication();
    });

    it('should update publication successfully', async () => {
      const updateData = {
        title: 'Updated Title',
        abstract: 'Updated abstract content.'
      };

      const response = await request(app)
        .put(`/api/publications/${publication._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.abstract).toBe(updateData.abstract);
    });

    it('should return 404 for non-existent publication', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const updateData = { title: 'Updated Title' };

      const response = await request(app)
        .put(`/api/publications/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-researcher user', async () => {
      const regularUser = await global.createTestUser({ role: 'user' });
      const userToken = global.generateTestToken(regularUser);
      const updateData = { title: 'Updated Title' };

      const response = await request(app)
        .put(`/api/publications/${publication._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/publications/:id', () => {
    let token;
    let publication;
    let adminUser;

    beforeEach(async () => {
      adminUser = await global.createTestUser({ role: 'admin' });
      token = global.generateTestToken(adminUser);
      publication = await global.createTestPublication();
    });

    it('should delete publication successfully', async () => {
      const response = await request(app)
        .delete(`/api/publications/${publication._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');

      // Verify publication is deleted
      const deletedPublication = await Publication.findById(publication._id);
      expect(deletedPublication).toBeNull();
    });

    it('should return 404 for non-existent publication', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .delete(`/api/publications/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-admin user', async () => {
      const researcherUser = await global.createTestUser({ role: 'researcher' });
      const researcherToken = global.generateTestToken(researcherUser);

      const response = await request(app)
        .delete(`/api/publications/${publication._id}`)
        .set('Authorization', `Bearer ${researcherToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });
});
