const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const Publication = require('../models/Publication');
const Author = require('../models/Author');
const Citation = require('../models/Citation');
const logger = require('../utils/logger');
const { processDocument } = require('../utils/documentParser');

class DataImportService {
  constructor() {
    this.uploadDir = process.env.UPLOAD_PATH || './uploads';
    this.maxFileSize = process.env.MAX_FILE_SIZE || '10MB';
    
    // Ensure upload directory exists
    this.ensureUploadDirectory();
    
    // Configure multer for file uploads
    this.upload = multer({
      dest: this.uploadDir,
      limits: {
        fileSize: this.parseFileSize(this.maxFileSize)
      },
      fileFilter: this.fileFilter.bind(this),
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          cb(null, this.uploadDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
      })
    });
  }

  // Ensure upload directory exists
  async ensureUploadDirectory() {
    try {
      await fs.access(this.uploadDir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(this.uploadDir, { recursive: true });
        logger.info(`Created upload directory: ${this.uploadDir}`);
      }
    }
  }

  // Parse file size string
  parseFileSize(sizeStr) {
    const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
    const match = sizeStr.match(/^(\d+)(B|KB|MB|GB)$/i);
    
    if (!match) {
      return 10 * 1024 * 1024; // Default 10MB
    }
    
    const [, size, unit] = match;
    return parseInt(size) * (units[unit.toUpperCase()] || 1);
  }

  // File filter for uploads
  fileFilter(req, file, cb) {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv',
      'application/json',
      'application/xml'
    ];

    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.csv', '.json', '.xml'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
  }

  // Import publications from CSV file
  async importFromCSV(filePath, options = {}) {
    try {
      logger.info(`Starting CSV import from: ${filePath}`);
      
      const csv = require('csv-parser');
      const results = [];
      const errors = [];

      return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => {
            results.push(data);
          })
          .on('end', async () => {
            try {
              const importResult = await this.processCSVData(results, options);
              resolve(importResult);
            } catch (error) {
              reject(error);
            }
          })
          .on('error', (error) => {
            reject(error);
          });
      });

    } catch (error) {
      logger.error('CSV import failed:', error);
      throw error;
    }
  }

  // Process CSV data
  async processCSVData(data, options) {
    const results = {
      total: data.length,
      processed: 0,
      created: 0,
      updated: 0,
      errors: []
    };

    const batchSize = options.batchSize || 50;
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      for (const row of batch) {
        try {
          const publicationData = this.transformCSVRow(row);
          
          const existingPub = await this.findExistingPublication(publicationData);
          
          if (existingPub) {
            await this.updatePublication(existingPub._id, publicationData);
            results.updated++;
          } else {
            await this.createPublication(publicationData);
            results.created++;
          }
          
          results.processed++;
          
        } catch (error) {
          logger.error(`Error processing CSV row:`, error);
          results.errors.push({
            row: i + 1,
            data: row,
            error: error.message
          });
        }
      }
    }

    return results;
  }

  // Transform CSV row to publication format
  transformCSVRow(row) {
    return {
      title: row.title || row.Title,
      abstract: row.abstract || row.Abstract,
      publication_year: parseInt(row.year || row.publication_year || row.Year),
      doi: row.doi || row.DOI,
      authors: this.parseAuthors(row.authors || row.Authors),
      journal: row.journal || row.Journal ? {
        name: row.journal || row.Journal,
        volume: row.volume || row.Volume,
        issue: row.issue || row.Issue,
        pages: row.pages || row.Pages
      } : null,
      keywords: this.parseKeywords(row.keywords || row.Keywords),
      source: 'csv_import',
      processing_status: 'pending'
    };
  }

  // Parse authors from string
  parseAuthors(authorString) {
    if (!authorString) return [];
    
    const separators = [';', ',', ' and ', ' & '];
    let authors = authorString;
    
    separators.forEach(sep => {
      authors = authors.split(sep);
    });
    
    return authors
      .map(author => author.trim())
      .filter(author => author.length > 0)
      .map((name, index) => ({
        author_id: null,
        name,
        order: index
      }));
  }

  // Parse keywords from string
  parseKeywords(keywordString) {
    if (!keywordString) return [];
    
    return keywordString
      .split(/[,;]/)
      .map(keyword => ({
        term: keyword.trim(),
        weight: 1.0,
        source: 'manual'
      }))
      .filter(keyword => keyword.term.length > 0);
  }

  // Import publications from JSON file
  async importFromJSON(filePath, options = {}) {
    try {
      logger.info(`Starting JSON import from: ${filePath}`);
      
      const fileContent = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(fileContent);
      
      const publications = Array.isArray(data) ? data : [data];
      
      return await this.processJSONData(publications, options);
      
    } catch (error) {
      logger.error('JSON import failed:', error);
      throw error;
    }
  }

  // Process JSON data
  async processJSONData(data, options) {
    const results = {
      total: data.length,
      processed: 0,
      created: 0,
      updated: 0,
      errors: []
    };

    for (let i = 0; i < data.length; i++) {
      try {
        const publicationData = this.transformJSONItem(data[i]);
        
        const existingPub = await this.findExistingPublication(publicationData);
        
        if (existingPub) {
          await this.updatePublication(existingPub._id, publicationData);
          results.updated++;
        } else {
          await this.createPublication(publicationData);
          results.created++;
        }
        
        results.processed++;
        
      } catch (error) {
        logger.error(`Error processing JSON item ${i}:`, error);
        results.errors.push({
          index: i,
          data: data[i],
          error: error.message
        });
      }
    }

    return results;
  }

  // Transform JSON item to publication format
  transformJSONItem(item) {
    return {
      title: item.title,
      abstract: item.abstract,
      full_text: item.full_text,
      publication_year: item.publication_year,
      doi: item.doi,
      authors: item.authors || [],
      journal: item.journal,
      keywords: item.keywords || [],
      source: 'json_import',
      processing_status: 'pending'
    };
  }

  // Import from document files (PDF, DOC, etc.)
  async importFromDocument(filePath, options = {}) {
    try {
      logger.info(`Starting document import from: ${filePath}`);
      
      const documentContent = await processDocument(filePath);
      
      if (!documentContent || !documentContent.text) {
        throw new Error('Could not extract text from document');
      }

      const publicationData = {
        title: options.title || documentContent.metadata?.title || path.basename(filePath),
        abstract: options.abstract || this.extractAbstract(documentContent.text),
        full_text: documentContent.text,
        authors: options.authors || [],
        publication_year: options.year || new Date().getFullYear(),
        keywords: options.keywords || [],
        file_info: {
          filename: path.basename(filePath),
          file_type: documentContent.type,
          file_size: documentContent.size,
          file_path: filePath
        },
        source: 'document_import',
        processing_status: 'pending'
      };

      const publication = await this.createPublication(publicationData);
      
      return {
        processed: 1,
        created: 1,
        publication_id: publication._id
      };
      
    } catch (error) {
      logger.error('Document import failed:', error);
      throw error;
    }
  }

  // Extract abstract from full text
  extractAbstract(fullText) {
    // Simple abstract extraction - look for common patterns
    const abstractPatterns = [
      /abstract[:\s]*([\s\S]{0,500})/i,
      /summary[:\s]*([\s\S]{0,500})/i,
      /^([\s\S]{200,500})\s*(?:introduction|keywords)/i
    ];

    for (const pattern of abstractPatterns) {
      const match = fullText.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Return first 300 characters as fallback
    return fullText.substring(0, 300).trim() + '...';
  }

  // Batch import from multiple files
  async batchImport(filePaths, options = {}) {
    try {
      logger.info(`Starting batch import of ${filePaths.length} files`);
      
      const results = {
        total_files: filePaths.length,
        processed_files: 0,
        total_records: 0,
        created: 0,
        updated: 0,
        errors: []
      };

      for (const filePath of filePaths) {
        try {
          const fileResult = await this.importFromFile(filePath, options);
          
          results.processed_files++;
          results.total_records += fileResult.processed || 0;
          results.created += fileResult.created || 0;
          results.updated += fileResult.updated || 0;
          
          if (fileResult.errors) {
            results.errors.push(...fileResult.errors);
          }
          
        } catch (error) {
          logger.error(`Error importing file ${filePath}:`, error);
          results.errors.push({
            file: filePath,
            error: error.message
          });
        }
      }

      return results;
      
    } catch (error) {
      logger.error('Batch import failed:', error);
      throw error;
    }
  }

  // Import from file (auto-detect format)
  async importFromFile(filePath, options = {}) {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.csv':
        return await this.importFromCSV(filePath, options);
      
      case '.json':
        return await this.importFromJSON(filePath, options);
      
      case '.pdf':
      case '.doc':
      case '.docx':
      case '.txt':
        return await this.importFromDocument(filePath, options);
      
      default:
        throw new Error(`Unsupported file format: ${ext}`);
    }
  }

  // Validate import data
  validateImportData(data, requiredFields = ['title']) {
    const errors = [];
    
    for (const field of requiredFields) {
      if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    if (data.publication_year) {
      const year = parseInt(data.publication_year);
      const currentYear = new Date().getFullYear();
      
      if (isNaN(year) || year < 1800 || year > currentYear + 1) {
        errors.push(`Invalid publication year: ${data.publication_year}`);
      }
    }

    if (data.doi) {
      const doiPattern = /^10\.\d+\/.+$/;
      if (!doiPattern.test(data.doi)) {
        errors.push(`Invalid DOI format: ${data.doi}`);
      }
    }

    return errors;
  }

  // Get import status
  getImportStatus() {
    return {
      upload_directory: this.uploadDir,
      max_file_size: this.maxFileSize,
      supported_formats: ['.csv', '.json', '.pdf', '.doc', '.docx', '.txt'],
      current_uploads: this.getCurrentUploads()
    };
  }

  // Get current uploads
  async getCurrentUploads() {
    try {
      const files = await fs.readdir(this.uploadDir);
      return files.map(file => ({
        filename: file,
        path: path.join(this.uploadDir, file),
        size: fs.stat(path.join(this.uploadDir, file)).then(stat => stat.size).catch(() => 0)
      }));
    } catch (error) {
      logger.error('Error getting current uploads:', error);
      return [];
    }
  }

  // Clean up old uploads
  async cleanupOldUploads(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
    try {
      const files = await fs.readdir(this.uploadDir);
      const now = Date.now();
      let deleted = 0;

      for (const file of files) {
        const filePath = path.join(this.uploadDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          deleted++;
        }
      }

      logger.info(`Cleaned up ${deleted} old upload files`);
      return { deleted };
      
    } catch (error) {
      logger.error('Error cleaning up uploads:', error);
      throw error;
    }
  }

  // Export publications to format
  async exportPublications(format = 'json', filters = {}) {
    try {
      logger.info(`Exporting publications in ${format} format`);
      
      const publications = await Publication.find(filters)
        .populate('authors.author_id', 'full_name')
        .populate('topics.topic_id', 'name');

      let exportData;
      let filename;
      let mimeType;

      switch (format.toLowerCase()) {
        case 'json':
          exportData = JSON.stringify(publications, null, 2);
          filename = `publications_export_${Date.now()}.json`;
          mimeType = 'application/json';
          break;
        
        case 'csv':
          exportData = this.convertToCSV(publications);
          filename = `publications_export_${Date.now()}.csv`;
          mimeType = 'text/csv';
          break;
        
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      const exportPath = path.join(this.uploadDir, filename);
      await fs.writeFile(exportPath, exportData);

      return {
        filename,
        path: exportPath,
        mime_type: mimeType,
        size: exportData.length,
        record_count: publications.length
      };
      
    } catch (error) {
      logger.error('Export failed:', error);
      throw error;
    }
  }

  // Convert publications to CSV
  convertToCSV(publications) {
    const csv = require('csv-writer');
    
    const records = publications.map(pub => ({
      title: pub.title,
      abstract: pub.abstract,
      publication_year: pub.publication_year,
      doi: pub.doi,
      authors: pub.authors?.map(author => author.name).join('; '),
      journal: pub.journal?.name,
      keywords: pub.keywords?.map(kw => kw.term).join('; '),
      citations_count: pub.citations_count,
      created_at: pub.created_at
    }));

    return records;
  }

  // Helper methods reused from ETL service
  async findExistingPublication(publicationData) {
    const queries = [];
    
    if (publicationData.doi) {
      queries.push({ doi: publicationData.doi });
    }
    
    if (queries.length === 0) {
      return null;
    }

    return await Publication.findOne({ $or: queries });
  }

  async createPublication(publicationData) {
    try {
      if (publicationData.authors && publicationData.authors.length > 0) {
        publicationData.authors = await this.matchOrCreateAuthors(publicationData.authors);
      }

      const publication = new Publication(publicationData);
      await publication.save();

      return publication;
      
    } catch (error) {
      logger.error('Error creating publication:', error);
      throw error;
    }
  }

  async updatePublication(publicationId, publicationData) {
    try {
      if (publicationData.authors && publicationData.authors.length > 0) {
        publicationData.authors = await this.matchOrCreateAuthors(publicationData.authors);
      }

      await Publication.findByIdAndUpdate(publicationId, {
        ...publicationData,
        updated_at: new Date()
      });

    } catch (error) {
      logger.error('Error updating publication:', error);
      throw error;
    }
  }

  async matchOrCreateAuthors(authorData) {
    const matchedAuthors = [];

    for (const authorInfo of authorData) {
      try {
        let author = await Author.findOne({
          $or: [
            { full_name: authorInfo.name },
            { 'affiliations.name': authorInfo.affiliation }
          ]
        });

        if (!author) {
          author = new Author({
            first_name: authorInfo.name.split(' ')[0],
            last_name: authorInfo.name.split(' ').slice(-1)[0],
            full_name: authorInfo.name,
            affiliations: authorInfo.affiliation ? [{
              name: authorInfo.affiliation,
              current: true
            }] : [],
            source: 'import',
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
}

module.exports = new DataImportService();
