const axios = require('axios');
const Publication = require('../models/Publication');
const Author = require('../models/Author');
const Citation = require('../models/Citation');
const Topic = require('../models/Topic');
const logger = require('../utils/logger');
const cron = require('node-cron');

class ETLService {
  constructor() {
    this.processingQueue = [];
    this.isProcessing = false;
    this.batchSize = parseInt(process.env.BATCH_SIZE) || 100;
    this.nlpServiceUrl = process.env.NLP_SERVICE_URL || 'http://localhost:5000';
  }

  // Initialize scheduled ETL jobs
  initializeScheduledJobs() {
    // Daily ETL job at 2 AM
    cron.schedule(process.env.ETL_SCHEDULE || '0 2 * * *', async () => {
      logger.info('Starting scheduled ETL job');
      await this.runDailyETL();
    });

    // Hourly citation updates
    cron.schedule('0 * * * *', async () => {
      logger.info('Starting hourly citation update');
      await this.updateCitationCounts();
    });

    logger.info('ETL scheduled jobs initialized');
  }

  // Main ETL pipeline
  async runDailyETL() {
    try {
      logger.info('Starting daily ETL pipeline');
      
      await Promise.all([
        this.syncExternalData(),
        this.processPendingPublications(),
        this.updateAuthorMetrics(),
        this.generateTopicModels(),
        this.updateSearchIndex()
      ]);

      logger.info('Daily ETL pipeline completed successfully');
      
    } catch (error) {
      logger.error('ETL pipeline failed:', error);
      throw error;
    }
  }

  // Sync data from external sources
  async syncExternalData() {
    try {
      logger.info('Starting external data synchronization');
      
      const sources = ['openalex', 'crossref'];
      const syncResults = {};

      for (const source of sources) {
        try {
          syncResults[source] = await this.syncFromSource(source);
          logger.info(`${source} sync completed`);
        } catch (error) {
          logger.error(`${source} sync failed:`, error);
          syncResults[source] = { error: error.message };
        }
      }

      return syncResults;
      
    } catch (error) {
      logger.error('External data sync failed:', error);
      throw error;
    }
  }

  // Sync from specific source
  async syncFromSource(source) {
    const batchSize = 100;
    let processed = 0;
    let hasMore = true;
    let totalProcessed = 0;

    while (hasMore) {
      const batch = await this.fetchBatchFromSource(source, processed, batchSize);
      
      if (!batch || batch.length === 0) {
        hasMore = false;
        break;
      }

      const processedBatch = await this.processBatch(batch, source);
      totalProcessed += processedBatch.processed;
      processed += batchSize;

      logger.info(`${source}: Processed ${totalProcessed} records`);
    }

    return { totalProcessed, source };
  }

  // Fetch batch from external source
  async fetchBatchFromSource(source, offset, limit) {
    try {
      let url;
      let headers = {};

      switch (source) {
        case 'openalex':
          url = `${process.env.OPENALEX_API_URL}/works`;
          headers = {
            'User-Agent': 'Scientific Publications API/1.0'
          };
          break;
        
        case 'crossref':
          url = `${process.env.CROSSREF_API_URL}/works`;
          headers = {
            'User-Agent': 'Scientific Publications API/1.0 (mailto:support@scientific-publications.com)'
          };
          break;
        
        default:
          throw new Error(`Unsupported source: ${source}`);
      }

      const params = {
        offset,
        limit,
        filter: 'from-pub-date:2023' // Only recent publications
      };

      const response = await axios.get(url, { params, headers, timeout: 30000 });
      
      return response.data.message?.items || response.data.results || response.data;
      
    } catch (error) {
      logger.error(`Error fetching from ${source}:`, error);
      throw error;
    }
  }

  // Process batch of publications
  async processBatch(batch, source) {
    const results = {
      processed: 0,
      updated: 0,
      created: 0,
      errors: []
    };

    for (const item of batch) {
      try {
        const publicationData = this.transformExternalData(item, source);
        
        // Check if publication already exists
        const existingPub = await this.findExistingPublication(publicationData);
        
        if (existingPub) {
          // Update existing publication
          await this.updatePublication(existingPub._id, publicationData);
          results.updated++;
        } else {
          // Create new publication
          await this.createPublication(publicationData);
          results.created++;
        }
        
        results.processed++;
        
      } catch (error) {
        logger.error(`Error processing item from ${source}:`, error);
        results.errors.push({
          item: item.id || item.DOI,
          error: error.message
        });
      }
    }

    return results;
  }

