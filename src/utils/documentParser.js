const fs = require('fs').promises;
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

class DocumentParser {
  constructor() {
    this.supportedTypes = {
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'text/plain': 'txt'
    };
  }

  // Process document based on file type
  async processDocument(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const fileBuffer = await fs.readFile(filePath);
      
      const fileExtension = path.extname(filePath).toLowerCase();
      const mimeType = this.getMimeType(fileExtension);
      const documentType = this.supportedTypes[mimeType] || 'unknown';

      let content = {
        text: '',
        metadata: {},
        type: documentType,
        size: stats.size,
        created_at: stats.birthtime,
        modified_at: stats.mtime
      };

      switch (documentType) {
        case 'pdf':
          content = await this.parsePDF(fileBuffer, content);
          break;
        
        case 'doc':
        case 'docx':
          content = await this.parseWord(fileBuffer, content);
          break;
        
        case 'txt':
          content = await this.parseText(fileBuffer, content);
          break;
        
        default:
          throw new Error(`Unsupported document type: ${documentType}`);
      }

      // Clean and normalize text
      content.text = this.cleanText(content.text);
      
      // Extract metadata
      content.metadata = {
        ...content.metadata,
        filename: path.basename(filePath),
        file_type: documentType,
        page_count: content.metadata.pageCount || 1,
        word_count: this.countWords(content.text),
        char_count: content.text.length
      };

      return content;

    } catch (error) {
      throw new Error(`Error processing document ${filePath}: ${error.message}`);
    }
  }

  // Get MIME type from file extension
  getMimeType(extension) {
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain'
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
  }

  // Parse PDF document
  async parsePDF(buffer, content) {
    try {
      const data = await pdf(buffer);
      
      content.text = data.text;
      content.metadata = {
        ...content.metadata,
        info: data.info,
        pageCount: data.numpages,
        version: data.version
      };

      return content;

    } catch (error) {
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  // Parse Word document (DOC/DOCX)
  async parseWord(buffer, content) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      
      content.text = result.value;
      content.metadata = {
        ...content.metadata,
        messages: result.messages
      };

      return content;

    } catch (error) {
      throw new Error(`Word document parsing failed: ${error.message}`);
    }
  }

  // Parse plain text document
  async parseText(buffer, content) {
    try {
      content.text = buffer.toString('utf8');
      
      return content;

    } catch (error) {
      throw new Error(`Text document parsing failed: ${error.message}`);
    }
  }

  // Clean and normalize text
  cleanText(text) {
    if (!text) return '';
    
    return text
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Remove special characters but keep basic punctuation
      .replace(/[^\w\s\.\,\!\?\;\:\-\(\)\[\]\{\}\"\'\/\\]/g, '')
      // Normalize quotes
      .replace(/["""]/g, '"')
      .replace(/['']/g, "'")
      // Remove extra spaces around punctuation
      .replace(/\s+([.,!?;:])/g, '$1')
      .trim();
  }

  // Count words in text
  countWords(text) {
    if (!text) return 0;
    
    return text.trim().split(/\s+/).length;
  }

  // Extract structured information from document
  async extractStructuredInfo(filePath) {
    try {
      const content = await this.processDocument(filePath);
      
      const structuredInfo = {
        title: this.extractTitle(content.text),
        authors: this.extractAuthors(content.text),
        abstract: this.extractAbstract(content.text),
        keywords: this.extractKeywords(content.text),
        publication_year: this.extractPublicationYear(content.text),
        references: this.extractReferences(content.text)
      };

      return {
        ...content,
        structured_info: structuredInfo
      };

    } catch (error) {
      throw new Error(`Error extracting structured info: ${error.message}`);
    }
  }

  // Extract title from text
  extractTitle(text) {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // First non-empty line is usually the title
    if (lines.length > 0) {
      let title = lines[0].trim();
      
      // Remove common title prefixes
      title = title.replace(/^(title|abstract|introduction)\s*:?\s*/i, '');
      
      // Clean up title
      title = title.replace(/\s+/g, ' ').trim();
      
      // Reasonable title length check
      if (title.length > 10 && title.length < 200) {
        return title;
      }
    }
    
    return null;
  }

  // Extract authors from text
  extractAuthors(text) {
    // Look for common author patterns
    const authorPatterns = [
      /(?:authors?|by)\s*:?\s*([^\n]+)/i,
      /([A-Z][a-z]+ [A-Z][a-z]+(?:,\s*[A-Z][a-z]+ [A-Z][a-z]+)*)/g,
      /(\w+\s+\w+(?:\s+et\s+al\.)?)/gi
    ];

    const authors = [];
    
    for (const pattern of authorPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const authorList = match.replace(/^(authors?|by)\s*:?\s*/i, '')
            .split(/[,;]/)
            .map(author => author.trim())
            .filter(author => author.length > 0);
          
          authors.push(...authorList);
        }
      }
    }

    // Remove duplicates and return
    return [...new Set(authors)].slice(0, 10); // Limit to 10 authors
  }

  // Extract abstract from text
  extractAbstract(text) {
    const abstractPatterns = [
      /abstract[:\s]*([\s\S]{0,1000})\n/i,
      /summary[:\s]*([\s\S]{0,1000})\n/i,
      /^([\s\S]{200,1000})\s*(?:introduction|keywords|1\.)/im
    ];

    for (const pattern of abstractPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let abstract = match[1].trim();
        
        // Remove common trailing patterns
        abstract = abstract.replace(/\s*(?:keywords|introduction|1\.)[\s\S]*$/i, '');
        
        // Clean up abstract
        abstract = abstract.replace(/\s+/g, ' ').trim();
        
        if (abstract.length > 50 && abstract.length < 2000) {
          return abstract;
        }
      }
    }

    return null;
  }

  // Extract keywords from text
  extractKeywords(text) {
    // Look for keywords section
    const keywordPatterns = [
      /keywords?[:\s]*([\s\S]{0,500})\n/i,
      /key\s*words?[:\s]*([\s\S]{0,500})\n/i,
      /index\s*terms?[:\s]*([\s\S]{0,500})\n/i
    ];

    for (const pattern of keywordPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const keywords = match[1]
          .split(/[,;]/)
          .map(keyword => keyword.trim())
          .filter(keyword => keyword.length > 0);
        
        if (keywords.length > 0) {
          return keywords.slice(0, 20); // Limit to 20 keywords
        }
      }
    }

    return [];
  }

  // Extract publication year from text
  extractPublicationYear(text) {
    const yearPatterns = [
      /\b(19|20)\d{2}\b/g,
      /(?:year|published)\s*:?\s*(\d{4})/i,
      /\b\d{4}\b(?!\s*-\s*\d{2}-\s*\d{2})/g // Avoid matching dates
    ];

    const years = [];
    
    for (const pattern of yearPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const year = parseInt(match);
          if (year >= 1800 && year <= new Date().getFullYear() + 1) {
            years.push(year);
          }
        }
      }
    }

    // Return most recent reasonable year
    if (years.length > 0) {
      return Math.max(...years);
    }

    return null;
  }

  // Extract references from text
  extractReferences(text) {
    // Look for references section
    const referenceSectionPatterns = [
      /references[:\s]*([\s\S]*)$/i,
      /bibliography[:\s]*([\s\S]*)$/i,
      /works\s*cited[:\s]*([\s\S]*)$/i
    ];

    for (const pattern of referenceSectionPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const referencesText = match[1].trim();
        
        // Split references by common patterns
        const referencePatterns = [
          /^\d+\.\s+/gm,
          /^\[\d+\]\s+/gm,
          /^[A-Z]\.\s+/gm
        ];

        let references = [];
        
        for (const refPattern of referencePatterns) {
          references = referencesText.split(refPattern)
            .filter(ref => ref.trim().length > 10)
            .map(ref => ref.trim());
          
          if (references.length > 1) {
            break;
          }
        }

        return references.slice(0, 100); // Limit to 100 references
      }
    }

    return [];
  }

  // Validate document content
  validateDocument(content) {
    const validation = {
      is_valid: true,
      errors: [],
      warnings: []
    };

    // Check if text exists
    if (!content.text || content.text.trim().length === 0) {
      validation.is_valid = false;
      validation.errors.push('Document contains no text content');
    }

    // Check minimum content length
    if (content.text && content.text.length < 100) {
      validation.warnings.push('Document text is very short');
    }

    // Check for structured information
    if (content.structured_info) {
      if (!content.structured_info.title) {
        validation.warnings.push('Could not extract document title');
      }

      if (!content.structured_info.abstract) {
        validation.warnings.push('Could not extract document abstract');
      }
    }

    return validation;
  }

  // Get document statistics
  getDocumentStats(content) {
    const text = content.text || '';
    const words = text.split(/\s+/).filter(word => word.length > 0);
    
    return {
      character_count: text.length,
      word_count: words.length,
      sentence_count: text.split(/[.!?]+/).length - 1,
      paragraph_count: text.split(/\n\n+/).length,
      average_word_length: words.length > 0 ? 
        words.reduce((sum, word) => sum + word.length, 0) / words.length : 0,
      average_sentence_length: 0
    };
  }
}

module.exports = {
  processDocument: async (filePath) => {
    const parser = new DocumentParser();
    return await parser.processDocument(filePath);
  },
  
  extractStructuredInfo: async (filePath) => {
    const parser = new DocumentParser();
    return await parser.extractStructuredInfo(filePath);
  },
  
  validateDocument: (content) => {
    const parser = new DocumentParser();
    return parser.validateDocument(content);
  },
  
  getDocumentStats: (content) => {
    const parser = new DocumentParser();
    return parser.getDocumentStats(content);
  }
};
