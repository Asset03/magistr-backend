const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../src/models/User');
const Author = require('../src/models/Author');
const Publication = require('../src/models/Publication');
const Citation = require('../src/models/Citation');
const Topic = require('../src/models/Topic');

// Mock data generators
const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Mary', 'William', 'Patricia', 'Richard', 'Jennifer', 'Charles', 'Linda', 'Joseph', 'Elizabeth', 'Thomas', 'Barbara'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris'];
const institutions = ['MIT', 'Stanford University', 'Harvard University', 'Oxford University', 'Cambridge University', 'ETH Zurich', 'UC Berkeley', 'Caltech', 'Princeton University', 'Yale University', 'Columbia University', 'University of Chicago', 'Imperial College London', 'UCLA', 'University of Tokyo'];
const countries = ['USA', 'UK', 'Germany', 'France', 'Canada', 'Australia', 'Japan', 'Switzerland', 'Netherlands', 'Sweden', 'China', 'Singapore', 'Israel', 'Denmark', 'Norway'];
const researchFields = ['Computer Science', 'Machine Learning', 'Artificial Intelligence', 'Biology', 'Medicine', 'Physics', 'Chemistry', 'Mathematics', 'Engineering', 'Neuroscience', 'Psychology', 'Economics', 'Sociology', 'Environmental Science', 'Materials Science'];
const journals = ['Nature', 'Science', 'Cell', 'NEJM', 'The Lancet', 'PLOS ONE', 'Nature Communications', 'Scientific Reports', 'IEEE Transactions', 'ACM Computing Surveys', 'Journal of Machine Learning Research', 'Physical Review Letters', 'Journal of the American Chemical Society', 'Angewandte Chemie', 'Advanced Materials'];
const conferences = ['NeurIPS', 'ICML', 'ICLR', 'CVPR', 'AAAI', 'IJCAI', 'ACL', 'EMNLP', 'KDD', 'WWW', 'SIGIR', 'ICDE', 'VLDB', 'SIGMOD', 'PODS'];

// Generate random data
function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function generateORCID() {
  return `${getRandomNumber(1000, 9999)}-${getRandomNumber(1000, 9999)}-${getRandomNumber(1000, 9999)}-${getRandomNumber(100, 999)}${Math.random() > 0.5 ? 'X' : getRandomNumber(0, 9)}`;
}

function generateDOI() {
  return `10.${getRandomNumber(1000, 9999)}/${getRandomString(8).toLowerCase()}-${getRandomNumber(1000, 9999)}`;
}

function getRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateEmail(firstName, lastName, institution) {
  const domains = ['edu', 'com', 'org', 'ac.uk'];
  const domain = getRandomElement(domains);
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${institution.toLowerCase().replace(/\s+/g, '')}.${domain}`;
}

// Generate mock users
async function generateUsers(count = 50) {
  const users = [];
  const roles = ['admin', 'researcher', 'user', 'guest'];
  const oauthProviders = [null, 'google', 'orcid', 'github'];
  
  for (let i = 0; i < count; i++) {
    const firstName = getRandomElement(firstNames);
    const lastName = getRandomElement(lastNames);
    const username = `${firstName.toLowerCase()}${lastName.toLowerCase()}${getRandomNumber(1, 999)}`;
    const email = generateEmail(firstName, lastName, getRandomElement(institutions)) + `.${i}`;
    const oauthProvider = getRandomElement(oauthProviders);
    
    const user = {
      username: username,
      email: email,
      password: oauthProvider ? null : 'password123',
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`,
      role: getRandomElement(roles),
      oauth_provider: oauthProvider,
      oauth_id: oauthProvider ? getRandomString(20) : null,
      institution: {
        name: getRandomElement(institutions),
        department: `Department of ${getRandomElement(researchFields)}`,
        position: getRandomElement(['Professor', 'Associate Professor', 'Assistant Professor', 'Postdoc', 'PhD Student', 'Researcher']),
        country: getRandomElement(countries),
        website: `https://${username}.edu`
      },
      research_interests: [getRandomElement(researchFields), getRandomElement(researchFields)],
      orcid: i === 0 ? undefined : (Math.random() > 0.3 ? generateORCID() : undefined),
      academic_profile: {
        google_scholar: Math.random() > 0.5 ? `https://scholar.google.com/citations?user=${getRandomString(12)}` : null,
        researchgate: Math.random() > 0.5 ? `https://www.researchgate.net/profile/${firstName}-${lastName}` : null,
        linkedin: Math.random() > 0.5 ? `https://linkedin.com/in/${username}` : null,
        personal_website: Math.random() > 0.5 ? `https://${username}.com` : null
      },
      preferences: {
        language: getRandomElement(['en', 'es', 'fr', 'de', 'zh', 'ja', 'ru']),
        timezone: getRandomElement(['UTC', 'EST', 'PST', 'CET', 'JST']),
        email_notifications: Math.random() > 0.3,
        newsletter: Math.random() > 0.7,
        privacy: {
          profile_visibility: getRandomElement(['public', 'registered', 'private']),
          show_email: Math.random() > 0.8,
          show_institution: Math.random() > 0.4
        }
      },
      status: getRandomElement(['active', 'active', 'active', 'inactive']),
      statistics: {
        publications_viewed: getRandomNumber(0, 500),
        searches_performed: getRandomNumber(0, 1000),
        downloads: getRandomNumber(0, 100),
        citations_added: getRandomNumber(0, 50)
      },
      last_login: new Date(Date.now() - getRandomNumber(0, 30) * 24 * 60 * 60 * 1000),
      login_count: getRandomNumber(1, 100),
      last_activity: new Date(Date.now() - getRandomNumber(0, 7) * 24 * 60 * 60 * 1000)
    };
    
    users.push(user);
  }
  
  return users;
}

