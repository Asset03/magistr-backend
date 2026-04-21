# Database Seeding Guide

This document explains how to use the database seeding functionality to populate your backend with mock data for testing purposes.

## Overview

The seed script generates comprehensive mock data for all tables in your scientific publications database:

- **Users** (50 records) - User accounts with various roles and permissions
- **Authors** (100 records) - Academic authors with affiliations and research interests
- **Topics** (50 records) - Research topics with hierarchical relationships
- **Publications** (200 records) - Scientific papers with metadata and citations
- **Citations** (500 records) - Citation relationships between publications

## Prerequisites

1. Make sure MongoDB is running and accessible
2. Ensure your `.env` file has the correct `MONGODB_URI` configuration
3. Install all dependencies: `npm install`

## Running the Seed Script

### Production Environment
```bash
npm run seed
```

### Development Environment
```bash
npm run seed:dev
```

### Direct Execution
```bash
node scripts/seedDatabase.js
```

## Generated Data Details

### Users
- Random usernames and email addresses
- Various roles: admin, researcher, user, guest
- OAuth provider support (Google, ORCID, GitHub)
- Institutional information and research interests
- Academic profiles (Google Scholar, ResearchGate, etc.)
- Privacy settings and preferences
- Activity statistics

### Authors
- Complete academic profiles with ORCID IDs
- Multiple affiliations with historical data
- Research metrics (h-index, g-index, i10-index)
- Publication and citation counts
- Research interests and expertise areas
- Social media profiles
- Career stage information
- Geographic and institutional data

### Topics
- Hierarchical topic structure
- Topic modeling data (LDA, NMF, BERTopic)
- Temporal trends and emergence patterns
- Geographic and institutional distribution
- Publication and citation metrics
- Author collaboration data
- Interdisciplinary connections
- Quality validation scores

### Publications
- Realistic titles and abstracts
- Multiple authors with affiliations
- Journal and conference metadata
- Various identifiers (DOI, ISBN, PMID, arXiv)
- Keywords and topic assignments
- Citation and download counts
- File information and processing status
- Quality and peer review indicators

### Citations
- Citation relationships between publications
- Citation context and position
- Sentiment analysis and citation types
- Self-citation detection
- Semantic similarity scores
- Geographic and institutional context
- Quality confidence scores

## Customization

### Changing Data Volume

You can modify the amount of generated data by editing the `seedDatabase.js` file:

```javascript
// Adjust these values in the seedDatabase function
const users = await generateUsers(50);        // Change 50 to desired count
const authors = await generateAuthors(100);   // Change 100 to desired count
const topics = await generateTopics(50);      // Change 50 to desired count
const publications = await generatePublications(200, insertedAuthors, insertedTopics); // Change 200
const citations = await generateCitations(500, insertedPublications); // Change 500
```

### Adding Custom Data

You can extend the mock data generators by:

1. Adding new items to the arrays at the top of the file (institutions, countries, research fields, etc.)
2. Modifying the generator functions to include additional fields
3. Creating new generator functions for custom data types

### Data Relationships

The script automatically creates realistic relationships between entities:

- Authors are linked to their publications
- Publications reference relevant topics
- Citations connect related publications
- Users can be associated with author profiles
- Topics have hierarchical and similarity relationships

## Safety Considerations

- **⚠️ Production Warning**: The seed script will DELETE all existing data in the target tables before inserting new data
- Always backup your database before running the seed script in production
- Use the development environment script (`npm run seed:dev`) for testing
- The script generates realistic but fictional data - no real personal information is included

## Troubleshooting

### Connection Issues
```bash
# Check MongoDB connection
mongosh "mongodb://localhost:27017/magistr-backend"

# Verify environment variables
cat .env | grep MONGODB_URI
```

### Memory Issues
If you encounter memory errors with large datasets, try:
1. Reducing the data volume
2. Running the script with increased Node.js memory:
   ```bash
   node --max-old-space-size=4096 scripts/seedDatabase.js
   ```

### Validation Errors
The generated data should comply with all schema validations. If you encounter validation errors:
1. Check your model schemas for any recent changes
2. Ensure all required fields are being populated
3. Verify data types match schema expectations

## Performance Notes

- The script is optimized for bulk inserts using MongoDB's `insertMany()` method
- Indexes are automatically created by your Mongoose schemas
- The script processes data in dependency order to maintain referential integrity
- Typical seeding time: 30-60 seconds for default dataset sizes

## Integration with Testing

The seed script can be used for automated testing:

```javascript
// In your test setup
const { seedDatabase } = require('../scripts/seedDatabase');

beforeAll(async () => {
  await seedDatabase();
});

afterAll(async () => {
  // Clean up test data
  await mongoose.connection.db.dropDatabase();
});
```

## Contributing

When modifying the seed script:

1. Maintain realistic data relationships
2. Ensure data diversity and variety
3. Test with your schema changes
4. Update this documentation for any new features
5. Consider adding configuration options for different testing scenarios
