import spacy
import nltk
import re
import string
from typing import List, Dict, Any, Optional
from collections import Counter
import logging

logger = logging.getLogger(__name__)

class TextProcessor:
    def __init__(self):
        """Initialize text processor with NLP models"""
        try:
            # Load spaCy models
            self.nlp_en = spacy.load("en_core_web_sm")
            self.nlp_models = {'en': self.nlp_en}
            
            # Try to load additional language models if available
            try:
                self.nlp_models['de'] = spacy.load("de_core_news_sm")
            except OSError:
                logger.warning("German spaCy model not available")
            
            try:
                self.nlp_models['fr'] = spacy.load("fr_core_news_sm")
            except OSError:
                logger.warning("French spaCy model not available")
            
            # Download NLTK data if needed
            nltk.download('punkt', quiet=True)
            nltk.download('stopwords', quiet=True)
            nltk.download('wordnet', quiet=True)
            nltk.download('averaged_perceptron_tagger', quiet=True)
            
            logger.info("Text processor initialized successfully")
            
        except Exception as e:
            logger.error(f"Error initializing text processor: {str(e)}")
            raise
    
    def preprocess(self, text: str, language: str = 'en') -> str:
        """Preprocess text for analysis"""
        try:
            if not text or not text.strip():
                return ""
            
            # Get appropriate NLP model
            nlp = self.nlp_models.get(language, self.nlp_en)
            
            # Process with spaCy
            doc = nlp(text)
            
            # Extract tokens, filter out stopwords and punctuation
            tokens = []
            for token in doc:
                if (not token.is_stop and 
                    not token.is_punct and 
                    not token.is_space and 
                    len(token.text.strip()) > 2):
                    tokens.append(token.lemma_.lower())
            
            return ' '.join(tokens)
            
        except Exception as e:
            logger.error(f"Error preprocessing text: {str(e)}")
            return text.lower()
    
    def extract_entities(self, text: str, language: str = 'en') -> List[Dict[str, Any]]:
        """Extract named entities from text"""
        try:
            if not text or not text.strip():
                return []
            
            nlp = self.nlp_models.get(language, self.nlp_en)
            doc = nlp(text)
            
            entities = []
            for ent in doc.ents:
                entities.append({
                    'text': ent.text,
                    'label': ent.label_,
                    'start': ent.start_char,
                    'end': ent.end_char,
                    'confidence': 1.0  # spaCy doesn't provide confidence by default
                })
            
            return entities
            
        except Exception as e:
            logger.error(f"Error extracting entities: {str(e)}")
            return []
    
    def extract_sentences(self, text: str, language: str = 'en') -> List[str]:
        """Extract sentences from text"""
        try:
            if not text or not text.strip():
                return []
            
            nlp = self.nlp_models.get(language, self.nlp_en)
            doc = nlp(text)
            
            return [sent.text.strip() for sent in doc.sents if sent.text.strip()]
            
        except Exception as e:
            logger.error(f"Error extracting sentences: {str(e)}")
            # Fallback to simple sentence splitting
            return re.split(r'[.!?]+', text)
    
    def extract_phrases(self, text: str, language: str = 'en') -> List[str]:
        """Extract noun phrases from text"""
        try:
            if not text or not text.strip():
                return []
            
            nlp = self.nlp_models.get(language, self.nlp_en)
            doc = nlp(text)
            
            phrases = []
            for chunk in doc.noun_chunks:
                phrase = chunk.text.strip()
                if len(phrase.split()) > 1:  # Only multi-word phrases
                    phrases.append(phrase)
            
            return phrases
            
        except Exception as e:
            logger.error(f"Error extracting phrases: {str(e)}")
            return []
    
    def get_text_statistics(self, text: str) -> Dict[str, Any]:
        """Get basic statistics about the text"""
        try:
            if not text:
                return {
                    'char_count': 0,
                    'word_count': 0,
                    'sentence_count': 0,
                    'paragraph_count': 0,
                    'avg_word_length': 0,
                    'avg_sentence_length': 0
                }
            
            # Basic counts
            char_count = len(text)
            words = text.split()
            word_count = len(words)
            
            # Sentence count
            sentences = re.split(r'[.!?]+', text)
            sentence_count = len([s for s in sentences if s.strip()])
            
            # Paragraph count
            paragraphs = text.split('\n\n')
            paragraph_count = len([p for p in paragraphs if p.strip()])
            
            # Average calculations
            avg_word_length = sum(len(word) for word in words) / word_count if word_count > 0 else 0
            avg_sentence_length = word_count / sentence_count if sentence_count > 0 else 0
            
            return {
                'char_count': char_count,
                'word_count': word_count,
                'sentence_count': sentence_count,
                'paragraph_count': paragraph_count,
                'avg_word_length': round(avg_word_length, 2),
                'avg_sentence_length': round(avg_sentence_length, 2)
            }
            
        except Exception as e:
            logger.error(f"Error calculating text statistics: {str(e)}")
            return {}
    
    def clean_text(self, text: str) -> str:
        """Clean text by removing special characters and normalizing"""
        try:
            if not text:
                return ""
            
            # Remove extra whitespace
            text = re.sub(r'\s+', ' ', text)
            
            # Remove special characters but keep basic punctuation
            text = re.sub(r'[^\w\s\.\,\!\?\;\:\-\(\)\[\]\{\}\"\'\/\\]', '', text)
            
            # Normalize quotes
            text = re.sub(r'["""]', '"', text)
            text = re.sub(r'['']', "'", text)
            
            # Remove extra spaces around punctuation
            text = re.sub(r'\s+([.,!?;:])', r'\1', text)
            
            return text.strip()
            
        except Exception as e:
            logger.error(f"Error cleaning text: {str(e)}")
            return text
    
    def tokenize(self, text: str, language: str = 'en') -> List[str]:
        """Tokenize text into words"""
        try:
            if not text:
                return []
            
            nlp = self.nlp_models.get(language, self.nlp_en)
            doc = nlp(text)
            
            return [token.text for token in doc if not token.is_space]
            
        except Exception as e:
            logger.error(f"Error tokenizing text: {str(e)}")
            return text.split()
    
    def remove_stopwords(self, tokens: List[str], language: str = 'en') -> List[str]:
        """Remove stopwords from token list"""
        try:
            if not tokens:
                return []
            
            nlp = self.nlp_models.get(language, self.nlp_en)
            
            filtered_tokens = []
            for token in tokens:
                doc = nlp(token)
                if not doc[0].is_stop:
                    filtered_tokens.append(token)
            
            return filtered_tokens
            
        except Exception as e:
            logger.error(f"Error removing stopwords: {str(e)}")
            return tokens
    
    def lemmatize(self, tokens: List[str], language: str = 'en') -> List[str]:
        """Lemmatize tokens"""
        try:
            if not tokens:
                return []
            
            nlp = self.nlp_models.get(language, self.nlp_en)
            
            lemmatized_tokens = []
            for token in tokens:
                doc = nlp(token)
                lemmatized_tokens.append(doc[0].lemma_)
            
            return lemmatized_tokens
            
        except Exception as e:
            logger.error(f"Error lemmatizing tokens: {str(e)}")
            return tokens
    
    def extract_pos_tags(self, text: str, language: str = 'en') -> List[Dict[str, str]]:
        """Extract part-of-speech tags"""
        try:
            if not text:
                return []
            
            nlp = self.nlp_models.get(language, self.nlp_en)
            doc = nlp(text)
            
            pos_tags = []
            for token in doc:
                pos_tags.append({
                    'text': token.text,
                    'pos': token.pos_,
                    'tag': token.tag_,
                    'lemma': token.lemma_
                })
            
            return pos_tags
            
        except Exception as e:
            logger.error(f"Error extracting POS tags: {str(e)}")
            return []
    
    def calculate_readability(self, text: str, language: str = 'en') -> Dict[str, float]:
        """Calculate readability scores"""
        try:
            if not text:
                return {'flesch_reading_ease': 0, 'flesch_kincaid_grade': 0}
            
            # Basic statistics
            sentences = re.split(r'[.!?]+', text)
            sentence_count = len([s for s in sentences if s.strip()])
            words = text.split()
            word_count = len(words)
            
            if sentence_count == 0 or word_count == 0:
                return {'flesch_reading_ease': 0, 'flesch_kincaid_grade': 0}
            
            # Count syllables (simplified)
            syllable_count = sum(self._count_syllables(word) for word in words)
            
            # Flesch Reading Ease
            avg_sentence_length = word_count / sentence_count
            avg_syllables_per_word = syllable_count / word_count
            
            flesch_reading_ease = 206.835 - (1.015 * avg_sentence_length) - (84.6 * avg_syllables_per_word)
            
            # Flesch-Kincaid Grade Level
            flesch_kincaid_grade = (0.39 * avg_sentence_length) + (11.8 * avg_syllables_per_word) - 15.59
            
            return {
                'flesch_reading_ease': round(flesch_reading_ease, 2),
                'flesch_kincaid_grade': round(flesch_kincaid_grade, 2)
            }
            
        except Exception as e:
            logger.error(f"Error calculating readability: {str(e)}")
            return {'flesch_reading_ease': 0, 'flesch_kincaid_grade': 0}
    
    def _count_syllables(self, word: str) -> int:
        """Count syllables in a word (simplified)"""
        word = word.lower()
        vowels = "aeiouy"
        syllable_count = 0
        prev_char_was_vowel = False
        
        for char in word:
            is_vowel = char in vowels
            if is_vowel and not prev_char_was_vowel:
                syllable_count += 1
            prev_char_was_vowel = is_vowel
        
        # Handle silent 'e'
        if word.endswith('e') and syllable_count > 1:
            syllable_count -= 1
        
        return max(1, syllable_count)
    
    def extract_key_phrases(self, text: str, language: str = 'en', max_phrases: int = 10) -> List[Dict[str, Any]]:
        """Extract key phrases using various methods"""
        try:
            if not text:
                return []
            
            nlp = self.nlp_models.get(language, self.nlp_en)
            doc = nlp(text)
            
            # Extract noun chunks
            noun_chunks = []
            for chunk in doc.noun_chunks:
                if len(chunk.text.split()) >= 2:  # Multi-word phrases
                    noun_chunks.append({
                        'phrase': chunk.text.strip(),
                        'type': 'noun_chunk',
                        'count': 1
                    })
            
            # Count phrase frequencies
            phrase_freq = Counter(chunk['phrase'] for chunk in noun_chunks)
            
            # Create unique phrases with frequencies
            unique_phrases = []
            seen = set()
            
            for chunk in noun_chunks:
                phrase = chunk['phrase']
                if phrase not in seen:
                    unique_phrases.append({
                        'phrase': phrase,
                        'type': chunk['type'],
                        'frequency': phrase_freq[phrase]
                    })
                    seen.add(phrase)
            
            # Sort by frequency and limit
            unique_phrases.sort(key=lambda x: x['frequency'], reverse=True)
            
            return unique_phrases[:max_phrases]
            
        except Exception as e:
            logger.error(f"Error extracting key phrases: {str(e)}")
            return []