  // Transform external data to our format
  transformExternalData(item, source) {
    switch (source) {
      case 'openalex':
        return this.transformOpenAlexData(item);
      
      case 'crossref':
        return this.transformCrossrefData(item);
      
      default:
        throw new Error(`Unsupported source: ${source}`);
    }
  }

  // Transform OpenAlex data
  transformOpenAlexData(item) {
    return {
      title: item.title,
      abstract: item.abstract_inverted_index ? 
        Object.keys(item.abstract_inverted_index).join(' ') : null,
      publication_year: item.publication_year,
      doi: item.doi,
      openalex_id: item.id,
      authors: item.authorships?.map(authorship => ({
        author_id: null, // Will be matched later
        name: authorship.author.display_name,
        order: authorship.author_position,
        affiliation: authorship.institutions?.[0]?.display_name
      })) || [],
      journal: item.primary_location?.source ? {
        name: item.primary_location.source.display_name,
        issn: item.primary_location.source.issn_l,
        publisher: item.primary_location.source.publisher
      } : null,
      citations_count: item.cited_by_count || 0,
      references_count: item.referenced_works?.length || 0,
      keywords: item.concepts?.map(concept => ({
        term: concept.display_name,
        weight: concept.score,
        source: 'openalex'
      })) || [],
      source: 'openalex',
      source_id: item.id,
      processing_status: 'pending',
      created_at: item.created_date ? new Date(item.created_date) : new Date(),
      publication_date: item.publication_date ? new Date(item.publication_date) : null
    };
  }

  // Transform Crossref data
  transformCrossrefData(item) {
    return {
      title: item.title?.[0],
      abstract: item.abstract,
      publication_year: item.published?.['date-parts']?.[0]?.[0],
      doi: item.DOI,
      authors: item.author?.map(author => ({
        author_id: null,
        name: `${author.given} ${author.family}`,
        order: author.sequence,
        affiliation: author.affiliation?.[0]?.name
      })) || [],
      journal: item['container-title']?.[0] ? {
        name: item['container-title'][0],
        issn: item.ISSN?.[0],
        publisher: item.publisher
      } : null,
      citations_count: item['is-referenced-by-count'] || 0,
      references_count: item.reference?.length || 0,
      source: 'crossref',
      source_id: item.DOI,
      processing_status: 'pending',
      created_at: item.created?.['date-time'] ? new Date(item.created['date-time']) : new Date(),
      publication_date: item.published?.['date-time'] ? new Date(item.published['date-time']) : null
    };
  }

  // Find existing publication
  async findExistingPublication(publicationData) {
    const queries = [];
    
    if (publicationData.doi) {
      queries.push({ doi: publicationData.doi });
    }
    
    if (publicationData.openalex_id) {
      queries.push({ openalex_id: publicationData.openalex_id });
    }
    
    if (publicationData.arxiv_id) {
      queries.push({ arxiv_id: publicationData.arxiv_id });
    }

    if (queries.length === 0) {
      return null;
    }

    return await Publication.findOne({ $or: queries });
  }

  // Create publication
  async createPublication(publicationData) {
    try {
      // Match or create authors
      if (publicationData.authors && publicationData.authors.length > 0) {
        publicationData.authors = await this.matchOrCreateAuthors(publicationData.authors);
      }

      const publication = new Publication(publicationData);
      await publication.save();

      // Trigger NLP processing
      await this.processPublicationWithNLP(publication._id);

      return publication;
      
    } catch (error) {
      logger.error('Error creating publication:', error);
      throw error;
    }
  }

  // Update publication
  async updatePublication(publicationId, publicationData) {
    try {
      // Match or create authors
      if (publicationData.authors && publicationData.authors.length > 0) {
        publicationData.authors = await this.matchOrCreateAuthors(publicationData.authors);
      }

      await Publication.findByIdAndUpdate(publicationId, {
        ...publicationData,
        updated_at: new Date()
      });

      // Trigger NLP processing if content changed
      if (publicationData.title || publicationData.abstract) {
        await this.processPublicationWithNLP(publicationId);
      }

    } catch (error) {
      logger.error('Error updating publication:', error);
      throw error;
    }
  }

