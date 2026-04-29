from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import logging
from typing import Dict, List, Any, Optional
import json
from datetime import datetime

# Import NLP modules
from text_processing import TextProcessor
from topic_modeling import TopicModeler
from embeddings import EmbeddingGenerator
from citation_analysis import CitationAnalyzer
from language_detection import LanguageDetector
from sentiment_analysis import SentimentAnalyzer
from keyword_extraction import KeywordExtractor
from document_parser import DocumentParser

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Initialize NLP components lazily to avoid startup timeout
text_processor = None
topic_modeler = None
embedding_generator = None
citation_analyzer = None
language_detector = None
sentiment_analyzer = None
keyword_extractor = None
document_parser = None

def initialize_components():
    """Initialize NLP components on first use"""
    global text_processor, topic_modeler, embedding_generator, citation_analyzer
    global language_detector, sentiment_analyzer, keyword_extractor, document_parser
    
    if text_processor is None:
        logger.info("Initializing NLP components...")
        text_processor = TextProcessor()
        topic_modeler = TopicModeler()
        embedding_generator = EmbeddingGenerator()
        citation_analyzer = CitationAnalyzer()
        language_detector = LanguageDetector()
        sentiment_analyzer = SentimentAnalyzer()
        keyword_extractor = KeywordExtractor()
        document_parser = DocumentParser()
        logger.info("NLP components initialized successfully")

@app.route('/')
def root():
    """Root endpoint for basic connectivity test"""
    return jsonify({
        'message': 'NLP Service is running',
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'NLP Service',
        'version': '1.0.0',
        'endpoints': [
            '/health',
            '/process/text',
            '/process/publication',
            '/analyze/citations',
            '/model/topics',
            '/embeddings/generate',
            '/keywords/extract',
            '/sentiment/analyze',
            '/language/detect',
            '/document/parse',
            '/batch/process'
        ]
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'NLP Service',
        'version': '1.0.0'
    })

