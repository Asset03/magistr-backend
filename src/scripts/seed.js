const mongoose = require('mongoose');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Publication = require('../models/Publication');
const AuthorProfile = require('../models/Author');

// Sample data
const sampleUsers = [
  {
    name: 'Dr. Sarah Johnson',
    email: 'sarah.johnson@university.edu',
    password: 'password123',
    role: 'researcher',
    affiliation: 'Stanford University',
    researchInterests: ['Machine Learning', 'Artificial Intelligence', 'Neural Networks']
  },
  {
    name: 'Prof. Michael Chen',
    email: 'michael.chen@mit.edu',
    password: 'password123',
    role: 'researcher',
    affiliation: 'Massachusetts Institute of Technology',
    researchInterests: ['Computer Vision', 'Deep Learning', 'Robotics']
  },
  {
    name: 'Dr. Emily Rodriguez',
    email: 'emily.rodriguez@harvard.edu',
    password: 'password123',
    role: 'researcher',
    affiliation: 'Harvard University',
    researchInterests: ['Natural Language Processing', 'Machine Learning', 'Data Mining']
  },
  {
    name: 'Admin User',
    email: 'admin@system.com',
    password: 'admin123',
    role: 'admin',
    affiliation: 'System Administration',
    researchInterests: ['System Administration', 'Database Management']
  },
  {
    name: 'John Smith',
    email: 'john.smith@email.com',
    password: 'password123',
    role: 'user',
    affiliation: 'Independent Researcher',
    researchInterests: ['Data Science', 'Statistics']
  }
];

const samplePublications = [
  {
    title: 'Deep Learning for Natural Language Processing: A Comprehensive Survey',
    abstract: 'This paper provides a comprehensive survey of deep learning approaches in natural language processing. We review recent advances in neural network architectures, training methodologies, and applications across various NLP tasks including machine translation, sentiment analysis, and question answering.',
    authors: [], // Will be populated with user IDs
    keywords: ['deep learning', 'natural language processing', 'neural networks', 'machine learning', 'survey'],
    publicationYear: 2023,
    journal: {
      name: 'Journal of Artificial Intelligence Research',
      volume: '68',
      issue: '2',
      pages: '145-189',
      issn: '1076-9757'
    },
    doi: '10.1613/jair.1.12345',
    citationsCount: 42,
    publicationType: 'journal',
    accessType: 'open',
    language: 'en',
    topics: [
      {
        name: 'Natural Language Processing',
        weight: 0.9,
        keywords: ['NLP', 'text processing', 'language understanding']
      },
      {
        name: 'Deep Learning',
        weight: 0.8,
        keywords: ['neural networks', 'deep architectures', 'representation learning']
      }
    ]
  },
  {
    title: 'Computer Vision in Healthcare: Applications and Challenges',
    abstract: 'Computer vision technologies are revolutionizing healthcare by enabling automated analysis of medical images, disease detection, and treatment planning. This review explores current applications, technical challenges, and future directions of computer vision in medical imaging, surgical robotics, and patient monitoring.',
    authors: [],
    keywords: ['computer vision', 'healthcare', 'medical imaging', 'machine learning', 'disease detection'],
    publicationYear: 2023,
    journal: {
      name: 'IEEE Transactions on Medical Imaging',
      volume: '42',
      issue: '8',
      pages: '2345-2367',
      issn: '0278-0062'
    },
    doi: '10.1109/TMI.2023.1234567',
    citationsCount: 28,
    publicationType: 'journal',
    accessType: 'hybrid',
    language: 'en',
    topics: [
      {
        name: 'Computer Vision',
        weight: 0.95,
        keywords: ['image processing', 'object detection', 'image analysis']
      },
      {
        name: 'Healthcare AI',
        weight: 0.85,
        keywords: ['medical imaging', 'disease detection', 'healthcare']
      }
    ]
  },
  {
    title: 'Federated Learning: Privacy-Preserving Machine Learning at Scale',
    abstract: 'Federated learning enables collaborative machine learning without centralizing data, addressing privacy concerns in distributed systems. This paper presents a comprehensive analysis of federated learning algorithms, privacy preservation techniques, and real-world applications in healthcare, finance, and IoT.',
    authors: [],
    keywords: ['federated learning', 'privacy', 'machine learning', 'distributed systems', 'security'],
    publicationYear: 2022,
    journal: {
      name: 'Nature Machine Intelligence',
      volume: '4',
      issue: '12',
      pages: '1123-1135',
      issn: '2522-5839'
    },
    doi: '10.1038/s42256-022-00567-8',
    citationsCount: 156,
    publicationType: 'journal',
    accessType: 'open',
    language: 'en',
    topics: [
      {
        name: 'Federated Learning',
        weight: 0.9,
        keywords: ['distributed learning', 'privacy preservation', 'collaborative AI']
      },
      {
        name: 'Machine Learning',
        weight: 0.8,
        keywords: ['ML algorithms', 'model training', 'distributed systems']
      }
    ]
  },
  {
    title: 'Quantum Computing Applications in Optimization Problems',
    abstract: 'Quantum computing offers promising solutions to complex optimization problems that are intractable for classical computers. This study explores quantum algorithms for combinatorial optimization, portfolio optimization, and scheduling problems, demonstrating quantum advantage in specific problem instances.',
    authors: [],
    keywords: ['quantum computing', 'optimization', 'quantum algorithms', 'combinatorial optimization', 'quantum advantage'],
    publicationYear: 2023,
    conference: {
      name: 'International Conference on Quantum Computing',
      location: 'Virtual',
      dates: {
        start: new Date('2023-06-15'),
        end: new Date('2023-06-17')
      }
    },
    citationsCount: 15,
    publicationType: 'conference',
    accessType: 'open',
    language: 'en',
    topics: [
      {
        name: 'Quantum Computing',
        weight: 0.95,
        keywords: ['quantum algorithms', 'quantum advantage', 'quantum hardware']
      },
      {
        name: 'Optimization',
        weight: 0.85,
        keywords: ['combinatorial optimization', 'algorithmic optimization', 'problem solving']
      }
    ]
  },
  {
    title: 'Climate Change Impact on Biodiversity: A Data-Driven Analysis',
    abstract: 'This study analyzes the impact of climate change on global biodiversity using machine learning approaches on large-scale ecological datasets. We identify critical risk factors, predict species vulnerability, and propose conservation strategies based on data-driven insights.',
    authors: [],
    keywords: ['climate change', 'biodiversity', 'machine learning', 'ecology', 'conservation'],
    publicationYear: 2023,
    journal: {
      name: 'Global Change Biology',
      volume: '29',
      issue: '11',
      pages: '2890-2905',
      issn: '1354-1013'
    },
    doi: '10.1111/gcb.16789',
    citationsCount: 34,
    publicationType: 'journal',
    accessType: 'open',
    language: 'en',
    topics: [
      {
        name: 'Climate Change',
        weight: 0.9,
        keywords: ['global warming', 'environmental change', 'climate modeling']
      },
      {
        name: 'Biodiversity',
        weight: 0.85,
        keywords: ['ecosystem diversity', 'species conservation', 'ecological research']
      }
    ]
  }
];