  // Match or create authors
  async matchOrCreateAuthors(authorData) {
    const matchedAuthors = [];

    for (const authorInfo of authorData) {
      try {
        // Try to find existing author
        let author = await Author.findOne({
          $or: [
            { full_name: authorInfo.name },
            { 'affiliations.name': authorInfo.affiliation }
          ]
        });

        if (!author) {
          // Create new author
          author = new Author({
            first_name: authorInfo.name.split(' ')[0],
            last_name: authorInfo.name.split(' ').slice(-1)[0],
            full_name: authorInfo.name,
            affiliations: authorInfo.affiliation ? [{
              name: authorInfo.affiliation,
              current: true
            }] : [],
            source: 'etl',
            status: 'active'
          });
          await author.save();
        }

        matchedAuthors.push({
          author_id: author._id,
          name: authorInfo.name,
          order: authorInfo.order,
          affiliation: authorInfo.affiliation
        });

      } catch (error) {
        logger.error(`Error processing author ${authorInfo.name}:`, error);
        matchedAuthors.push({
          author_id: null,
          name: authorInfo.name,
          order: authorInfo.order,
          affiliation: authorInfo.affiliation
        });
      }
    }

    return matchedAuthors;
  }

  // Process publication with NLP
  async processPublicationWithNLP(publicationId) {
    try {
      const publication = await Publication.findById(publicationId);
      if (!publication) return;

      const response = await axios.post(`${this.nlpServiceUrl}/process/publication`, {
        title: publication.title,
        abstract: publication.abstract || '',
        full_text: publication.full_text || ''
      }, { timeout: 30000 });

      if (response.data) {
        await Publication.findByIdAndUpdate(publicationId, {
          keywords: response.data.keywords?.combined || [],
          sentiment_score: response.data.sentiment,
          embeddings: {
            title_vector: response.data.embeddings?.title,
            abstract_vector: response.data.embeddings?.abstract,
            full_text_vector: response.data.embeddings?.full_text,
            model_version: 'sentence-transformers',
            generated_at: new Date()
          },
          processing_status: 'completed',
          updated_at: new Date()
        });
      }

    } catch (error) {
      logger.error(`NLP processing failed for publication ${publicationId}:`, error);
      
      await Publication.findByIdAndUpdate(publicationId, {
        processing_status: 'failed',
        processing_errors: [error.message],
        updated_at: new Date()
      });
    }
  }

  // Process pending publications
  async processPendingPublications() {
    try {
      logger.info('Processing pending publications');
      
      const pendingPublications = await Publication.find({
        processing_status: 'pending'
      }).limit(this.batchSize);

      logger.info(`Found ${pendingPublications.length} pending publications`);

      for (const publication of pendingPublications) {
        await this.processPublicationWithNLP(publication._id);
      }

      return { processed: pendingPublications.length };
      
    } catch (error) {
      logger.error('Error processing pending publications:', error);
      throw error;
    }
  }

  // Update author metrics
  async updateAuthorMetrics() {
    try {
      logger.info('Updating author metrics');
      
      const authors = await Author.find({ status: 'active' });
      let updated = 0;

      for (const author of authors) {
        try {
          // Get author's publications
          const publications = await Publication.find({
            'authors.author_id': author._id,
            status: 'published'
          });

          // Calculate metrics
          const totalPublications = publications.length;
          const totalCitations = publications.reduce((sum, pub) => sum + pub.citations_count, 0);
          const citationsPerPublication = totalPublications > 0 ? totalCitations / totalPublications : 0;

          // Update author
          await Author.findByIdAndUpdate(author._id, {
            total_publications: totalPublications,
            total_citations: totalCitations,
            publications: publications.map(pub => ({
              publication_id: pub._id,
              title: pub.title,
              year: pub.publication_year,
              citations_count: pub.citations_count
            })),
            updated_at: new Date()
          });

          updated++;

        } catch (error) {
          logger.error(`Error updating metrics for author ${author._id}:`, error);
        }
      }

      return { updated };
      
    } catch (error) {
      logger.error('Error updating author metrics:', error);
      throw error;
    }
  }

  // Update citation counts
  async updateCitationCounts() {
    try {
      logger.info('Updating citation counts');
      
      const publications = await Publication.find({ status: 'published' });
      let updated = 0;

      for (const publication of publications) {
        try {
          const citationCount = await Citation.countDocuments({
            cited_publication_id: publication._id
          });

          const referenceCount = await Citation.countDocuments({
            citing_publication_id: publication._id
          });

          if (citationCount !== publication.citations_count || 
              referenceCount !== publication.references_count) {
            
            await Publication.findByIdAndUpdate(publication._id, {
              citations_count: citationCount,
              references_count: referenceCount,
              updated_at: new Date()
            });

            updated++;
          }

        } catch (error) {
          logger.error(`Error updating citation counts for publication ${publication._id}:`, error);
        }
      }

      return { updated };
      
    } catch (error) {
      logger.error('Error updating citation counts:', error);
      throw error;
    }
  }

