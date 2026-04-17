# Scientific Publications Analysis Backend

A comprehensive Node.js backend API for analyzing scientific publications with advanced search, analytics, and collaboration features.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **Publication Management**: CRUD operations for scientific publications with metadata
- **Author Profiles**: Detailed author information with collaboration networks
- **Advanced Search**: Full-text search with filters and suggestions
- **Analytics**: Comprehensive analytics including trends, networks, and metrics
- **Dashboard**: Real-time statistics and insights
- **Citation Networks**: Visual representation of citation relationships
- **RESTful API**: Well-structured REST API with proper error handling

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Primary database
- **Mongoose** - ODM for MongoDB
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **Winston** - Logging
- **Joi** - Input validation

## Project Structure

```
src/
|-- config/
|   |-- database.js          # MongoDB connection
|-- controllers/
|   |-- authController.js    # Authentication logic
|   |-- publicationController.js
|   |-- authorController.js
|   |-- dashboardController.js
|   |-- analyticsController.js
|   |-- searchController.js
|-- middleware/
|   |-- auth.js              # Authentication middleware
|   |-- validation.js        # Input validation
|   |-- errorHandler.js      # Error handling
|-- models/
|   |-- User.js              # User model
|   |-- Publication.js       # Publication model
|   |-- Author.js            # Author profile model
|-- routes/
|   |-- auth.js              # Authentication routes
|   |-- publications.js      # Publication routes
|   |-- authors.js           # Author routes
|   |-- dashboard.js         # Dashboard routes
|   |-- analytics.js         # Analytics routes
|   |-- search.js            # Search routes
|-- utils/
|   |-- jwtUtils.js          # JWT utilities
|   |-- logger.js            # Logging utilities
|   |-- responseFormatter.js # Response formatting
|-- server.js                # Main server file
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd scientific-publications-backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` file with your configuration:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/scientific_publications
JWT_SECRET=your_super_secret_jwt_key_here
```

4. Create logs directory:
```bash
mkdir logs
```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

## API Documentation

### Authentication

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "affiliation": "University of Example"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your_refresh_token"
}
```

### Publications

#### Get All Publications
```http
GET /api/publications?page=1&limit=20&sort=publicationYear&order=desc
```

#### Search Publications
```http
POST /api/publications/search
Content-Type: application/json

{
  "query": "machine learning",
  "yearRange": { "start": 2020, "end": 2023 },
  "keywords": ["AI", "ML"],
  "limit": 20
}
```

#### Get Publication by ID
```http
GET /api/publications/:id
```

#### Get Similar Publications
```http
GET /api/publications/:id/similar?limit=10
```

### Authors

#### Get All Authors
```http
GET /api/authors?page=1&limit=20&sort=name&order=asc
```

#### Get Author by ID
```http
GET /api/authors/:id
```

#### Get Author's Publications
```http
GET /api/authors/:id/publications?page=1&limit=20
```

#### Get Co-authors
```http
GET /api/authors/:id/coauthors?limit=20
```

### Dashboard

#### Get Dashboard Stats
```http
GET /api/dashboard/stats
```

#### Get Recent Publications
```http
GET /api/dashboard/recent?limit=10
```

#### Get Top Authors
```http
GET /api/dashboard/top-authors?limit=10&sortBy=publications
```

### Analytics

#### Get Analytics Data
```http
GET /api/analytics?timeRange=year
```

#### Get Publication Trends
```http
GET /api/analytics/trends?period=month&years=5
```

#### Get Topic Distribution
```http
GET /api/analytics/topics?timeRange=year
```

#### Get Author Network
```http
GET /api/analytics/author-network?limit=100&minCollaborations=2
```

### Search

#### Global Search
```http
GET /api/search?q=machine learning&limit=20
```

#### Get Search Suggestions
```http
GET /api/search/suggestions?q=mach&limit=10
```

#### Advanced Search
```http
POST /api/search/advanced
Content-Type: application/json

{
  "query": "artificial intelligence",
  "authors": ["author_id_1", "author_id_2"],
  "yearRange": { "start": 2020, "end": 2023 },
  "keywords": ["AI", "neural networks"],
  "sortBy": "citations",
  "limit": 20
}
```

## Error Handling

The API uses standard HTTP status codes and returns errors in the following format:

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2023-11-15T10:30:00.000Z"
}
```

## Validation

All API endpoints validate input data using Joi validation. Validation errors return:

```json
{
  "success": false,
  "error": "Validation failed",
  "details": ["Error message 1", "Error message 2"]
}
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- Default: 100 requests per 15 minutes per IP
- Authentication endpoints: 5 requests per 15 minutes per IP

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting
- CORS protection
- Helmet.js security headers
- Input validation and sanitization

## Database Schema

### User Model
- Basic user information (name, email, password)
- Role-based permissions (user, researcher, admin)
- Favorites and bookmarks
- Research interests

### Publication Model
- Title, abstract, authors, keywords
- Publication metadata (journal, year, DOI)
- Citation information
- Topics and embeddings for ML
- Metrics (views, downloads, shares)

### Author Profile Model
- Academic information (title, affiliation)
- Research interests and expertise
- Collaboration network
- Metrics (h-index, citations)
- Work experience and education

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Database Seeding
```bash
npm run seed
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3000 |
| NODE_ENV | Environment | development |
| MONGODB_URI | MongoDB connection string | mongodb://localhost:27017/scientific_publications |
| JWT_SECRET | JWT signing key | Required |
| JWT_EXPIRES_IN | JWT expiration | 7d |
| CORS_ORIGIN | CORS origin | http://localhost:3000 |
| LOG_LEVEL | Logging level | info |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run tests and linting
6. Submit a pull request

## License

MIT License - see LICENSE file for details.