// Generate mock authors
async function generateAuthors(count = 100) {
  const authors = [];
  const careerStages = ['phd_student', 'postdoc', 'assistant_professor', 'associate_professor', 'professor', 'researcher', 'industry_professional', 'retired'];
  
  for (let i = 0; i < count; i++) {
    const firstName = getRandomElement(firstNames);
    const lastName = getRandomElement(lastNames);
    const middleName = Math.random() > 0.7 ? getRandomElement(['A.', 'B.', 'C.', 'D.', 'E.']) : null;
    const institution = getRandomElement(institutions);
    const country = getRandomElement(countries);
    
    const author = {
      first_name: firstName,
      last_name: lastName,
      middle_name: middleName,
      full_name: `${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`,
      email: generateEmail(firstName, lastName, institution) + `.${i}`,
      orcid: i === 0 ? undefined : (Math.random() > 0.3 ? generateORCID() : undefined),
      scopus_id: Math.random() > 0.7 ? `${getRandomNumber(10000000000, 99999999999)}` : null,
      researcher_id: Math.random() > 0.8 ? `${getRandomString(8)}` : null,
      openalex_id: Math.random() > 0.7 ? `A${getRandomNumber(1000000000, 9999999999)}` : null,
      affiliations: [{
        name: institution,
        department: `Department of ${getRandomElement(researchFields)}`,
        institution: institution,
        country: country,
        city: getRandomElement(['Boston', 'New York', 'London', 'Paris', 'Berlin', 'Tokyo', 'San Francisco', 'Cambridge']),
        start_year: getRandomNumber(1990, 2020),
        end_year: Math.random() > 0.5 ? null : getRandomNumber(2021, 2024),
        current: true
      }],
      current_affiliation: {
        name: institution,
        department: `Department of ${getRandomElement(researchFields)}`,
        institution: institution,
        country: country,
        city: getRandomElement(['Boston', 'New York', 'London', 'Paris', 'Berlin', 'Tokyo', 'San Francisco', 'Cambridge']),
        start_year: getRandomNumber(1990, 2020),
        current: true
      },
      h_index: getRandomNumber(0, 150),
      g_index: getRandomNumber(0, 200),
      i10_index: getRandomNumber(0, 300),
      total_citations: getRandomNumber(0, 50000),
      total_publications: getRandomNumber(1, 500),
      research_interests: [
        { term: getRandomElement(researchFields), weight: getRandomFloat(0.5, 1.0), source: 'manual' },
        { term: getRandomElement(researchFields), weight: getRandomFloat(0.3, 0.8), source: 'extracted' }
      ],
      expertise_areas: [{
        area: getRandomElement(researchFields),
        level: getRandomElement(['beginner', 'intermediate', 'expert', 'pioneer']),
        years_experience: getRandomNumber(1, 40)
      }],
      social_profiles: [
        {
          platform: getRandomElement(['orcid', 'google_scholar', 'researchgate', 'twitter', 'linkedin', 'github']),
          url: `https://orcid.org/${generateORCID()}`,
          username: `${firstName.toLowerCase()}${lastName.toLowerCase()}`,
          verified: Math.random() > 0.5
        }
      ],
      personal_website: Math.random() > 0.6 ? `https://${firstName.toLowerCase()}${lastName.toLowerCase()}.com` : null,
      academic_profile: Math.random() > 0.5 ? `https://scholar.google.com/citations?user=${getRandomString(12)}` : null,
      country: country,
      city: getRandomElement(['Boston', 'New York', 'London', 'Paris', 'Berlin', 'Tokyo', 'San Francisco', 'Cambridge']),
      region: getRandomElement(['North America', 'Europe', 'Asia', 'Oceania']),
      career_stage: getRandomElement(careerStages),
      years_active: getRandomNumber(1, 40),
      first_publication_year: getRandomNumber(1980, 2015),
      last_publication_year: getRandomNumber(2016, 2024),
      verified: Math.random() > 0.7,
      verification_method: getRandomElement(['orcid', 'email', 'institution']),
      status: getRandomElement(['active', 'active', 'active', 'inactive']),
      source: getRandomElement(['manual', 'openalex', 'orcid', 'scopus', 'crossref', 'import']),
      profile_completeness: getRandomFloat(0.3, 1.0),
      last_active: new Date(Date.now() - getRandomNumber(0, 30) * 24 * 60 * 60 * 1000)
    };
    
    authors.push(author);
  }
  
  return authors;
}

