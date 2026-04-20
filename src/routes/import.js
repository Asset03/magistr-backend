const express = require('express');
const router = express.Router();
const dataImportService = require('../services/dataImportService');
const etlService = require('../services/etlService');
const { auth, uploadRateLimit, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

// Upload and process file
router.post('/upload', [
  auth,
  uploadRateLimit,
  dataImportService.upload.single('file'),
  body('title').optional().isString(),
  body('authors').optional().isString(),
  body('year').optional().isInt({ min: 1800, max: new Date().getFullYear() + 1 }),
  body('keywords').optional().isString(),
  body('abstract').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const options = {
      title: req.body.title,
      authors: req.body.authors,
      year: req.body.year ? parseInt(req.body.year) : undefined,
      keywords: req.body.keywords,
      abstract: req.body.abstract
    };

    const result = await dataImportService.importFromDocument(req.file.path, options);

    logger.info(`Document uploaded and processed: ${req.file.originalname}`);

    res.json({
      message: 'File uploaded and processed successfully',
      file: {
        originalname: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      },
      result
    });

  } catch (error) {
    logger.error('File upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import from CSV
router.post('/csv', [
  auth,
  uploadRateLimit,
  dataImportService.upload.single('file'),
  body('batchSize').optional().isInt({ min: 1, max: 1000 }),
  body('updateExisting').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const options = {
      batchSize: req.body.batchSize || 50,
      updateExisting: req.body.updateExisting || false
    };

    const result = await dataImportService.importFromCSV(req.file.path, options);

    logger.info(`CSV import completed: ${req.file.originalname}`);

    res.json({
      message: 'CSV import completed',
      file: req.file.originalname,
      result
    });

  } catch (error) {
    logger.error('CSV import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import from JSON
router.post('/json', [
  auth,
  uploadRateLimit,
  dataImportService.upload.single('file'),
  body('batchSize').optional().isInt({ min: 1, max: 1000 }),
  body('updateExisting').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No JSON file uploaded' });
    }

    const options = {
      batchSize: req.body.batchSize || 50,
      updateExisting: req.body.updateExisting || false
    };

    const result = await dataImportService.importFromJSON(req.file.path, options);

    logger.info(`JSON import completed: ${req.file.originalname}`);

    res.json({
      message: 'JSON import completed',
      file: req.file.originalname,
      result
    });

  } catch (error) {
    logger.error('JSON import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch import multiple files
router.post('/batch', [
  auth,
  uploadRateLimit,
  dataImportService.upload.array('files', 10), // Max 10 files
  body('batchSize').optional().isInt({ min: 1, max: 1000 }),
  body('updateExisting').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const options = {
      batchSize: req.body.batchSize || 50,
      updateExisting: req.body.updateExisting || false
    };

    const filePaths = req.files.map(file => file.path);
    const result = await dataImportService.batchImport(filePaths, options);

    logger.info(`Batch import completed: ${req.files.length} files`);

    res.json({
      message: 'Batch import completed',
      files: req.files.map(file => ({
        originalname: file.originalname,
        filename: file.filename,
        size: file.size
      })),
      result
    });

  } catch (error) {
    logger.error('Batch import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Extract structured information from document
router.post('/extract-info', [
  auth,
  uploadRateLimit,
  dataImportService.upload.single('file')
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await dataImportService.extractStructuredInfo(req.file.path);

    res.json({
      file: {
        originalname: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      },
      extracted_info: result
    });

  } catch (error) {
    logger.error('Document info extraction error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Validate import data
router.post('/validate', [
  auth,
  body('data').notEmpty().withMessage('Data is required'),
  body('format').isIn(['json', 'csv']).withMessage('Format must be json or csv')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { data, format } = req.body;
    let records = [];

    if (format === 'json') {
      records = Array.isArray(data) ? data : [data];
    } else if (format === 'csv') {
      // Parse CSV data
      records = await dataImportService.importFromCSV(data, { dryRun: true });
    }

    const validationErrors = [];
    let validRecords = 0;

    for (let i = 0; i < records.length; i++) {
      const recordErrors = dataImportService.validateImportData(records[i]);
      if (recordErrors.length > 0) {
        validationErrors.push({
          row: i + 1,
          errors: recordErrors
        });
      } else {
        validRecords++;
      }
    }

    res.json({
      total_records: records.length,
      valid_records: validRecords,
      invalid_records: validationErrors.length,
      validation_errors: validationErrors,
      is_valid: validationErrors.length === 0
    });

  } catch (error) {
    logger.error('Data validation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get import status and configuration
router.get('/status', auth, async (req, res) => {
  try {
    const status = dataImportService.getImportStatus();
    
    res.json({
      import_service: status,
      etl_service: etlService.getETLStatus()
    });

  } catch (error) {
    logger.error('Import status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export publications
router.get('/export', [
  auth,
  body('format').isIn(['json', 'csv']).withMessage('Format must be json or csv'),
  body('filters').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { format, filters = {} } = req.body;

    const exportResult = await dataImportService.exportPublications(format, filters);

    // Set appropriate headers for file download
    res.setHeader('Content-Type', exportResult.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
    res.setHeader('Content-Length', exportResult.size);

    // Send file
    const fs = require('fs');
    const fileStream = fs.createReadStream(exportResult.path);
    fileStream.pipe(res);

    // Clean up file after sending
    fileStream.on('end', () => {
      fs.unlink(exportResult.path, (err) => {
        if (err) logger.error('Error cleaning up export file:', err);
      });
    });

  } catch (error) {
    logger.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Trigger manual ETL
router.post('/etl/trigger', [
  auth,
  authorize('admin', 'researcher'),
  body('sources').optional().isArray(),
  body('fullSync').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { sources = ['openalex', 'crossref'], fullSync = false } = req.body;

    const result = await etlService.triggerManualETL(sources);

    logger.info(`Manual ETL triggered by user ${req.user.id}`);

    res.json({
      message: 'ETL process started',
      sources,
      full_sync: fullSync,
      result
    });

  } catch (error) {
    logger.error('Manual ETL trigger error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get ETL job status
router.get('/etl/status', [
  auth,
  authorize('admin', 'researcher')
], async (req, res) => {
  try {
    const status = etlService.getETLStatus();
    
    res.json(status);

  } catch (error) {
    logger.error('ETL status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clean up old upload files
router.delete('/cleanup', [
  auth,
  authorize('admin')
], async (req, res) => {
  try {
    const maxAge = req.body.maxAge || 24 * 60 * 60 * 1000; // 24 hours default
    
    const result = await dataImportService.cleanupOldUploads(maxAge);

    logger.info(`Upload cleanup completed by user ${req.user.id}`);

    res.json({
      message: 'Cleanup completed',
      max_age_hours: maxAge / (60 * 60 * 1000),
      result
    });

  } catch (error) {
    logger.error('Cleanup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get import statistics
router.get('/statistics', [
  auth,
  authorize('admin', 'researcher')
], async (req, res) => {
  try {
    const Publication = require('../models/Publication');
    const Author = require('../models/Author');
    const Citation = require('../models/Citation');

    const [
      totalPublications,
      totalAuthors,
      totalCitations,
      recentImports,
      importsBySource
    ] = await Promise.all([
      Publication.countDocuments(),
      Author.countDocuments(),
      Citation.countDocuments(),
      Publication.countDocuments({
        created_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }),
      Publication.aggregate([
        {
          $group: {
            _id: '$source',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    res.json({
      overview: {
        total_publications: totalPublications,
        total_authors: totalAuthors,
        total_citations: totalCitations,
        recent_imports: recentImports
      },
      imports_by_source: importsBySource,
      import_service: dataImportService.getImportStatus(),
      etl_service: etlService.getETLStatus()
    });

  } catch (error) {
    logger.error('Import statistics error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
