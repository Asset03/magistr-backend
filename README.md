# Scientific Publications Analysis Backend

A comprehensive backend system for analyzing scientific publications with NLP and ML capabilities, built with Node.js, Express, MongoDB, and Python.

## Features

### Core Functionality
- **Publication Management**: CRUD operations for scientific publications with full-text search
- **Author Management**: Author profiles with metrics, collaboration networks, and affiliations
- **Citation Analysis**: Citation relationships, networks, and impact metrics
- **Topic Modeling**: Automatic topic discovery and trending analysis
- **Advanced Analytics**: Trends, insights, and statistical analysis

### NLP & ML Integration
- **Text Processing**: Tokenization, entity extraction, sentiment analysis
- **Topic Modeling**: LDA, NMF, and BERTopic implementations
- **Embeddings**: Semantic similarity and document vectorization
- **Language Detection**: Multi-language support with confidence scoring
- **Citation Analysis**: Automatic citation type classification and sentiment

### Data Processing
- **ETL Pipelines**: Automated data import from external sources (OpenAlex, Crossref)
- **Document Parsing**: PDF, DOC, DOCX, TXT processing
- **Batch Operations**: Efficient bulk data processing
- **Scheduled Jobs**: Automated daily and hourly updates

### Security & Performance
- **JWT Authentication**: Secure user authentication with role-based access
- **Rate Limiting**: API protection against abuse
- **Caching**: Redis-based caching for performance
- **Validation**: Comprehensive input validation and sanitization

## Architecture

### Multi-tier Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │   Backend API   │    │  NLP/Python    │
│   (Next.js)     │◄──►│   (Node.js)     │◄──►│   Service       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Data Layer    │
                       │  (MongoDB +     │
                       │   Redis)        │
                       └─────────────────┘
```

### Technology Stack

#### Backend
- **Node.js** with Express.js framework
- **MongoDB** with Mongoose ODM
- **Redis** for caching and session management
- **JWT** for authentication
- **Winston** for logging
- **Jest** for testing

#### NLP/Python Service
- **spaCy** for advanced NLP processing
- **scikit-learn** for machine learning
- **transformers** for BERT models
- **sentence-transformers** for embeddings
- **BERTopic** for topic modeling
- **Flask** as the web framework

#### Database
- **MongoDB** as primary database
- **Redis** for caching and queues
- **Elasticsearch** (optional) for search

## Quick Start

### Prerequisites
- Node.js 16+
- MongoDB 4.4+
- Redis 6+
- Python 3.8+
- pip (Python package manager)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd scientific-publications-backend
```

2. **Install backend dependencies**
```bash
npm install
```

3. **Install Python NLP service dependencies**
```bash
cd python-nlp-service
pip install -r requirements.txt
```

4. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. **Start MongoDB and Redis**
```bash
# MongoDB
mongod

# Redis
redis-server
```

6. **Start the NLP service**
```bash
cd python-nlp-service
python app.py
```

7. **Start the backend server**
```bash
npm run dev
```

The API will be available at `http://localhost:4000`

### Environment Variables

```env
# Server Configuration
NODE_ENV=development
PORT=4000
HOST=localhost

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/scientific_publications
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d

# External APIs
OPENALEX_API_URL=https://api.openalex.org
CROSSREF_API_URL=https://api.crossref.org

# NLP Service Configuration
NLP_SERVICE_URL=http://localhost:5000

# File Upload
MAX_FILE_SIZE=10MB
UPLOAD_PATH=./uploads
```

## API Documentation

### Base URL
```
http://localhost:4000/api
```

### Authentication
All protected endpoints require a valid JWT token:
```bash
Authorization: Bearer <your-jwt-token>
```

### Main Endpoints

#### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `GET /auth/profile` - Get user profile

#### Publications
- `GET /publications` - List publications with pagination
- `POST /publications` - Create new publication
- `GET /publications/:id` - Get publication details
- `POST /publications/search` - Search publications
- `GET /publications/trending/:days` - Get trending publications