// Generate mock topics
async function generateTopics(count = 50) {
  const topics = [];
  const categories = ['stem', 'social_sciences', 'humanities', 'arts', 'interdisciplinary', 'other'];
  const algorithms = ['lda', 'nmf', 'bertopic', 'manual', 'hierarchical'];
  const trendDirections = ['emerging', 'growing', 'stable', 'declining', 'resurgent'];
  
  const topicNames = [
    'Machine Learning', 'Deep Learning', 'Natural Language Processing', 'Computer Vision',
    'Reinforcement Learning', 'Quantum Computing', 'Blockchain', 'Internet of Things',
    'Artificial Intelligence Ethics', 'Climate Change', 'Renewable Energy', 'Sustainable Development',
    'Genomics', 'Proteomics', 'Bioinformatics', 'Computational Biology',
    'Social Network Analysis', 'Data Mining', 'Big Data Analytics', 'Cloud Computing',
    'Cybersecurity', 'Privacy Preservation', 'Human-Computer Interaction', 'Virtual Reality',
    'Augmented Reality', 'Robotics', 'Autonomous Systems', 'Smart Cities',
    'Digital Health', 'Telemedicine', 'Precision Medicine', 'Personalized Healthcare',
    'Materials Science', 'Nanotechnology', 'Graphene', 'Quantum Materials',
    'Cognitive Science', 'Neuroscience', 'Brain-Computer Interfaces', 'Neural Engineering',
    'Financial Technology', 'Cryptocurrency', 'Algorithmic Trading', 'Risk Management',
    'Educational Technology', 'Online Learning', 'Adaptive Learning Systems', 'Learning Analytics'
  ];
  
  for (let i = 0; i < Math.min(count, topicNames.length); i++) {
    const topic = {
      name: topicNames[i],
      description: `Research and developments in ${topicNames[i]} including recent advances, applications, and future directions.`,
      level: getRandomNumber(0, 3),
      path: [topicNames[i]],
      category: getRandomElement(categories),
      subcategory: getRandomElement(researchFields),
      field: getRandomElement(researchFields),
      subfield: getRandomElement([`${getRandomElement(researchFields)} Research`, `${getRandomElement(researchFields)} Applications`, `${getRandomElement(researchFields)} Theory`]),
      keywords: [
        { term: topicNames[i].toLowerCase(), weight: getRandomFloat(0.8, 1.0), frequency: getRandomNumber(100, 10000), source: 'extracted' },
        { term: `${topicNames[i]} applications`, weight: getRandomFloat(0.5, 0.8), frequency: getRandomNumber(50, 5000), source: 'ml' }
      ],
      related_terms: [
        { term: getRandomElement(topicNames), similarity_score: getRandomFloat(0.3, 0.9), co_occurrence_frequency: getRandomNumber(10, 1000) }
      ],
      synonyms: [topicNames[i].toLowerCase(), topicNames[i].replace(/\s+/g, '').toLowerCase()],
      algorithm: getRandomElement(algorithms),
      model_version: `v${getRandomNumber(1, 3)}.${getRandomNumber(0, 9)}.${getRandomNumber(0, 9)}`,
      topic_distribution: [
        { term: topicNames[i].toLowerCase(), probability: getRandomFloat(0.1, 0.9), weight: getRandomFloat(0.5, 1.0) }
      ],
      coherence_score: getRandomFloat(0.3, 0.9),
      perplexity_score: getRandomFloat(50, 500),
      emergence_year: getRandomNumber(1990, 2020),
      peak_year: getRandomNumber(2010, 2024),
      trend_direction: getRandomElement(trendDirections),
      total_publications: getRandomNumber(10, 5000),
      total_citations: getRandomNumber(100, 50000),
      average_citations_per_publication: getRandomFloat(1, 50),
      h_index_topic: getRandomNumber(5, 100),
      total_authors: getRandomNumber(20, 2000),
      collaboration_density: getRandomFloat(0.1, 0.9),
      popularity_score: getRandomFloat(0.1, 1.0),
      search_frequency: getRandomNumber(10, 10000),
      confidence_score: getRandomFloat(0.5, 1.0),
      validation_status: getRandomElement(['pending', 'validated', 'validated', 'disputed']),
      source: getRandomElement(['manual', 'topic_modeling', 'automated_extraction', 'ontology_import']),
      processing_status: 'completed',
      tags: [topicNames[i].toLowerCase().replace(/\s+/g, '-'), getRandomElement(researchFields).toLowerCase()],
      last_accessed: new Date(Date.now() - getRandomNumber(0, 30) * 24 * 60 * 60 * 1000),
      last_analyzed: new Date(Date.now() - getRandomNumber(1, 7) * 24 * 60 * 60 * 1000)
    };
    
    topics.push(topic);
  }
  
  return topics;
}

