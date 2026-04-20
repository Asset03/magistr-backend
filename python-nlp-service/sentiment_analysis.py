import re
from typing import Dict, List, Optional, Tuple
import logging
import numpy as np
from textblob import TextBlob
import spacy

logger = logging.getLogger(__name__)

class SentimentAnalyzer:
    def __init__(self):
        """Initialize sentiment analyzer"""
        try:
            # Load spaCy model
            self.nlp = spacy.load("en_core_web_sm")
            
            # Sentiment lexicons
            self.positive_words = {
                # Strong positive
                'excellent', 'outstanding', 'amazing', 'fantastic', 'wonderful', 'perfect', 'brilliant',
                'superb', 'magnificent', 'exceptional', 'remarkable', 'spectacular', 'incredible',
                # Moderate positive
                'good', 'great', 'nice', 'positive', 'beneficial', 'effective', 'successful',
                'valuable', 'useful', 'helpful', 'important', 'significant', 'promising',
                # Weak positive
                'adequate', 'acceptable', 'reasonable', 'satisfactory', 'decent', 'fine',
                'okay', 'fair', 'sufficient', 'tolerable', 'passable'
            }
            
            self.negative_words = {
                # Strong negative
                'terrible', 'awful', 'horrible', 'disgusting', 'disastrous', 'catastrophic',
                'devastating', 'appalling', 'dreadful', 'atrocious', 'abysmal', 'pathetic',
                # Moderate negative
                'bad', 'poor', 'weak', 'negative', 'harmful', 'ineffective', 'unsuccessful',
                'problematic', 'difficult', 'challenging', 'concerning', 'troubling',
                # Weak negative
                'inadequate', 'insufficient', 'limited', 'flawed', 'imperfect', 'suboptimal',
                'questionable', 'doubtful', 'uncertain', 'unclear', 'disappointing'
            }
            
            # Intensity modifiers
            self.intensifiers = {
                'very': 1.5, 'extremely': 2.0, 'highly': 1.8, 'particularly': 1.6,
                'especially': 1.7, 'incredibly': 2.0, 'absolutely': 2.0, 'completely': 1.9,
                'totally': 1.8, 'really': 1.4, 'quite': 1.3, 'rather': 1.2,
                'somewhat': 0.8, 'slightly': 0.7, 'barely': 0.6, 'hardly': 0.5
            }
            
            # Negation words
            self.negations = {
                'not', 'no', 'never', 'none', 'nothing', 'neither', 'nowhere', 'hardly',
                'rarely', 'seldom', 'scarcely', 'barely', 'cannot', "can't", "won't",
                "don't", "didn't", "doesn't", "isn't", "aren't", "wasn't", "weren't"
            }
            
            # Domain-specific scientific sentiment words
            self.scientific_positive = {
                'novel', 'innovative', 'breakthrough', 'significant', 'robust', 'reliable',
                'validated', 'confirmed', 'demonstrated', 'proven', 'established',
                'effective', 'efficient', 'optimal', 'superior', 'enhanced', 'improved'
            }
            
            self.scientific_negative = {
                'limited', 'insufficient', 'inadequate', 'flawed', 'biased', 'inconsistent',
                'unreliable', 'invalid', 'failed', 'unsuccessful', 'problematic', 'questionable',
                'controversial', 'disputed', 'refuted', 'contradicted', 'inconclusive'
            }
            
            logger.info("Sentiment analyzer initialized successfully")
            
        except Exception as e:
            logger.error(f"Error initializing sentiment analyzer: {str(e)}")
            raise
    
    def analyze_sentiment(self, text: str, language: str = 'en', method: str = 'hybrid') -> Dict[str, float]:
        """Analyze sentiment of text"""
        try:
            if not text or not text.strip():
                return {'positive': 0.33, 'negative': 0.33, 'neutral': 0.34}
            
            text = text.strip()
            
            if method == 'textblob':
                return self._analyze_with_textblob(text)
            elif method == 'lexicon':
                return self._analyze_with_lexicon(text)
            elif method == 'hybrid':
                return self._analyze_hybrid(text)
            else:
                return self._analyze_hybrid(text)
                
        except Exception as e:
            logger.error(f"Error analyzing sentiment: {str(e)}")
            return {'positive': 0.33, 'negative': 0.33, 'neutral': 0.34}
    
    def _analyze_with_textblob(self, text: str) -> Dict[str, float]:
        """Analyze sentiment using TextBlob"""
        try:
            blob = TextBlob(text)
            polarity = blob.sentiment.polarity
            
            # Convert polarity to positive/negative/neutral
            if polarity > 0.1:
                positive = min(1.0, polarity + 0.5)
                negative = max(0.0, 0.5 - polarity)
                neutral = 1.0 - positive - negative
            elif polarity < -0.1:
                negative = min(1.0, abs(polarity) + 0.5)
                positive = max(0.0, 0.5 - abs(polarity))
                neutral = 1.0 - positive - negative
            else:
                positive = negative = 0.33
                neutral = 0.34
            
            return {
                'positive': round(positive, 3),
                'negative': round(negative, 3),
                'neutral': round(neutral, 3),
                'polarity': round(polarity, 3),
                'subjectivity': round(blob.sentiment.subjectivity, 3)
            }
            
        except Exception as e:
            logger.error(f"Error in TextBlob analysis: {str(e)}")
            return {'positive': 0.33, 'negative': 0.33, 'neutral': 0.34}
    
    def _analyze_with_lexicon(self, text: str) -> Dict[str, float]:
        """Analyze sentiment using custom lexicon"""
        try:
            # Process text with spaCy
            doc = self.nlp(text.lower())
            
            positive_score = 0.0
            negative_score = 0.0
            neutral_score = 0.0
            
            # Track negation scope
            negation_active = False
            negation_scope = 0
            
            # Track intensifier
            current_intensifier = 1.0
            
            for i, token in enumerate(doc):
                if token.text in self.negations:
                    negation_active = True
                    negation_scope = 3  # Next 3 tokens are negated
                    continue
                
                if negation_scope > 0:
                    negation_scope -= 1
                else:
                    negation_active = False
                
                # Check for intensifiers
                if token.text in self.intensifiers:
                    current_intensifier = self.intensifiers[token.text]
                    continue
                
                # Skip stopwords and punctuation
                if token.is_stop or token.is_punct:
                    current_intensifier = 1.0
                    continue
                
                # Check sentiment words
                word_sentiment = self._get_word_sentiment(token.text)
                
                if word_sentiment > 0:
                    score = word_sentiment * current_intensifier
                    if negation_active:
                        negative_score += score
                    else:
                        positive_score += score
                elif word_sentiment < 0:
                    score = abs(word_sentiment) * current_intensifier
                    if negation_active:
                        positive_score += score
                    else:
                        negative_score += score
                else:
                    neutral_score += 1
                
                current_intensifier = 1.0
            
            # Normalize scores
            total_score = positive_score + negative_score + neutral_score
            if total_score > 0:
                positive_score /= total_score
                negative_score /= total_score
                neutral_score /= total_score
            else:
                positive_score = negative_score = neutral_score = 1/3
            
            return {
                'positive': round(positive_score, 3),
                'negative': round(negative_score, 3),
                'neutral': round(neutral_score, 3)
            }
            
        except Exception as e:
            logger.error(f"Error in lexicon analysis: {str(e)}")
            return {'positive': 0.33, 'negative': 0.33, 'neutral': 0.34}
    
    def _analyze_hybrid(self, text: str) -> Dict[str, float]:
        """Analyze sentiment using hybrid approach"""
        try:
            # Get both TextBlob and lexicon results
            textblob_result = self._analyze_with_textblob(text)
            lexicon_result = self._analyze_with_lexicon(text)
            
            # Weight the results (TextBlob is generally more reliable)
            textblob_weight = 0.6
            lexicon_weight = 0.4
            
            positive = (textblob_result['positive'] * textblob_weight + 
                       lexicon_result['positive'] * lexicon_weight)
            negative = (textblob_result['negative'] * textblob_weight + 
                       lexicon_result['negative'] * lexicon_weight)
            neutral = (textblob_result['neutral'] * textblob_weight + 
                      lexicon_result['neutral'] * lexicon_weight)
            
            # Normalize to ensure sum = 1
            total = positive + negative + neutral
            if total > 0:
                positive /= total
                negative /= total
                neutral /= total
            
            result = {
                'positive': round(positive, 3),
                'negative': round(negative, 3),
                'neutral': round(neutral, 3)
            }
            
            # Add additional metrics from TextBlob
            if 'polarity' in textblob_result:
                result['polarity'] = textblob_result['polarity']
                result['subjectivity'] = textblob_result['subjectivity']
            
            return result
            
        except Exception as e:
            logger.error(f"Error in hybrid analysis: {str(e)}")
            return {'positive': 0.33, 'negative': 0.33, 'neutral': 0.34}
    
    def _get_word_sentiment(self, word: str) -> float:
        """Get sentiment score for a single word"""
        word = word.lower()
        
        # Check scientific sentiment words first
        if word in self.scientific_positive:
            return 0.8
        elif word in self.scientific_negative:
            return -0.8
        
        # Check general sentiment words
        if word in self.positive_words:
            return 0.6
        elif word in self.negative_words:
            return -0.6
        
        return 0.0
    
    def analyze_sentence_sentiment(self, text: str) -> List[Dict[str, any]]:
        """Analyze sentiment for each sentence"""
        try:
            # Split text into sentences
            sentences = re.split(r'[.!?]+', text)
            sentences = [s.strip() for s in sentences if s.strip()]
            
            results = []
            for i, sentence in enumerate(sentences):
                sentiment = self.analyze_sentiment(sentence)
                results.append({
                    'sentence_index': i,
                    'sentence': sentence,
                    'sentiment': sentiment,
                    'length': len(sentence.split())
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Error analyzing sentence sentiment: {str(e)}")
            return []
    
    def analyze_document_sentiment(self, text: str, window_size: int = 100) -> Dict[str, any]:
        """Analyze sentiment across document with sliding window"""
        try:
            if not text:
                return {}
            
            words = text.split()
            if len(words) < window_size:
                return {
                    'overall_sentiment': self.analyze_sentiment(text),
                    'window_sentiments': []
                }
            
            # Analyze overall sentiment
            overall_sentiment = self.analyze_sentiment(text)
            
            # Analyze with sliding window
            window_sentiments = []
            for i in range(0, len(words) - window_size + 1, window_size // 2):
                window_words = words[i:i + window_size]
                window_text = ' '.join(window_words)
                window_sentiment = self.analyze_sentiment(window_text)
                
                window_sentiments.append({
                    'start_word': i,
                    'end_word': i + window_size,
                    'sentiment': window_sentiment
                })
            
            return {
                'overall_sentiment': overall_sentiment,
                'window_sentiments': window_sentiments,
                'sentiment_variance': self._calculate_sentiment_variance(window_sentiments)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing document sentiment: {str(e)}")
            return {}
    
    def _calculate_sentiment_variance(self, window_sentiments: List[Dict]) -> float:
        """Calculate variance in sentiment across windows"""
        try:
            if not window_sentiments:
                return 0.0
            
            positive_scores = [w['sentiment']['positive'] for w in window_sentiments]
            negative_scores = [w['sentiment']['negative'] for w in window_sentiments]
            
            positive_variance = np.var(positive_scores) if positive_scores else 0
            negative_variance = np.var(negative_scores) if negative_scores else 0
            
            return round((positive_variance + negative_variance) / 2, 3)
            
        except Exception as e:
            logger.error(f"Error calculating sentiment variance: {str(e)}")
            return 0.0
    
    def compare_sentiment(self, text1: str, text2: str) -> Dict[str, any]:
        """Compare sentiment between two texts"""
        try:
            sentiment1 = self.analyze_sentiment(text1)
            sentiment2 = self.analyze_sentiment(text2)
            
            # Calculate differences
            positive_diff = abs(sentiment1['positive'] - sentiment2['positive'])
            negative_diff = abs(sentiment1['negative'] - sentiment2['negative'])
            neutral_diff = abs(sentiment1['neutral'] - sentiment2['neutral'])
            
            # Overall sentiment difference
            overall_diff = (positive_diff + negative_diff + neutral_diff) / 3
            
            return {
                'text1_sentiment': sentiment1,
                'text2_sentiment': sentiment2,
                'differences': {
                    'positive': round(positive_diff, 3),
                    'negative': round(negative_diff, 3),
                    'neutral': round(neutral_diff, 3),
                    'overall': round(overall_diff, 3)
                },
                'similarity': round(1.0 - overall_diff, 3)
            }
            
        except Exception as e:
            logger.error(f"Error comparing sentiment: {str(e)}")
            return {}
    
    def get_emotional_indicators(self, text: str) -> Dict[str, List[str]]:
        """Extract emotional indicators from text"""
        try:
            # Emotional word categories
            emotions = {
                'joy': ['happy', 'excited', 'pleased', 'delighted', 'thrilled', 'satisfied', 'content'],
                'anger': ['angry', 'furious', 'irritated', 'frustrated', 'annoyed', 'outraged', 'enraged'],
                'fear': ['afraid', 'scared', 'terrified', 'anxious', 'worried', 'nervous', 'concerned'],
                'sadness': ['sad', 'depressed', 'disappointed', 'upset', 'grieving', 'miserable', 'unhappy'],
                'surprise': ['surprised', 'amazed', 'astonished', 'shocked', 'stunned', 'bewildered'],
                'disgust': ['disgusted', 'revolted', 'repulsed', 'sickened', 'appalled']
            }
            
            text_lower = text.lower()
            found_emotions = {}
            
            for emotion, words in emotions.items():
                found_words = []
                for word in words:
                    if word in text_lower:
                        found_words.append(word)
                if found_words:
                    found_emotions[emotion] = found_words
            
            return found_emotions
            
        except Exception as e:
            logger.error(f"Error extracting emotional indicators: {str(e)}")
            return {}