#### Authors
- `GET /authors` - List authors
- `POST /authors` - Create new author
- `GET /authors/:id` - Get author details
- `GET /authors/:id/publications` - Get author's publications
- `GET /authors/:id/collaborators` - Get author's collaborators

#### Citations
- `GET /citations` - List citations
- `POST /citations` - Create new citation
- `GET /citations/:id` - Get citation details
- `GET /citations/publication/:id/cited-by` - Get citations for publication

#### Analytics
- `GET /analytics/dashboard` - Dashboard statistics
- `GET /analytics/publications/trends` - Publication trends
- `GET /analytics/topics/trends` - Topic trends
- `GET /analytics/collaborations/network` - Collaboration network

#### Topics
- `GET /topics` - List topics
- `POST /topics` - Create new topic
- `GET /topics/:id` - Get topic details
- `GET /topics/trending/:limit` - Get trending topics

#### Import/Export
- `POST /import/upload` - Upload document file
- `POST /import/csv` - Import from CSV
- `POST /import/json` - Import from JSON
- `GET /import/export` - Export publications

### API Documentation
Interactive API documentation is available at:
```
http://localhost:4000/api-docs
```

## NLP Service Endpoints

The Python NLP service runs on port 5000 by default:

### Main Endpoints
- `POST /process/text` - Process raw text
- `POST /process/publication` - Process scientific publication
- `POST /analyze/citations` - Analyze citation relationships
- `POST /model/topics` - Perform topic modeling
- `POST /embeddings/generate` - Generate text embeddings
- `POST /keywords/extract` - Extract keywords
- `POST /sentiment/analyze` - Analyze sentiment
- `POST /language/detect` - Detect language

## Database Schema

### Collections

#### Publications
- Basic information (title, abstract, authors)
- Metadata (DOI, journal, publication year)
- NLP features (embeddings, keywords, sentiment)
- Metrics (citations, views, downloads)

#### Authors
- Profile information (name, affiliations, ORCID)
- Academic metrics (h-index, citations, publications)
- Collaboration data
- Research interests

#### Citations
- Citation relationships
- Context and sentiment analysis
- Self-citation detection
- Citation type classification

#### Topics
- Topic hierarchy
- Keywords and weights
- Trending analysis
- Publication associations

## Development

### Running Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Code Quality
```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

### Database Migrations
```bash
# Run migrations
npm run migrate
```

## Deployment

### Docker Deployment
```bash
# Build Docker image
docker build -t scientific-publications-backend .

# Run with Docker Compose
docker-compose up -d
```

### Production Setup
1. Set `NODE_ENV=production`
2. Configure MongoDB with authentication
3. Set up Redis with persistence
4. Configure reverse proxy (nginx)
5. Set up SSL certificates
6. Configure monitoring and logging

## Performance Optimization

### Caching Strategy
- Redis for frequently accessed data
- Application-level caching for API responses
- Database query optimization with proper indexing

### Scalability
- Horizontal scaling with load balancers
- Database sharding for large datasets
- Microservices architecture for NLP service
- Queue-based processing for heavy tasks

## Monitoring

### Logging
- Winston for structured logging
- Log levels: error, warn, info, debug
- Log rotation and archiving
- Centralized log aggregation

### Health Checks
- `/health` endpoint for service status
- Database connection monitoring
- Redis connection monitoring
- NLP service health checks

## Security

### Authentication
- JWT-based authentication
- Role-based authorization (admin, researcher, user, guest)
- API key authentication for services
- Session management with Redis

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF protection
- Rate limiting

### Best Practices
- Environment variable management
- Secret management
- Regular security updates
- Security headers configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Email: support@scientific-publications.com
- Documentation: [API Docs](http://localhost:4000/api-docs)

## Changelog

### Version 1.0.0
- Initial release
- Core publication management
- Author and citation analysis
- NLP service integration
- Analytics dashboard
- Import/export functionality
