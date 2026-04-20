import numpy as np
import re
from typing import Dict, List, Any, Optional, Tuple
import logging
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import spacy

logger = logging.getLogger(__name__)

class CitationAnalyzer:
    def __init__(self):
        """Initialize citation analyzer"""
        try:
            # Load spaCy model for text processing
            self.nlp = spacy.load("en_core_web_sm")
            
            # Citation patterns
            self.citation_patterns = {
                'supporting': [
                    r'\b(supports?|confirms?|validates?|demonstrates?|shows?|proves?|establishes?)\b',
                    r'\b(in accordance with|consistent with|agrees with|in line with)\b'
                ],
                'contradicting': [
                    r'\b(contradicts?|refutes?|disproves?|challenges?|questions?|disagrees with)\b',
                    r'\b(in contrast to|opposes?|differs from|inconsistent with)\b'
                ],
                'methodology': [
                    r'\b(method|approach|technique|procedure|algorithm|framework)\b',
                    r'\b(using|based on|following|according to)\b'
                ],
                'background': [
                    r'\b(previous|earlier|prior|initial|first)\b',
                    r'\b(background|context|history|overview)\b'
                ],
                'comparison': [
                    r'\b(compares?|contrasts?|versus|vs\.|compared to|in comparison)\b',
                    r'\b(similar to|different from|unlike|like)\b'
                ]
            }
            
            # Self-citation indicators
            self.self_citation_patterns = [
                r'\b(we|our|us)\s+(previous|earlier|prior)\b',
                r'\b(our|this|the present)\s+(study|work|research|paper)\b',
                r'\b(in this work|we have|we report|we show)\b'
            ]
            
            logger.info("Citation analyzer initialized successfully")
            
        except Exception as e:
            logger.error(f"Error initializing citation analyzer: {str(e)}")
            raise
    
    def analyze_citation(self, citing_text: str, cited_text: str) -> Dict[str, Any]:
        """Analyze citation relationship between citing and cited texts"""
        try:
            if not citing_text or not cited_text:
                return {'error': 'Both citing and cited texts are required'}
            
            # Extract citation context
            citation_context = self._extract_citation_context(citing_text)
            
            # Calculate similarity
            similarity_score = self._calculate_similarity(citing_text, cited_text)
            
            # Classify citation type
            citation_type = self._classify_citation_type(citing_text)
            
            # Detect self-citation
            self_citation = self._detect_self_citation(citing_text)
            
            # Extract citation sentiment
            sentiment = self._analyze_citation_sentiment(citing_text)
            
            # Identify citation position
            position = self._identify_citation_position(citing_text)
            
            # Extract citation strength
            strength = self._calculate_citation_strength(citing_text, cited_text, similarity_score)
            
            return {
                'citation_context': citation_context,
                'similarity_score': similarity_score,
                'citation_type': citation_type,
                'self_citation': self_citation,
                'sentiment': sentiment,
                'position': position,
                'strength': strength,
                'analysis_timestamp': self._get_timestamp()
            }
            
        except Exception as e:
            logger.error(f"Error analyzing citation: {str(e)}")
            return {'error': str(e)}
    
    def _extract_citation_context(self, text: str, window_size: int = 50) -> str:
        """Extract context around citation markers"""
        try:
            # Common citation patterns
            citation_markers = [
                r'\[\d+\]',  # [1], [2], etc.
                r'\([A-Za-z]+,\s*\d{4}\)',  # (Smith, 2020)
                r'\([A-Za-z]+\s+et\s+al\.,\s*\d{4}\)',  # (Smith et al., 2020)
                r'\d{4}',  # Year references
            ]
            
            contexts = []
            
            for pattern in citation_markers:
                matches = re.finditer(pattern, text)
                for match in matches:
                    start = max(0, match.start() - window_size)
                    end = min(len(text), match.end() + window_size)
                    context = text[start:end].strip()
                    contexts.append(context)
            
            # Return the longest context or the first one
            if contexts:
                return max(contexts, key=len) if len(contexts) > 1 else contexts[0]
            
            return text[:200]  # Return first 200 chars as fallback
            
        except Exception as e:
            logger.error(f"Error extracting citation context: {str(e)}")
            return text[:200]
    
    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """Calculate semantic similarity between two texts"""
        try:
            # Use TF-IDF for similarity calculation
            vectorizer = TfidfVectorizer(
                stop_words='english',
                lowercase=True,
                ngram_range=(1, 2),
                min_df=1
            )
            
            # Fit and transform texts
            tfidf_matrix = vectorizer.fit_transform([text1, text2])
            
            # Calculate cosine similarity
            similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
            
            return float(similarity)
            
        except Exception as e:
            logger.error(f"Error calculating similarity: {str(e)}")
            return 0.0
    
    def _classify_citation_type(self, text: str) -> str:
        """Classify the type of citation"""
        try:
            text_lower = text.lower()
            scores = {}
            
            # Score each citation type
            for citation_type, patterns in self.citation_patterns.items():
                score = 0
                for pattern in patterns:
                    matches = re.findall(pattern, text_lower)
                    score += len(matches)
                scores[citation_type] = score
            
            # Return the type with highest score
            if scores:
                max_type = max(scores, key=scores.get)
                if scores[max_type] > 0:
                    return max_type
            
            return 'mentioning'  # Default type
            
        except Exception as e:
            logger.error(f"Error classifying citation type: {str(e)}")
            return 'mentioning'
    
    def _detect_self_citation(self, text: str) -> bool:
        """Detect if citation is a self-citation"""
        try:
            text_lower = text.lower()
            
            for pattern in self.self_citation_patterns:
                if re.search(pattern, text_lower):
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error detecting self-citation: {str(e)}")
            return False
    
    def _analyze_citation_sentiment(self, text: str) -> Dict[str, float]:
        """Analyze sentiment of citation text"""
        try:
            # Simple sentiment analysis using spaCy
            doc = self.nlp(text)
            
            # Positive and negative word lists (simplified)
            positive_words = {
                'excellent', 'outstanding', 'remarkable', 'significant', 'important',
                'valuable', 'useful', 'effective', 'successful', 'innovative',
                'comprehensive', 'thorough', 'rigorous', 'robust', 'strong'
            }
            
            negative_words = {
                'poor', 'weak', 'inadequate', 'insufficient', 'limited',
                'flawed', 'problematic', 'questionable', 'doubtful', 'unclear',
                'inconsistent', 'contradictory', 'failed', 'unsuccessful', 'ineffective'
            }
            
            positive_count = 0
            negative_count = 0
            
            for token in doc:
                if token.text.lower() in positive_words:
                    positive_count += 1
                elif token.text.lower() in negative_words:
                    negative_count += 1
            
            total_sentiment_words = positive_count + negative_count
            
            if total_sentiment_words == 0:
                return {'positive': 0.33, 'negative': 0.33, 'neutral': 0.34}
            
            positive_score = positive_count / total_sentiment_words
            negative_score = negative_count / total_sentiment_words
            neutral_score = 1.0 - positive_score - negative_score
            
            return {
                'positive': round(positive_score, 3),
                'negative': round(negative_score, 3),
                'neutral': round(max(0.0, neutral_score), 3)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing sentiment: {str(e)}")
            return {'positive': 0.33, 'negative': 0.33, 'neutral': 0.34}
    
    def _identify_citation_position(self, text: str) -> str:
        """Identify where citation appears in the document structure"""
        try:
            text_lower = text.lower()
            
            # Look for section indicators
            if any(indicator in text_lower for indicator in ['introduction', 'background', 'overview']):
                return 'introduction'
            elif any(indicator in text_lower for indicator in ['method', 'methodology', 'approach', 'technique']):
                return 'methodology'
            elif any(indicator in text_lower for indicator in ['result', 'finding', 'outcome']):
                return 'results'
            elif any(indicator in text_lower for indicator in ['discussion', 'analysis', 'interpretation']):
                return 'discussion'
            elif any(indicator in text_lower for indicator in ['conclusion', 'summary', 'final']):
                return 'conclusion'
            else:
                return 'references'  # Default
                
        except Exception as e:
            logger.error(f"Error identifying citation position: {str(e)}")
            return 'references'
    
    def _calculate_citation_strength(self, citing_text: str, cited_text: str, similarity_score: float) -> float:
        """Calculate the strength of citation relationship"""
        try:
            # Base strength from similarity
            base_strength = similarity_score
            
            # Adjust based on citation type
            citation_type = self._classify_citation_type(citing_text)
            
            type_weights = {
                'supporting': 0.9,
                'contradicting': 0.8,
                'methodology': 0.7,
                'comparison': 0.6,
                'background': 0.4,
                'mentioning': 0.3
            }
            
            type_weight = type_weights.get(citation_type, 0.5)
            
            # Adjust based on text length (longer context might indicate stronger citation)
            context_length = len(citing_text)
            length_factor = min(1.0, context_length / 500)  # Normalize to max 1.0
            
            # Calculate final strength
            final_strength = base_strength * type_weight * (0.7 + 0.3 * length_factor)
            
            return round(min(1.0, final_strength), 3)
            
        except Exception as e:
            logger.error(f"Error calculating citation strength: {str(e)}")
            return 0.5
    
    def _get_timestamp(self) -> str:
        """Get current timestamp"""
        from datetime import datetime
        return datetime.now().isoformat()
    
    def analyze_citation_network(self, citations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze a network of citations"""
        try:
            if not citations:
                return {'error': 'No citations provided'}
            
            # Network statistics
            total_citations = len(citations)
            unique_papers = len(set(c.get('cited_paper_id') for c in citations))
            citing_papers = len(set(c.get('citing_paper_id') for c in citations))
            
            # Citation types distribution
            citation_types = {}
            for citation in citations:
                cit_type = citation.get('citation_type', 'unknown')
                citation_types[cit_type] = citation_types.get(cit_type, 0) + 1
            
            # Self-citation analysis
            self_citations = sum(1 for c in citations if c.get('self_citation', False))
            self_citation_rate = self_citations / total_citations if total_citations > 0 else 0
            
            # Similarity distribution
            similarities = [c.get('similarity_score', 0) for c in citations if c.get('similarity_score') is not None]
            avg_similarity = np.mean(similarities) if similarities else 0
            
            # Strength distribution
            strengths = [c.get('strength', 0) for c in citations if c.get('strength') is not None]
            avg_strength = np.mean(strengths) if strengths else 0
            
            return {
                'total_citations': total_citations,
                'unique_cited_papers': unique_papers,
                'citing_papers': citing_papers,
                'citation_types_distribution': citation_types,
                'self_citation_count': self_citations,
                'self_citation_rate': round(self_citation_rate, 3),
                'average_similarity': round(avg_similarity, 3),
                'average_strength': round(avg_strength, 3),
                'network_density': round(total_citations / (unique_papers * citing_papers), 3) if unique_papers * citing_papers > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Error analyzing citation network: {str(e)}")
            return {'error': str(e)}
    
    def find_bibliographic_coupling(self, citations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Find bibliographic coupling between papers"""
        try:
            if not citations:
                return []
            
            # Group citations by citing paper
            citing_papers = {}
            for citation in citations:
                citing_id = citation.get('citing_paper_id')
                cited_id = citation.get('cited_paper_id')
                
                if citing_id not in citing_papers:
                    citing_papers[citing_id] = set()
                citing_papers[citing_id].add(cited_id)
            
            # Find shared citations between papers
            couplings = []
            paper_ids = list(citing_papers.keys())
            
            for i in range(len(paper_ids)):
                for j in range(i + 1, len(paper_ids)):
                    paper1 = paper_ids[i]
                    paper2 = paper_ids[j]
                    
                    shared_citations = citing_papers[paper1] & citing_papers[paper2]
                    
                    if len(shared_citations) > 1:  # At least 2 shared citations
                        coupling_strength = len(shared_citations) / min(len(citing_papers[paper1]), len(citing_papers[paper2]))
                        
                        couplings.append({
                            'paper1_id': paper1,
                            'paper2_id': paper2,
                            'shared_citations': list(shared_citations),
                            'shared_citation_count': len(shared_citations),
                            'coupling_strength': round(coupling_strength, 3)
                        })
            
            # Sort by coupling strength
            couplings.sort(key=lambda x: x['coupling_strength'], reverse=True)
            
            return couplings
            
        except Exception as e:
            logger.error(f"Error finding bibliographic coupling: {str(e)}")
            return []
    
    def find_co_citations(self, citations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Find co-cited papers"""
        try:
            if not citations:
                return []
            
            # Group citations by cited paper
            cited_papers = {}
            for citation in citations:
                cited_id = citation.get('cited_paper_id')
                citing_id = citation.get('citing_paper_id')
                
                if cited_id not in cited_papers:
                    cited_papers[cited_id] = set()
                cited_papers[cited_id].add(citing_id)
            
            # Find papers cited together
            co_citations = []
            paper_ids = list(cited_papers.keys())
            
            for i in range(len(paper_ids)):
                for j in range(i + 1, len(paper_ids)):
                    paper1 = paper_ids[i]
                    paper2 = paper_ids[j]
                    
                    co_citing_papers = cited_papers[paper1] & cited_papers[paper2]
                    
                    if len(co_citing_papers) > 0:
                        co_citations.append({
                            'paper1_id': paper1,
                            'paper2_id': paper2,
                            'co_citing_papers': list(co_citing_papers),
                            'co_citation_count': len(co_citing_papers)
                        })
            
            # Sort by co-citation count
            co_citations.sort(key=lambda x: x['co_citation_count'], reverse=True)
            
            return co_citations
            
        except Exception as e:
            logger.error(f"Error finding co-citations: {str(e)}")
            return []