  // Generate topic models
  async generateTopicModels() {
    try {
      logger.info('Generating topic models');
      
      // Get recent publications for topic modeling
      const publications = await Publication.find({
        status: 'published',
        $or: [
          { abstract: { $exists: true, $ne: null } },
          { full_text: { $exists: true, $ne: null } }
        ]
      }).limit(1000);

      if (publications.length < 50) {
        logger.info('Not enough publications for topic modeling');
        return { message: 'Not enough publications' };
      }

      // Prepare documents for topic modeling
      const documents = publications.map(pub => 
        pub.abstract || pub.full_text || pub.title
      ).filter(doc => doc && doc.length > 100);

      if (documents.length < 20) {
        logger.info('Not enough documents with content for topic modeling');
        return { message: 'Not enough documents with content' };
      }

      // Call NLP service for topic modeling
      const response = await axios.post(`${this.nlpServiceUrl}/model/topics`, {
        documents,
        num_topics: 20,
        algorithm: 'lda'
      }, { timeout: 120000 });

      if (response.data && response.data.topics) {
        // Create or update topics in database
        for (const topicData of response.data.topics) {
          await this.createOrUpdateTopic(topicData, publications);
        }

        logger.info(`Generated ${response.data.topics.length} topics`);
        return { 
          topics_generated: response.data.topics.length,
          coherence_scores: response.data.coherence_scores
        };
      }

      return { message: 'Topic modeling completed' };
      
    } catch (error) {
      logger.error('Error generating topic models:', error);
      throw error;
    }
  }

  // Create or update topic
  async createOrUpdateTopic(topicData, publications) {
    try {
      const topicName = topicData.words.slice(0, 3).map(w => w.term).join(' ');
      
      let topic = await Topic.findOne({ name: topicName });
      
      if (!topic) {
        topic = new Topic({
          name: topicName,
          description: `Topic with keywords: ${topicData.words.map(w => w.term).join(', ')}`,
          keywords: topicData.words.map(w => ({
            term: w.term,
            weight: w.weight,
            source: 'topic_modeling'
          })),
          algorithm: 'lda',
          total_publications: 0,
          validation_status: 'validated'
        });
      } else {
        topic.keywords = topicData.words.map(w => ({
          term: w.term,
          weight: w.weight,
          source: 'topic_modeling'
        }));
      }

      await topic.save();
      
      // Update publications with topic assignments
      for (let i = 0; i < publications.length; i++) {
        if (response.data.document_topic_distribution && 
            response.data.document_topic_distribution[i]) {
          
          const docTopics = response.data.document_topic_distribution[i];
          const dominantTopic = docTopics.indexOf(Math.max(...docTopics));
          
          if (dominantTopic === topicData.topic_id) {
            await Publication.findByIdAndUpdate(publications[i]._id, {
              $push: {
                topics: {
                  topic_id: topic._id,
                  confidence: docTopics[dominantTopic],
                  method: 'topic_modeling'
                }
              }
            });
          }
        }
      }

      return topic;
      
    } catch (error) {
      logger.error('Error creating/updating topic:', error);
      throw error;
    }
  }

  // Update search index (placeholder for Elasticsearch)
  async updateSearchIndex() {
    try {
      logger.info('Updating search index');
      
      // This would integrate with Elasticsearch
      // For now, just log the operation
      const publicationCount = await Publication.countDocuments({ status: 'published' });
      const authorCount = await Author.countDocuments({ status: 'active' });
      
      logger.info(`Search index update: ${publicationCount} publications, ${authorCount} authors`);
      
      return {
        publications_indexed: publicationCount,
        authors_indexed: authorCount
      };
      
    } catch (error) {
      logger.error('Error updating search index:', error);
      throw error;
    }
  }

  // Get ETL status
  getETLStatus() {
    return {
      is_processing: this.isProcessing,
      queue_size: this.processingQueue.length,
      batch_size: this.batchSize,
      last_run: this.lastETLRun,
      next_scheduled: this.nextScheduledRun
    };
  }

  // Manual ETL trigger
  async triggerManualETL(sources = ['openalex', 'crossref']) {
    try {
      if (this.isProcessing) {
        throw new Error('ETL is already running');
      }

      this.isProcessing = true;
      logger.info('Starting manual ETL trigger');

      const results = {};
      
      for (const source of sources) {
        results[source] = await this.syncFromSource(source);
      }

      this.isProcessing = false;
      this.lastETLRun = new Date();

      return results;
      
    } catch (error) {
      this.isProcessing = false;
      logger.error('Manual ETL failed:', error);
      throw error;
    }
  }
}

module.exports = new ETLService();