// Generate mock publications
async function generatePublications(count = 200, authors, topics) {
  const publications = [];
  const languages = ['en', 'es', 'fr', 'de'];
  const sources = ['manual', 'openalex', 'crossref', 'arxiv', 'pubmed', 'upload', 'scraping'];
  const statuses = ['draft', 'published', 'published', 'archived'];
  const visibilities = ['public', 'private', 'restricted'];
  
  const publicationTitles = [
    'A Novel Approach to Machine Learning',
    'Deep Neural Networks for Image Recognition',
    'Natural Language Processing with Transformers',
    'Quantum Computing Applications in Cryptography',
    'Blockchain Technology for Secure Transactions',
    'Climate Change Impact on Biodiversity',
    'Renewable Energy Systems Integration',
    'Genomic Analysis of Complex Diseases',
    'Social Network Dynamics and Information Spread',
    'Big Data Analytics for Business Intelligence',
    'Cybersecurity Threats and Countermeasures',
    'Human-Computer Interaction in Virtual Environments',
    'Autonomous Systems and Machine Learning',
    'Smart Cities: IoT and Urban Planning',
    'Digital Health Revolution',
    'Materials Science Breakthrough',
    'Cognitive Computing and AI',
    'Financial Technology Innovation',
    'Educational Technology Transformation',
    'Sustainable Development Goals'
  ];
  
  for (let i = 0; i < count; i++) {
    const title = getRandomElement(publicationTitles) + `: A ${getRandomNumber(2020, 2024)} Study`;
    const publicationYear = getRandomNumber(2015, 2024);
    const selectedAuthors = [];
    const authorCount = getRandomNumber(1, 8);
    
    // Select random authors
    for (let j = 0; j < Math.min(authorCount, authors.length); j++) {
      const randomAuthor = authors[getRandomNumber(0, authors.length - 1)];
      if (!selectedAuthors.find(a => a.author_id.toString() === randomAuthor._id.toString())) {
        selectedAuthors.push({
          author_id: randomAuthor._id,
          name: randomAuthor.full_name,
          affiliation: randomAuthor.current_affiliation?.name || 'Unknown Institution',
          order: j + 1
        });
      }
    }
    
    const publication = {
      title: title,
      abstract: `This paper presents a comprehensive study on ${title.toLowerCase()}. We conducted extensive experiments and analysis to demonstrate the effectiveness of our proposed approach. The results show significant improvements over existing methods and provide valuable insights for future research in this area.`,
      full_text: Math.random() > 0.7 ? `Full text content for ${title}. This includes detailed methodology, experimental results, discussion, and conclusions.` : null,
      authors: selectedAuthors,
      publication_year: publicationYear,
      publication_date: new Date(publicationYear, getRandomNumber(0, 11), getRandomNumber(1, 28)),
      journal: Math.random() > 0.3 ? {
        name: getRandomElement(journals),
        volume: `${getRandomNumber(1, 100)}`,
        issue: `${getRandomNumber(1, 12)}`,
        pages: `${getRandomNumber(1, 50)}-${getRandomNumber(51, 100)}`,
        issn: `${getRandomNumber(1000, 9999)}-${getRandomNumber(1000, 9999)}`,
        publisher: getRandomElement(['Springer', 'Elsevier', 'IEEE', 'ACM', 'Nature Publishing Group', 'Wiley', 'Oxford University Press'])
      } : null,
      conference: Math.random() > 0.7 ? {
        name: getRandomElement(conferences),
        location: getRandomElement(['Virtual', 'New York', 'London', 'Tokyo', 'Berlin', 'San Francisco']),
        dates: `${getRandomNumber(1, 30)}-${getRandomNumber(1, 30)} ${getRandomElement(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])} ${publicationYear}`,
        proceedings: `Proceedings of ${getRandomElement(conferences)} ${publicationYear}`
      } : null,
      doi: Math.random() > 0.4 ? generateDOI() + `-${i}` : undefined,
      isbn: Math.random() > 0.9 ? `${getRandomNumber(100, 999)}-${getRandomNumber(100, 999)}-${getRandomNumber(100, 999)}-${getRandomNumber(0, 9)}` : null,
      pmid: Math.random() > 0.8 ? `${getRandomNumber(10000000, 99999999)}` : null,
      arxiv_id: Math.random() > 0.6 ? `arXiv:${getRandomNumber(1000, 9999)}.${getRandomNumber(10000, 99999)}v${getRandomNumber(1, 5)}` : null,
      openalex_id: Math.random() > 0.5 ? `W${getRandomNumber(1000000000, 9999999999)}` : null,
      keywords: [
        { term: getRandomElement(researchFields), weight: getRandomFloat(0.5, 1.0), source: 'manual' },
        { term: getRandomElement(researchFields), weight: getRandomFloat(0.3, 0.8), source: 'extracted' }
      ],
      topics: topics.slice(0, getRandomNumber(1, 5)).map(topic => ({
        topic_id: topic._id,
        confidence: getRandomFloat(0.5, 1.0),
        method: getRandomElement(['manual', 'ml', 'hybrid'])
      })),
      citations_count: getRandomNumber(0, 1000),
      references_count: getRandomNumber(5, 100),
      downloads_count: getRandomNumber(0, 10000),
      views_count: getRandomNumber(0, 50000),
      altmetric_score: Math.random() > 0.7 ? getRandomFloat(0, 100) : null,
      h_index_authors: selectedAuthors.slice(0, 3).map(() => getRandomNumber(1, 100)),
      language: getRandomElement(languages),
      readability_score: getRandomFloat(0.3, 0.9),
      sentiment_score: {
        positive: getRandomFloat(0.2, 0.8),
        negative: getRandomFloat(0.1, 0.3),
        neutral: getRandomFloat(0.2, 0.6)
      },
      topic_distribution: [
        { topic: getRandomElement(researchFields), probability: getRandomFloat(0.1, 0.9) }
      ],
      file_info: Math.random() > 0.8 ? {
        filename: `${title.replace(/\s+/g, '_')}.pdf`,
        file_type: 'pdf',
        file_size: getRandomNumber(100000, 5000000),
        file_path: `/uploads/papers/${getRandomString(32)}.pdf`,
        uploaded_at: new Date(Date.now() - getRandomNumber(1, 365) * 24 * 60 * 60 * 1000)
      } : null,
      source: getRandomElement(sources),
      processing_status: 'completed',
      quality_score: getRandomFloat(0.5, 1.0),
      is_peer_reviewed: Math.random() > 0.3,
      is_open_access: Math.random() > 0.5,
      status: getRandomElement(statuses),
      visibility: getRandomElement(visibilities),
      indexed_at: new Date(Date.now() - getRandomNumber(1, 30) * 24 * 60 * 60 * 1000),
      last_cited_at: Math.random() > 0.5 ? new Date(Date.now() - getRandomNumber(1, 365) * 24 * 60 * 60 * 1000) : null
    };
    
    publications.push(publication);
  }
  
  return publications;
}

