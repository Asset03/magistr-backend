import logging
from typing import List, Dict, Any, Optional
import re
from collections import Counter
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.util import ngrams
import yake
from text_processing import TextProcessor

logger = logging.getLogger(__name__)

class KeywordExtractor:
    def __init__(self):
        """Initialize keyword extractor with multiple extraction methods"""
        try:
            self.text_processor = TextProcessor()
            
            # Download required NLTK data
            try:
                nltk.data.find('tokenizers/punkt')
            except LookupError:
                nltk.download('punkt')
            
            try:
                nltk.data.find('corpora/stopwords')
            except LookupError:
                nltk.download('stopwords')
            
            # Initialize YAKE extractor
            self.yake_extractor = yake.KeywordExtractor(
                lan="en",
                n=3,
                dedupLim=0.9,
                dedupFunc='seqm',
                windowsSize=1,
                top=20,
                features=None
            )
            
            logger.info("Keyword extractor initialized successfully")
            
        except Exception as e:
            logger.error(f"Error initializing keyword extractor: {str(e)}")
            raise

    def extract_keywords_yake(self, text: str, max_keywords: int = 20) -> List[Dict[str, Any]]:
        """Extract keywords using YAKE algorithm"""
        try:
            # Preprocess text
            cleaned_text = self.text_processor.clean_text(text)
            
            # Extract keywords using YAKE
            keywords = self.yake_extractor.extract_keywords(cleaned_text)
            
            # Convert to required format and limit results
            results = []
            for keyword, score in keywords[:max_keywords]:
                results.append({
                    'keyword': keyword,
                    'score': float(score),
                    'method': 'yake'
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Error extracting keywords with YAKE: {str(e)}")
            return []

    def extract_keywords_frequency(self, text: str, max_keywords: int = 20, 
                                 min_word_length: int = 3) -> List[Dict[str, Any]]:
        """Extract keywords based on frequency analysis"""
        try:
            # Preprocess text
            cleaned_text = self.text_processor.clean_text(text)
            
            # Tokenize and get word frequencies
            words = word_tokenize(cleaned_text.lower())
            
            # Filter stopwords and short words
            stop_words = set(stopwords.words('english'))
            filtered_words = [
                word for word in words 
                if word.isalpha() and len(word) >= min_word_length and word not in stop_words
            ]
            
            # Calculate frequencies
            word_freq = Counter(filtered_words)
            
            # Convert to required format and limit results
            results = []
            for word, freq in word_freq.most_common(max_keywords):
                results.append({
                    'keyword': word,
                    'score': float(freq),
                    'method': 'frequency'
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Error extracting keywords by frequency: {str(e)}")
            return []

    def extract_ngrams(self, text: str, n: int = 2, max_ngrams: int = 20) -> List[Dict[str, Any]]:
        """Extract n-grams as keywords"""
        try:
            # Preprocess text
            cleaned_text = self.text_processor.clean_text(text)
            
            # Tokenize
            words = word_tokenize(cleaned_text.lower())
            
            # Filter stopwords
            stop_words = set(stopwords.words('english'))
            filtered_words = [
                word for word in words 
                if word.isalpha() and word not in stop_words
            ]
            
            # Generate n-grams
            n_grams = list(ngrams(filtered_words, n))
            
            # Calculate frequencies
            ngram_freq = Counter([' '.join(ngram) for ngram in n_grams])
            
            # Convert to required format and limit results
            results = []
            for ngram, freq in ngram_freq.most_common(max_ngrams):
                results.append({
                    'keyword': ' '.join(ngram),
                    'score': float(freq),
                    'method': f'{n}-gram'
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Error extracting n-grams: {str(e)}")
            return []

    def extract_keywords_scientific(self, text: str, max_keywords: int = 20) -> List[Dict[str, Any]]:
        """Extract keywords specifically for scientific text"""
        try:
            # Preprocess text
            cleaned_text = self.text_processor.clean_text(text)
            
            # Scientific-specific patterns
            scientific_patterns = [
                r'\b[A-Z]{2,}\b',  # Acronyms
                r'\b\w+(?:-\w+)+\b',  # Hyphenated terms
                r'\b\w+(?:\s+\w+){1,2}\s+(?:analysis|method|approach|technique|algorithm|model|system|framework)\b',  # Technical phrases
            ]
            
            keywords = []
            
            # Extract using patterns
            for pattern in scientific_patterns:
                matches = re.findall(pattern, cleaned_text, re.IGNORECASE)
                for match in matches:
                    if len(match.strip()) >= 3:
                        keywords.append(match.strip().lower())
            
            # Combine with frequency-based extraction
            freq_keywords = self.extract_keywords_frequency(text, max_keywords // 2)
            
            # Add scientific keywords
            scientific_counter = Counter(keywords)
            for keyword, freq in scientific_counter.most_common(max_keywords // 2):
                freq_keywords.append({
                    'keyword': keyword,
                    'score': float(freq),
                    'method': 'scientific_pattern'
                })
            
            # Remove duplicates and sort by score
            unique_keywords = {}
            for kw in freq_keywords:
                key = kw['keyword'].lower()
                if key not in unique_keywords or kw['score'] > unique_keywords[key]['score']:
                    unique_keywords[key] = kw
            
            # Sort by score and return top results
            sorted_keywords = sorted(unique_keywords.values(), key=lambda x: x['score'], reverse=True)
            return sorted_keywords[:max_keywords]
            
        except Exception as e:
            logger.error(f"Error extracting scientific keywords: {str(e)}")
            return []

    def extract_keywords_combined(self, text: str, max_keywords: int = 20) -> List[Dict[str, Any]]:
        """Combine multiple keyword extraction methods"""
        try:
            # Extract keywords using different methods
            yake_keywords = self.extract_keywords_yake(text, max_keywords // 2)
            freq_keywords = self.extract_keywords_frequency(text, max_keywords // 2)
            scientific_keywords = self.extract_keywords_scientific(text, max_keywords // 2)
            
            # Combine all keywords
            all_keywords = yake_keywords + freq_keywords + scientific_keywords
            
            # Remove duplicates and combine scores
            unique_keywords = {}
            for kw in all_keywords:
                key = kw['keyword'].lower()
                if key not in unique_keywords:
                    unique_keywords[key] = {
                        'keyword': kw['keyword'],
                        'score': kw['score'],
                        'methods': [kw['method']],
                        'combined_score': kw['score']
                    }
                else:
                    unique_keywords[key]['methods'].append(kw['method'])
                    unique_keywords[key]['combined_score'] += kw['score']
            
            # Sort by combined score and return top results
            sorted_keywords = sorted(unique_keywords.values(), key=lambda x: x['combined_score'], reverse=True)
            
            # Format final results
            results = []
            for kw in sorted_keywords[:max_keywords]:
                results.append({
                    'keyword': kw['keyword'],
                    'score': float(kw['combined_score'] / len(kw['methods'])),
                    'methods': kw['methods']
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Error in combined keyword extraction: {str(e)}")
            return []

    def extract_keywords_from_abstract(self, abstract: str, max_keywords: int = 15) -> Dict[str, Any]:
        """Extract keywords specifically from scientific abstracts"""
        try:
            # Extract keywords using combined method
            keywords = self.extract_keywords_combined(abstract, max_keywords)
            
            # Additional analysis for abstracts
            analysis = {
                'total_keywords': len(keywords),
                'avg_score': sum(kw['score'] for kw in keywords) / len(keywords) if keywords else 0,
                'methods_used': list(set(method for kw in keywords for method in kw.get('methods', ['combined'])))
            }
            
            return {
                'keywords': keywords,
                'analysis': analysis,
                'text_length': len(abstract),
                'extraction_method': 'abstract_specialized'
            }
            
        except Exception as e:
            logger.error(f"Error extracting keywords from abstract: {str(e)}")
            return {'keywords': [], 'analysis': {}, 'error': str(e)}