@app.route('/process/text', methods=['POST'])
def process_text():
    """Process raw text for analysis"""
    try:
        # Initialize components on first request
        initialize_components()
        
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'error': 'Text is required'}), 400
        
        text = data['text']
        options = data.get('options', {})
        
        # Language detection
        language = language_detector.detect_language(text)
        
        # Text preprocessing
        processed_text = text_processor.preprocess(text, language)
        
        # Extract keywords
        keywords = keyword_extractor.extract_keywords(text, language)
        
        # Sentiment analysis
        sentiment = sentiment_analyzer.analyze_sentiment(text)
        
        # Generate embeddings
        embeddings = embedding_generator.generate_embeddings(text)
        
        # Extract entities
        entities = text_processor.extract_entities(text, language)
        
        result = {
            'original_text': text,
            'processed_text': processed_text,
            'language': language,
            'keywords': keywords,
            'sentiment': sentiment,
            'embeddings': embeddings.tolist() if embeddings is not None else None,
            'entities': entities,
            'statistics': text_processor.get_text_statistics(text)
        }
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error processing text: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/process/publication', methods=['POST'])
def process_publication():
    """Process scientific publication data"""
    try:
        # Initialize components on first request
        initialize_components()
        
        data = request.get_json()
        
        if not data or 'title' not in data:
            return jsonify({'error': 'Publication title is required'}), 400
        
        title = data['title']
        abstract = data.get('abstract', '')
        full_text = data.get('full_text', '')
        
        # Combine text for processing
        combined_text = f"{title} {abstract} {full_text}"
        
        # Language detection
        language = language_detector.detect_language(combined_text)
        
        # Extract keywords from title and abstract
        title_keywords = keyword_extractor.extract_keywords(title, language)
        abstract_keywords = keyword_extractor.extract_keywords(abstract, language)
        
        # Generate embeddings for different text parts
        title_embeddings = embedding_generator.generate_embeddings(title)
        abstract_embeddings = embedding_generator.generate_embeddings(abstract)
        full_text_embeddings = embedding_generator.generate_embeddings(full_text) if full_text else None
        
        # Sentiment analysis
        sentiment = sentiment_analyzer.analyze_sentiment(abstract)
        
        # Extract entities
        entities = text_processor.extract_entities(combined_text, language)
        
        # Topic modeling
        topics = topic_modeler.predict_topics(combined_text)
        
        result = {
            'title': title,
            'language': language,
            'keywords': {
                'title': title_keywords,
                'abstract': abstract_keywords,
                'combined': keyword_extractor.extract_keywords(combined_text, language)
            },
            'sentiment': sentiment,
            'entities': entities,
            'topics': topics,
            'embeddings': {
                'title': title_embeddings.tolist() if title_embeddings is not None else None,
                'abstract': abstract_embeddings.tolist() if abstract_embeddings is not None else None,
                'full_text': full_text_embeddings.tolist() if full_text_embeddings is not None else None
            },
            'statistics': text_processor.get_text_statistics(combined_text)
        }
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error processing publication: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/analyze/citations', methods=['POST'])
def analyze_citations():
    """Analyze citation relationships"""
    try:
        # Initialize components on first request
        initialize_components()
        
        data = request.get_json()
        
        if not data or 'citing_text' not in data or 'cited_text' not in data:
            return jsonify({'error': 'Both citing and cited texts are required'}), 400
        
        citing_text = data['citing_text']
        cited_text = data['cited_text']
        
        # Analyze citation context
        citation_analysis = citation_analyzer.analyze_citation(citing_text, cited_text)
        
        # Generate similarity scores
        similarity_score = citation_analyzer.calculate_similarity(citing_text, cited_text)
        
        # Extract citation type
        citation_type = citation_analyzer.classify_citation_type(citing_text)
        
        result = {
            'citation_analysis': citation_analysis,
            'similarity_score': similarity_score,
            'citation_type': citation_type,
            'sentiment': sentiment_analyzer.analyze_sentiment(citing_text)
        }
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error analyzing citations: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/model/topics', methods=['POST'])
def model_topics():
    """Perform topic modeling on a collection of documents"""
    try:
        # Initialize components on first request
        initialize_components()
        
        data = request.get_json()
        
        if not data or 'documents' not in data:
            return jsonify({'error': 'Documents array is required'}), 400
        
        documents = data['documents']
        num_topics = data.get('num_topics', 10)
        algorithm = data.get('algorithm', 'lda')
        
        # Perform topic modeling
        topics = topic_modeler.fit_topics(documents, num_topics, algorithm)
        
        # Get topic coherence scores
        coherence_scores = topic_modeler.calculate_coherence(topics, documents)
        
        result = {
            'topics': topics,
            'coherence_scores': coherence_scores,
            'algorithm': algorithm,
            'num_topics': num_topics,
            'document_count': len(documents)
        }
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in topic modeling: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/embeddings/generate', methods=['POST'])
def generate_embeddings():
    """Generate embeddings for text"""
    try:
        # Initialize components on first request
        initialize_components()
        
        data = request.get_json()
        
        if not data or 'texts' not in data:
            return jsonify({'error': 'Texts array is required'}), 400
        
        texts = data['texts']
        model_name = data.get('model', 'sentence-transformers/all-MiniLM-L6-v2')
        
        # Generate embeddings
        embeddings = embedding_generator.generate_batch_embeddings(texts, model_name)
        
        result = {
            'embeddings': [emb.tolist() if emb is not None else None for emb in embeddings],
            'model': model_name,
            'count': len(texts),
            'dimension': embeddings[0].shape[0] if embeddings and embeddings[0] is not None else None
        }
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error generating embeddings: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/keywords/extract', methods=['POST'])
def extract_keywords():
    """Extract keywords from text"""
    try:
        # Initialize components on first request
        initialize_components()
        
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'error': 'Text is required'}), 400
        
        text = data['text']
        language = data.get('language', 'auto')
        method = data.get('method', 'yake')
        max_keywords = data.get('max_keywords', 20)
        
        # Detect language if auto
        if language == 'auto':
            language = language_detector.detect_language(text)
        
        # Extract keywords
        keywords = keyword_extractor.extract_keywords(
            text, 
            language, 
            method=method, 
            max_keywords=max_keywords
        )
        
        result = {
            'keywords': keywords,
            'language': language,
            'method': method,
            'text_length': len(text)
        }
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error extracting keywords: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/sentiment/analyze', methods=['POST'])
def analyze_sentiment():
    """Analyze sentiment of text"""
    try:
        # Initialize components on first request
        initialize_components()
        
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'error': 'Text is required'}), 400
        
        text = data['text']
        language = data.get('language', 'auto')
        
        # Detect language if auto
        if language == 'auto':
            language = language_detector.detect_language(text)
        
        # Analyze sentiment
        sentiment = sentiment_analyzer.analyze_sentiment(text, language)
        
        result = {
            'sentiment': sentiment,
            'language': language,
            'text_length': len(text)
        }
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error analyzing sentiment: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/language/detect', methods=['POST'])
def detect_language():
    """Detect language of text"""
    try:
        # Initialize components on first request
        initialize_components()
        
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'error': 'Text is required'}), 400
        
        text = data['text']
        
        # Detect language
        language = language_detector.detect_language(text)
        confidence = language_detector.get_confidence(text)
        
        result = {
            'language': language,
            'confidence': confidence,
            'text_length': len(text)
        }
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error detecting language: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/document/parse', methods=['POST'])
def parse_document():
    """Parse document from uploaded file or text"""
    try:
        # Initialize components on first request
        initialize_components()
        
        # Handle file upload
        if 'file' in request.files:
            file = request.files['file']
            if file.filename == '':
                return jsonify({'error': 'No file selected'}), 400
            
            # Parse document
            content = document_parser.parse_file(file)
        else:
            # Handle text input
            data = request.get_json()
            if not data or 'content' not in data:
                return jsonify({'error': 'File or content is required'}), 400
            
            content = document_parser.parse_text(data['content'], data.get('file_type', 'txt'))
        
        return jsonify(content)
        
    except Exception as e:
        logger.error(f"Error parsing document: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/batch/process', methods=['POST'])
def batch_process():
    """Process multiple documents in batch"""
    try:
        # Initialize components on first request
        initialize_components()
        
        data = request.get_json()
        
        if not data or 'documents' not in data:
            return jsonify({'error': 'Documents array is required'}), 400
        
        documents = data['documents']
        options = data.get('options', {})
        
        results = []
        
        for i, doc in enumerate(documents):
            try:
                # Process each document
                result = process_single_document(doc, options)
                results.append({
                    'index': i,
                    'status': 'success',
                    'result': result
                })
            except Exception as e:
                results.append({
                    'index': i,
                    'status': 'error',
                    'error': str(e)
                })
        
        return jsonify({
            'results': results,
            'total_documents': len(documents),
            'successful': sum(1 for r in results if r['status'] == 'success'),
            'failed': sum(1 for r in results if r['status'] == 'error')
        })
        
    except Exception as e:
        logger.error(f"Error in batch processing: {str(e)}")
        return jsonify({'error': str(e)}), 500

def process_single_document(doc: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
    """Process a single document"""
    text = doc.get('text', '')
    title = doc.get('title', '')
    
    if not text and not title:
        raise ValueError('Document must have text or title')
    
    combined_text = f"{title} {text}"
    
    # Language detection
    language = language_detector.detect_language(combined_text)
    
    # Extract keywords
    keywords = keyword_extractor.extract_keywords(combined_text, language)
    
    # Generate embeddings
    embeddings = embedding_generator.generate_embeddings(combined_text)
    
    # Sentiment analysis
    sentiment = sentiment_analyzer.analyze_sentiment(combined_text)
    
    # Extract entities
    entities = text_processor.extract_entities(combined_text, language)
    
    return {
        'title': title,
        'language': language,
        'keywords': keywords,
        'sentiment': sentiment,
        'embeddings': embeddings.tolist() if embeddings is not None else None,
        'entities': entities,
        'statistics': text_processor.get_text_statistics(combined_text)
    }

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting NLP Service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