// Generate mock citations
async function generateCitations(count = 500, publications) {
  const citations = [];
  const citationTypes = ['supporting', 'contradicting', 'mentioning', 'background', 'methodology', 'comparison'];
  const sentiments = ['positive', 'negative', 'neutral'];
  const positions = ['introduction', 'methodology', 'results', 'discussion', 'conclusion', 'references'];
  const sources = ['manual', 'extracted', 'crossref', 'openalex', 'semantic_scholar', 'parsed'];
  const statuses = ['verified', 'unverified', 'disputed'];
  
  for (let i = 0; i < count; i++) {
    const citingPub = publications[getRandomNumber(0, publications.length - 1)];
    const citedPub = publications[getRandomNumber(0, publications.length - 1)];
    
    // Ensure we don't cite a paper with itself
    if (citingPub._id.toString() === citedPub._id.toString()) {
      continue;
    }
    
    const citationYear = getRandomNumber(Math.max(citingPub.publication_year, citedPub.publication_year), 2024);
    
    const citation = {
      citing_publication_id: citingPub._id,
      cited_publication_id: citedPub._id,
      citation_text: Math.random() > 0.3 ? `This work builds upon the foundational research presented by ${citedPub.authors[0]?.name || 'previous researchers'}. Their approach to ${citedPub.title.toLowerCase().split(':')[0]} provides valuable insights for our current study.` : null,
      citation_position: getRandomElement(positions),
      page_number: Math.random() > 0.7 ? `${getRandomNumber(1, 50)}` : null,
      paragraph_number: Math.random() > 0.8 ? getRandomNumber(1, 20) : null,
      citation_type: getRandomElement(citationTypes),
      citation_strength: getRandomFloat(0.1, 1.0),
      sentiment: getRandomElement(sentiments),
      self_citation: Math.random() > 0.8,
      author_self_citation: Math.random() > 0.9,
      institutional_self_citation: Math.random() > 0.85,
      citation_year: citationYear,
      citation_date: new Date(citationYear, getRandomNumber(0, 11), getRandomNumber(1, 28)),
      citing_country: citingPub.authors[0]?.affiliation ? getRandomElement(countries) : null,
      citing_institution: citingPub.authors[0]?.affiliation || null,
      cited_country: citedPub.authors[0]?.affiliation ? getRandomElement(countries) : null,
      cited_institution: citedPub.authors[0]?.affiliation || null,
      citing_journal: citingPub.journal?.name || null,
      cited_journal: citedPub.journal?.name || null,
      field_context: getRandomElement(researchFields),
      subfield_context: getRandomElement([`${getRandomElement(researchFields)} Theory`, `${getRandomElement(researchFields)} Applications`]),
      semantic_similarity: getRandomFloat(0.1, 0.9),
      topic_similarity: getRandomFloat(0.1, 0.9),
      citation_depth: getRandomNumber(1, 5),
      citation_breadth: getRandomNumber(0, 10),
      confidence_score: getRandomFloat(0.3, 1.0),
      verification_status: getRandomElement(statuses),
      source: getRandomElement(sources),
      processing_status: 'completed',
      tags: [getRandomElement(researchFields).toLowerCase(), getRandomElement(['important', 'methodology', 'theory', 'application'])],
      verified_at: Math.random() > 0.5 ? new Date(Date.now() - getRandomNumber(1, 365) * 24 * 60 * 60 * 1000) : null
    };
    
    citations.push(citation);
  }
  
  return citations;
}

