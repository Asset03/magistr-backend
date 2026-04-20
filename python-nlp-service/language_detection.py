import re
from typing import Dict, List, Optional, Tuple
import logging
from langdetect import detect, detect_langs
from langdetect.lang_detect_exception import LangDetectException
import numpy as np

logger = logging.getLogger(__name__)

class LanguageDetector:
    def __init__(self):
        """Initialize language detector"""
        try:
            # Common language patterns for regex-based detection
            self.language_patterns = {
                'en': {
                    'common_words': ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'with'],
                    'patterns': [r'\b(the|and|is|in|to|of|a|that|it|with|for|on|are|as|be|at|this|have|from)\b'],
                    'unicode_ranges': ['\u0000-\u007F']  # Basic Latin
                },
                'es': {
                    'common_words': ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se'],
                    'patterns': [r'\b(el|la|de|que|y|a|en|un|es|se|no|te|lo|le|da|su|por|son)\b'],
                    'unicode_ranges': ['\u0000-\u007F', '\u00C0-\u00FF']  # Latin + Spanish
                },
                'fr': {
                    'common_words': ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir'],
                    'patterns': [r'\b(le|de|et|à|un|il|être|en|avoir|que|pour|dans|ce|son|une|sur)\b'],
                    'unicode_ranges': ['\u0000-\u007F', '\u00C0-\u00FF']  # Latin + French
                },
                'de': {
                    'common_words': ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich'],
                    'patterns': [r'\b(der|die|und|in|den|von|zu|das|mit|sich|des|auf|für|ist|im|dem)\b'],
                    'unicode_ranges': ['\u0000-\u007F', '\u0080-\u00FF']  # Latin + German
                },
                'pt': {
                    'common_words': ['o', 'de', 'a', 'e', 'do', 'da', 'em', 'um', 'para', 'é'],
                    'patterns': [r'\b(o|de|a|e|do|da|em|um|para|é|com|não|uma|os|no|se)\b'],
                    'unicode_ranges': ['\u0000-\u007F', '\u00C0-\u00FF']  # Latin + Portuguese
                },
                'it': {
                    'common_words': ['il', 'di', 'che', 'e', 'la', 'un', 'a', 'per', 'non', 'in'],
                    'patterns': [r'\b(il|di|che|e|la|un|a|per|non|in|una|si|del|da|sono|con)\b'],
                    'unicode_ranges': ['\u0000-\u007F', '\u00C0-\u00FF']  # Latin + Italian
                },
                'ru': {
                    'common_words': ['и', 'в', 'не', 'на', 'я', 'быть', 'то', 'он', 'с', 'что'],
                    'patterns': [r'\b(и|в|не|на|я|быть|то|он|с|что|а|по|это|как|вы|для)\b'],
                    'unicode_ranges': ['\u0400-\u04FF']  # Cyrillic
                },
                'zh': {
                    'common_words': ['的', '是', '在', '了', '和', '有', '我', '他', '她', '它'],
                    'patterns': [r'[的是在了有我他她它们这个那个]'],  # Simplified Chinese
                    'unicode_ranges': ['\u4E00-\u9FFF']  # CJK Unified Ideographs
                },
                'ja': {
                    'common_words': ['の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し'],
                    'patterns': [r'[のはをたがでとしれさあな]'],  # Japanese hiragana/katakana
                    'unicode_ranges': ['\u3040-\u309F', '\u30A0-\u30FF', '\u4E00-\u9FFF']  # Hiragana, Katakana, Kanji
                },
                'ar': {
                    'common_words': ['في', 'من', 'إلى', 'على', 'هذا', 'هذه', 'التي', 'الذي', 'كان', 'كانت'],
                    'patterns': [r'[فيمنإلىعلىهذهذاتيالذيكانكانت]'],  # Arabic
                    'unicode_ranges': ['\u0600-\u06FF']  # Arabic
                }
            }
            
            # Language names mapping
            self.language_names = {
                'en': 'English',
                'es': 'Spanish',
                'fr': 'French',
                'de': 'German',
                'pt': 'Portuguese',
                'it': 'Italian',
                'ru': 'Russian',
                'zh': 'Chinese',
                'ja': 'Japanese',
                'ar': 'Arabic'
            }
            
            logger.info("Language detector initialized successfully")
            
        except Exception as e:
            logger.error(f"Error initializing language detector: {str(e)}")
            raise
    
    def detect_language(self, text: str) -> str:
        """Detect the primary language of the text"""
        try:
            if not text or not text.strip():
                return 'unknown'
            
            # Clean text
            text = self._clean_text(text)
            
            if len(text) < 10:
                return 'unknown'
            
            # Try langdetect first (more accurate)
            try:
                detected = detect(text)
                if detected in self.language_names:
                    return detected
            except LangDetectException:
                pass
            
            # Fallback to pattern-based detection
            return self._detect_by_patterns(text)
            
        except Exception as e:
            logger.error(f"Error detecting language: {str(e)}")
            return 'unknown'
    
    def get_confidence(self, text: str) -> float:
        """Get confidence score for language detection"""
        try:
            if not text or not text.strip():
                return 0.0
            
            text = self._clean_text(text)
            
            if len(text) < 10:
                return 0.0
            
            # Use langdetect for confidence scores
            try:
                langs = detect_langs(text)
                if langs:
                    return round(langs[0].prob, 3)
            except LangDetectException:
                pass
            
            # Fallback to pattern-based confidence
            return self._calculate_pattern_confidence(text)
            
        except Exception as e:
            logger.error(f"Error getting confidence: {str(e)}")
            return 0.0
    
    def detect_multiple_languages(self, text: str, threshold: float = 0.1) -> List[Dict[str, float]]:
        """Detect multiple languages in the text with probabilities"""
        try:
            if not text or not text.strip():
                return []
            
            text = self._clean_text(text)
            
            if len(text) < 50:
                return []
            
            # Use langdetect for multiple languages
            try:
                langs = detect_langs(text)
                results = []
                
                for lang in langs:
                    if lang.prob >= threshold and lang.lang in self.language_names:
                        results.append({
                            'language': lang.lang,
                            'language_name': self.language_names[lang.lang],
                            'confidence': round(lang.prob, 3)
                        })
                
                return results
                
            except LangDetectException:
                # Fallback to pattern-based detection
                return self._detect_multiple_by_patterns(text)
            
        except Exception as e:
            logger.error(f"Error detecting multiple languages: {str(e)}")
            return []
    
    def _clean_text(self, text: str) -> str:
        """Clean text for language detection"""
        # Remove URLs, emails, numbers, and special characters
        text = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', '', text)
        text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '', text)
        text = re.sub(r'\d+', '', text)
        text = re.sub(r'[^\w\s]', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        
        return text.strip()
    
    def _detect_by_patterns(self, text: str) -> str:
        """Detect language using regex patterns"""
        scores = {}
        
        for lang_code, patterns in self.language_patterns.items():
            score = 0
            
            # Check common words
            common_word_count = 0
            words = text.lower().split()
            for word in words:
                if word in patterns['common_words']:
                    common_word_count += 1
            
            # Normalize by text length
            if len(words) > 0:
                score += common_word_count / len(words)
            
            # Check regex patterns
            for pattern in patterns.get('patterns', []):
                matches = len(re.findall(pattern, text.lower()))
                score += matches * 0.1
            
            # Check Unicode ranges
            text_chars = set(text)
            for unicode_range in patterns.get('unicode_ranges', []):
                range_chars = set()
                for char_code in range(ord(unicode_range.split('-')[0]), ord(unicode_range.split('-')[1]) + 1):
                    range_chars.add(chr(char_code))
                
                overlap = len(text_chars & range_chars)
                if overlap > 0:
                    score += overlap / len(text_chars)
            
            scores[lang_code] = score
        
        # Return language with highest score
        if scores:
            best_lang = max(scores, key=scores.get)
            if scores[best_lang] > 0.1:  # Minimum threshold
                return best_lang
        
        return 'unknown'
    
    def _calculate_pattern_confidence(self, text: str) -> float:
        """Calculate confidence based on pattern matching"""
        scores = []
        
        for lang_code, patterns in self.language_patterns.items():
            score = 0
            
            # Common words score
            words = text.lower().split()
            common_word_count = sum(1 for word in words if word in patterns['common_words'])
            if len(words) > 0:
                score += common_word_count / len(words)
            
            # Pattern matching score
            for pattern in patterns.get('patterns', []):
                matches = len(re.findall(pattern, text.lower()))
                score += matches * 0.1
            
            scores.append(score)
        
        # Return normalized confidence
        max_score = max(scores) if scores else 0
        return round(min(1.0, max_score), 3)
    
    def _detect_multiple_by_patterns(self, text: str) -> List[Dict[str, float]]:
        """Detect multiple languages using patterns"""
        scores = {}
        total_score = 0
        
        for lang_code, patterns in self.language_patterns.items():
            score = 0
            
            # Common words score
            words = text.lower().split()
            common_word_count = sum(1 for word in words if word in patterns['common_words'])
            if len(words) > 0:
                score += common_word_count / len(words)
            
            # Pattern matching score
            for pattern in patterns.get('patterns', []):
                matches = len(re.findall(pattern, text.lower()))
                score += matches * 0.1
            
            scores[lang_code] = score
            total_score += score
        
        # Normalize scores
        results = []
        for lang_code, score in scores.items():
            if total_score > 0 and score > 0:
                confidence = score / total_score
                if confidence > 0.1:  # Minimum threshold
                    results.append({
                        'language': lang_code,
                        'language_name': self.language_names.get(lang_code, lang_code),
                        'confidence': round(confidence, 3)
                    })
        
        # Sort by confidence
        results.sort(key=lambda x: x['confidence'], reverse=True)
        
        return results
    
    def is_supported_language(self, language_code: str) -> bool:
        """Check if a language is supported"""
        return language_code in self.language_names
    
    def get_supported_languages(self) -> List[Dict[str, str]]:
        """Get list of supported languages"""
        return [
            {'code': code, 'name': name}
            for code, name in self.language_names.items()
        ]
    
    def get_language_name(self, language_code: str) -> str:
        """Get language name from code"""
        return self.language_names.get(language_code, language_code)
    
    def analyze_text_statistics(self, text: str, language: str = None) -> Dict[str, any]:
        """Analyze text statistics for a specific language"""
        try:
            if not text:
                return {}
            
            # Detect language if not provided
            if not language:
                language = self.detect_language(text)
            
            # Basic statistics
            char_count = len(text)
            word_count = len(text.split())
            sentence_count = len(re.split(r'[.!?]+', text))
            
            # Language-specific statistics
            lang_stats = {}
            if language in self.language_patterns:
                patterns = self.language_patterns[language]
                
                # Count common words
                words = text.lower().split()
                common_word_count = sum(1 for word in words if word in patterns['common_words'])
                
                # Count pattern matches
                pattern_matches = 0
                for pattern in patterns.get('patterns', []):
                    pattern_matches += len(re.findall(pattern, text.lower()))
                
                lang_stats = {
                    'common_word_count': common_word_count,
                    'common_word_ratio': common_word_count / len(words) if words else 0,
                    'pattern_matches': pattern_matches,
                    'language_confidence': self.get_confidence(text)
                }
            
            return {
                'language': language,
                'language_name': self.language_names.get(language, language),
                'char_count': char_count,
                'word_count': word_count,
                'sentence_count': sentence_count,
                'avg_word_length': sum(len(word) for word in text.split()) / word_count if word_count > 0 else 0,
                'language_specific': lang_stats
            }
            
        except Exception as e:
            logger.error(f"Error analyzing text statistics: {str(e)}")
            return {}