const sampleAuthorProfiles = [
  {
    academicTitle: 'professor',
    department: 'Computer Science',
    faculty: 'School of Engineering',
    orcid: '0000-0002-1825-0097',
    bio: 'Dr. Sarah Johnson is a leading researcher in machine learning and artificial intelligence with over 15 years of experience in developing novel neural network architectures.',
    researchInterests: [
      { name: 'Machine Learning', weight: 0.9 },
      { name: 'Artificial Intelligence', weight: 0.85 },
      { name: 'Neural Networks', weight: 0.8 }
    ],
    education: [
      {
        degree: 'phd',
        field: 'Computer Science',
        institution: 'Stanford University',
        year: 2008
      },
      {
        degree: 'master',
        field: 'Computer Science',
        institution: 'MIT',
        year: 2004
      }
    ],
    workExperience: [
      {
        position: 'Professor',
        institution: 'Stanford University',
        startDate: new Date('2015-09-01'),
        current: true
      }
    ],
    awards: [
      {
        title: 'Best Paper Award',
        organization: 'ICML',
        year: 2021,
        description: 'Outstanding contribution to machine learning research'
      }
    ],
    metrics: {
      hIndex: 28,
      i10Index: 45,
      totalCitations: 1856,
      publicationsCount: 67
    }
  }
];

// Seed function
async function seedDatabase() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scientific_publications');
    console.log('Connected to database');

    // Clear existing data
    console.log('Clearing existing data...');
    await User.deleteMany({});
    await Publication.deleteMany({});
    await AuthorProfile.deleteMany({});
    console.log('Cleared existing data');

    // Create users
    console.log('Creating users...');
    const createdUsers = [];
    for (const userData of sampleUsers) {
      const user = new User(userData);
      await user.save();
      createdUsers.push(user);
      console.log(`Created user: ${user.name}`);
    }

    // Create author profiles for researchers
    console.log('Creating author profiles...');
    const researchers = createdUsers.filter(user => user.role === 'researcher');
    for (let i = 0; i < researchers.length && i < sampleAuthorProfiles.length; i++) {
      const profileData = {
        ...sampleAuthorProfiles[i],
        user: researchers[i]._id
      };
      const profile = new AuthorProfile(profileData);
      await profile.save();
      console.log(`Created profile for: ${researchers[i].name}`);
    }

    // Create publications
    console.log('Creating publications...');
    const createdPublications = [];
    for (let i = 0; i < samplePublications.length; i++) {
      const pubData = { ...samplePublications[i] };
      
      // Assign random authors (2-3 authors per publication)
      const numAuthors = Math.floor(Math.random() * 2) + 2;
      const shuffledUsers = [...researchers].sort(() => Math.random() - 0.5);
      const selectedAuthors = shuffledUsers.slice(0, Math.min(numAuthors, shuffledUsers.length));
      
      pubData.authors = selectedAuthors.map((author, index) => ({
        author: author._id,
        order: index + 1,
        isCorresponding: index === 0
      }));

      const publication = new Publication(pubData);
      await publication.save();
      createdPublications.push(publication);
      console.log(`Created publication: ${publication.title}`);
    }

    // Create some citation relationships
    console.log('Creating citation relationships...');
    for (let i = 0; i < createdPublications.length; i++) {
      const pub = createdPublications[i];
      // Add 1-3 random references
      const numReferences = Math.floor(Math.random() * 3) + 1;
      const availablePubs = createdPublications.filter(p => p._id.toString() !== pub._id.toString());
      const shuffledPubs = [...availablePubs].sort(() => Math.random() - 0.5);
      const selectedRefs = shuffledPubs.slice(0, Math.min(numReferences, shuffledPubs.length));
      
      pub.references = selectedRefs.map(ref => ref._id);
      await pub.save();
    }

    // Update citations count based on references
    console.log('Updating citation counts...');
    for (const pub of createdPublications) {
      const citationCount = await Publication.countDocuments({ references: pub._id });
      pub.citationsCount = citationCount;
      await pub.save();
    }

    console.log('Database seeding completed successfully!');
    console.log(`Created ${createdUsers.length} users`);
    console.log(`Created ${createdPublications.length} publications`);
    console.log(`Created ${researchers.length} author profiles`);

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
    process.exit(0);
  }
}

// Run the seed function
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