// Main seeding function
async function seedDatabase() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('Clearing existing data...');
    await User.deleteMany({});
    await Author.deleteMany({});
    await Publication.deleteMany({});
    await Citation.deleteMany({});
    await Topic.deleteMany({});
    
    // Drop problematic text index on topics collection
    try {
      const topicCollection = mongoose.connection.db.collection('topics');
      const indexes = await topicCollection.indexes();
      const textIndex = indexes.find(index => 
        index.name === 'name_text_description_text' || 
        (index.key && Object.keys(index.key).some(key => key.includes('keywords')))
      );
      if (textIndex) {
        await topicCollection.dropIndex(textIndex.name);
        console.log('✓ Dropped problematic text index from topics collection');
      }
    } catch (error) {
      console.log('No problematic index found or unable to drop:', error.message);
    }
    
    console.log('Generating mock data...');
    
    // Generate data in order of dependencies
    console.log('1. Generating users...');
    const users = await generateUsers(5);
    const insertedUsers = await User.insertMany(users);
    console.log(`✓ Created ${insertedUsers.length} users`);
    
    console.log('2. Generating authors...');
    const authors = await generateAuthors(10);
    const insertedAuthors = await Author.insertMany(authors);
    console.log(`✓ Created ${insertedAuthors.length} authors`);
    
    console.log('3. Generating topics...');
    const topics = await generateTopics(20);
    const insertedTopics = await Topic.insertMany(topics);
    console.log(`✓ Created ${insertedTopics.length} topics`);
    
    console.log('4. Generating publications...');
    const publications = await generatePublications(20, insertedAuthors, insertedTopics);
    const insertedPublications = await Publication.insertMany(publications);
    console.log(`✓ Created ${insertedPublications.length} publications`);
    
    console.log('5. Generating citations...');
    const citations = await generateCitations(20, insertedPublications);
    const insertedCitations = await Citation.insertMany(citations);
    console.log(`✓ Created ${insertedCitations.length} citations`);
    
    // Update some relationships
    console.log('6. Updating relationships...');
    
    // Add some publications to authors
    for (const author of insertedAuthors.slice(0, 20)) {
      const authorPublications = insertedPublications
        .filter(pub => pub.authors.some(a => a.author_id.toString() === author._id.toString()))
        .slice(0, 10);
      
      if (authorPublications.length > 0) {
        await Author.findByIdAndUpdate(author._id, {
          publications: authorPublications.map(pub => ({
            publication_id: pub._id,
            title: pub.title,
            year: pub.publication_year,
            journal: pub.journal?.name,
            citations_count: pub.citations_count,
            role: 'author'
          }))
        });
      }
    }
    
    // Add some collaborators to authors
    for (const author of insertedAuthors.slice(0, 30)) {
      const collaborators = insertedAuthors
        .filter(a => a._id.toString() !== author._id.toString())
        .slice(0, getRandomNumber(3, 10));
      
      await Author.findByIdAndUpdate(author._id, {
        collaborators: collaborators.map(collab => ({
          author_id: collab._id,
          name: collab.full_name,
          collaboration_count: getRandomNumber(1, 20),
          last_collaboration_year: getRandomNumber(2018, 2024)
        }))
      });
    }
    
    // Add some related topics
    for (const topic of insertedTopics.slice(0, 30)) {
      const relatedTopics = insertedTopics
        .filter(t => t._id.toString() !== topic._id.toString())
        .slice(0, getRandomNumber(2, 8));
      
      await Topic.findByIdAndUpdate(topic._id, {
        related_topics: relatedTopics.map(relTopic => ({
          topic_id: relTopic._id,
          name: relTopic.name,
          relationship_type: getRandomElement(['similar', 'parent', 'child', 'overlapping', 'competing', 'complementary']),
          similarity_score: getRandomFloat(0.3, 0.9),
          co_occurrence_frequency: getRandomNumber(5, 100)
        }))
      });
    }
    
    console.log('\n✅ Database seeding completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   Users: ${insertedUsers.length}`);
    console.log(`   Authors: ${insertedAuthors.length}`);
    console.log(`   Topics: ${insertedTopics.length}`);
    console.log(`   Publications: ${insertedPublications.length}`);
    console.log(`   Citations: ${insertedCitations.length}`);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
