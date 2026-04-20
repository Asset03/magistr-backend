import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple
import logging
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import LatentDirichletAllocation, NMF
from bertopic import BERTopic
import gensim
from gensim import corpora
from gensim.models import LdaModel
import pickle
import os

logger = logging.getLogger(__name__)

class TopicModeler:
    def __init__(self):
        """Initialize topic modeler with various algorithms"""
        try:
            self.models = {}
            self.vectorizers = {}
            self.topic_distributions = {}
            
            # Default parameters
            self.default_params = {
                'lda': {
                    'n_components': 10,
                    'random_state': 42,
                    'max_iter': 100,
                    'learning_method': 'online'
                },
                'nmf': {
                    'n_components': 10,
                    'random_state': 42,
                    'max_iter': 200
                },
                'bertopic': {
                    'embedding_model': 'all-MiniLM-L6-v2',
                    'verbose': True
                }
            }
            
            logger.info("Topic modeler initialized successfully")
            
        except Exception as e:
            logger.error(f"Error initializing topic modeler: {str(e)}")
            raise
    
    def preprocess_documents(self, documents: List[str], max_features: int = 1000) -> Tuple[List[str], Any]:
        """Preprocess documents for topic modeling"""
        try:
            if not documents:
                return [], None
            
            # Remove empty documents
            documents = [doc for doc in documents if doc and doc.strip()]
            
            if not documents:
                return [], None
            
            # Create TF-IDF vectorizer
            vectorizer = TfidfVectorizer(
                max_features=max_features,
                stop_words='english',
                lowercase=True,
                ngram_range=(1, 2),
                min_df=2,
                max_df=0.8
            )
            
            # Fit and transform documents
            doc_term_matrix = vectorizer.fit_transform(documents)
            
            return documents, (vectorizer, doc_term_matrix)
            
        except Exception as e:
            logger.error(f"Error preprocessing documents: {str(e)}")
            return [], None
    
    def fit_lda(self, documents: List[str], n_topics: int = 10, **kwargs) -> Dict[str, Any]:
        """Fit LDA model"""
        try:
            if not documents:
                return {'error': 'No documents provided'}
            
            # Preprocess documents
            processed_docs, preprocessing_result = self.preprocess_documents(documents)
            if not processed_docs:
                return {'error': 'No valid documents after preprocessing'}
            
            vectorizer, doc_term_matrix = preprocessing_result
            
            # Set parameters
            params = self.default_params['lda'].copy()
            params.update(kwargs)
            params['n_components'] = n_topics
            
            # Fit LDA model
            lda = LatentDirichletAllocation(**params)
            lda.fit(doc_term_matrix)
            
            # Get feature names (words)
            feature_names = vectorizer.get_feature_names_out()
            
            # Extract topics
            topics = []
            for topic_idx, topic in enumerate(lda.components_):
                top_words_idx = topic.argsort()[-10:][::-1]
                top_words = [feature_names[i] for i in top_words_idx]
                top_weights = [topic[i] for i in top_words_idx]
                
                topics.append({
                    'topic_id': topic_idx,
                    'words': top_words,
                    'weights': top_weights.tolist(),
                    'word_weight_pairs': list(zip(top_words, top_weights))
                })
            
            # Get document-topic distributions
            doc_topic_dist = lda.transform(doc_term_matrix)
            
            # Store model
            model_id = f"lda_{n_topics}_{len(documents)}"
            self.models[model_id] = {
                'model': lda,
                'vectorizer': vectorizer,
                'type': 'lda',
                'n_topics': n_topics
            }
            
            return {
                'model_id': model_id,
                'topics': topics,
                'document_topic_distribution': doc_topic_dist.tolist(),
                'n_topics': n_topics,
                'n_documents': len(documents),
                'perplexity': lda.perplexity(doc_term_matrix),
                'log_likelihood': lda.score(doc_term_matrix)
            }
            
        except Exception as e:
            logger.error(f"Error fitting LDA model: {str(e)}")
            return {'error': str(e)}
    
    def fit_nmf(self, documents: List[str], n_topics: int = 10, **kwargs) -> Dict[str, Any]:
        """Fit NMF model"""
        try:
            if not documents:
                return {'error': 'No documents provided'}
            
            # Preprocess documents
            processed_docs, preprocessing_result = self.preprocess_documents(documents)
            if not processed_docs:
                return {'error': 'No valid documents after preprocessing'}
            
            vectorizer, doc_term_matrix = preprocessing_result
            
            # Set parameters
            params = self.default_params['nmf'].copy()
            params.update(kwargs)
            params['n_components'] = n_topics
            
            # Fit NMF model
            nmf = NMF(**params)
            nmf.fit(doc_term_matrix)
            
            # Get feature names (words)
            feature_names = vectorizer.get_feature_names_out()
            
            # Extract topics
            topics = []
            for topic_idx, topic in enumerate(nmf.components_):
                top_words_idx = topic.argsort()[-10:][::-1]
                top_words = [feature_names[i] for i in top_words_idx]
                top_weights = [topic[i] for i in top_words_idx]
                
                topics.append({
                    'topic_id': topic_idx,
                    'words': top_words,
                    'weights': top_weights.tolist(),
                    'word_weight_pairs': list(zip(top_words, top_weights))
                })
            
            # Get document-topic distributions
            doc_topic_dist = nmf.transform(doc_term_matrix)
            
            # Store model
            model_id = f"nmf_{n_topics}_{len(documents)}"
            self.models[model_id] = {
                'model': nmf,
                'vectorizer': vectorizer,
                'type': 'nmf',
                'n_topics': n_topics
            }
            
            return {
                'model_id': model_id,
                'topics': topics,
                'document_topic_distribution': doc_topic_dist.tolist(),
                'n_topics': n_topics,
                'n_documents': len(documents),
                'reconstruction_error': nmf.reconstruction_err_
            }
            
        except Exception as e:
            logger.error(f"Error fitting NMF model: {str(e)}")
            return {'error': str(e)}
    
    def fit_bertopic(self, documents: List[str], n_topics: int = 10, **kwargs) -> Dict[str, Any]:
        """Fit BERTopic model"""
        try:
            if not documents:
                return {'error': 'No documents provided'}
            
            # Remove empty documents
            documents = [doc for doc in documents if doc and doc.strip()]
            
            if not documents:
                return {'error': 'No valid documents after preprocessing'}
            
            # Set parameters
            params = self.default_params['bertopic'].copy()
            params.update(kwargs)
            
            # Create BERTopic model
            topic_model = BERTopic(
                nr_topics=n_topics,
                verbose=params.get('verbose', True),
                embedding_model=params.get('embedding_model', 'all-MiniLM-L6-v2')
            )
            
            # Fit model
            topics, probs = topic_model.fit_transform(documents)
            
            # Get topic information
            topic_info = topic_model.get_topic_info()
            
            # Extract topics in consistent format
            result_topics = []
            for _, row in topic_info.iterrows():
                if row['Topic'] != -1:  # Skip outlier topic
                    topic_words = topic_model.get_topic(row['Topic'])
                    if topic_words:
                        words, weights = zip(*topic_words)
                        result_topics.append({
                            'topic_id': row['Topic'],
                            'words': list(words),
                            'weights': list(weights),
                            'word_weight_pairs': topic_words,
                            'frequency': row['Count'],
                            'representative_doc': row.get('Representative_Docs', '')
                        })
            
            # Store model
            model_id = f"bertopic_{n_topics}_{len(documents)}"
            self.models[model_id] = {
                'model': topic_model,
                'type': 'bertopic',
                'n_topics': n_topics
            }
            
            return {
                'model_id': model_id,
                'topics': result_topics,
                'document_topic_distribution': probs,
                'n_topics': len(result_topics),
                'n_documents': len(documents),
                'topic_info': topic_info.to_dict('records')
            }
            
        except Exception as e:
            logger.error(f"Error fitting BERTopic model: {str(e)}")
            return {'error': str(e)}
    
    def fit_topics(self, documents: List[str], n_topics: int = 10, algorithm: str = 'lda', **kwargs) -> Dict[str, Any]:
        """Fit topic model with specified algorithm"""
        try:
            algorithm = algorithm.lower()
            
            if algorithm == 'lda':
                return self.fit_lda(documents, n_topics, **kwargs)
            elif algorithm == 'nmf':
                return self.fit_nmf(documents, n_topics, **kwargs)
            elif algorithm == 'bertopic':
                return self.fit_bertopic(documents, n_topics, **kwargs)
            else:
                return {'error': f'Unsupported algorithm: {algorithm}'}
                
        except Exception as e:
            logger.error(f"Error fitting topics: {str(e)}")
            return {'error': str(e)}
    
    def predict_topics(self, documents: List[str], model_id: str = None) -> List[Dict[str, Any]]:
        """Predict topics for new documents"""
        try:
            if not documents:
                return []
            
            # Use default model if not specified
            if not model_id and self.models:
                model_id = list(self.models.keys())[0]
            
            if model_id not in self.models:
                return [{'error': f'Model {model_id} not found'}]
            
            model_info = self.models[model_id]
            model = model_info['model']
            model_type = model_info['type']
            
            results = []
            
            if model_type in ['lda', 'nmf']:
                # Preprocess documents
                vectorizer = model_info['vectorizer']
                doc_term_matrix = vectorizer.transform(documents)
                
                # Predict topics
                doc_topic_dist = model.transform(doc_term_matrix)
                
                for i, distribution in enumerate(doc_topic_dist):
                    dominant_topic = np.argmax(distribution)
                    confidence = distribution[dominant_topic]
                    
                    results.append({
                        'document_index': i,
                        'dominant_topic': int(dominant_topic),
                        'confidence': float(confidence),
                        'topic_distribution': distribution.tolist()
                    })
            
            elif model_type == 'bertopic':
                # Predict with BERTopic
                topics, probs = model.transform(documents)
                
                for i, (topic, prob) in enumerate(zip(topics, probs)):
                    if topic != -1:  # Not outlier
                        confidence = prob[topic] if len(prob) > topic else 0.0
                    else:
                        confidence = 0.0
                    
                    results.append({
                        'document_index': i,
                        'dominant_topic': int(topic),
                        'confidence': float(confidence),
                        'topic_distribution': prob.tolist() if hasattr(prob, 'tolist') else []
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"Error predicting topics: {str(e)}")
            return [{'error': str(e)}]
    
    def calculate_coherence(self, topics_result: Dict[str, Any], documents: List[str]) -> Dict[str, float]:
        """Calculate topic coherence scores"""
        try:
            if 'topics' not in topics_result:
                return {'error': 'No topics found in result'}
            
            topics = topics_result['topics']
            
            # Preprocess documents for gensim
            processed_docs = []
            for doc in documents:
                if doc and doc.strip():
                    # Simple tokenization
                    tokens = doc.lower().split()
                    processed_docs.append(tokens)
            
            if not processed_docs:
                return {'error': 'No valid documents for coherence calculation'}
            
            # Create dictionary and corpus
            dictionary = corpora.Dictionary(processed_docs)
            corpus = [dictionary.doc2bow(doc) for doc in processed_docs]
            
            # Extract topics in gensim format
            gensim_topics = []
            for topic in topics:
                words = topic['words']
                weights = topic['weights']
                # Create list of (word_id, probability) tuples
                topic_words = []
                for word, weight in zip(words, weights):
                    if word in dictionary.token2id:
                        topic_words.append((dictionary.token2id[word], weight))
                if topic_words:
                    gensim_topics.append(topic_words)
            
            if not gensim_topics:
                return {'error': 'No valid topics for coherence calculation'}
            
            # Calculate coherence using gensim
            from gensim.models import CoherenceModel
            
            coherence_model = CoherenceModel(
                topics=gensim_topics,
                texts=processed_docs,
                dictionary=dictionary,
                coherence='c_v'
            )
            
            coherence_score = coherence_model.get_coherence()
            
            # Calculate additional metrics
            coherence_model_umass = CoherenceModel(
                topics=gensim_topics,
                texts=processed_docs,
                dictionary=dictionary,
                coherence='u_mass'
            )
            
            coherence_umass = coherence_model_umass.get_coherence()
            
            return {
                'coherence_cv': coherence_score,
                'coherence_umass': coherence_umass,
                'n_topics': len(gensim_topics),
                'n_documents': len(processed_docs)
            }
            
        except Exception as e:
            logger.error(f"Error calculating coherence: {str(e)}")
            return {'error': str(e)}
    
    def get_topic_words(self, model_id: str, topic_id: int, n_words: int = 10) -> Dict[str, Any]:
        """Get top words for a specific topic"""
        try:
            if model_id not in self.models:
                return {'error': f'Model {model_id} not found'}
            
            model_info = self.models[model_id]
            model = model_info['model']
            model_type = model_info['type']
            
            if model_type in ['lda', 'nmf']:
                vectorizer = model_info['vectorizer']
                feature_names = vectorizer.get_feature_names_out()
                
                if topic_id >= len(model.components_):
                    return {'error': f'Topic {topic_id} not found'}
                
                topic = model.components_[topic_id]
                top_words_idx = topic.argsort()[-n_words:][::-1]
                top_words = [feature_names[i] for i in top_words_idx]
                top_weights = [topic[i] for i in top_words_idx]
                
                return {
                    'topic_id': topic_id,
                    'words': top_words,
                    'weights': top_weights.tolist(),
                    'word_weight_pairs': list(zip(top_words, top_weights))
                }
            
            elif model_type == 'bertopic':
                topic_words = model.get_topic(topic_id)
                if topic_words:
                    words, weights = zip(*topic_words[:n_words])
                    return {
                        'topic_id': topic_id,
                        'words': list(words),
                        'weights': list(weights),
                        'word_weight_pairs': topic_words[:n_words]
                    }
                else:
                    return {'error': f'No words found for topic {topic_id}'}
            
            else:
                return {'error': f'Unsupported model type: {model_type}'}
                
        except Exception as e:
            logger.error(f"Error getting topic words: {str(e)}")
            return {'error': str(e)}
    
    def save_model(self, model_id: str, filepath: str) -> bool:
        """Save a trained model"""
        try:
            if model_id not in self.models:
                logger.error(f"Model {model_id} not found")
                return False
            
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            
            with open(filepath, 'wb') as f:
                pickle.dump(self.models[model_id], f)
            
            logger.info(f"Model {model_id} saved to {filepath}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving model: {str(e)}")
            return False
    
    def load_model(self, model_id: str, filepath: str) -> bool:
        """Load a saved model"""
        try:
            if not os.path.exists(filepath):
                logger.error(f"Model file not found: {filepath}")
                return False
            
            with open(filepath, 'rb') as f:
                model_data = pickle.load(f)
            
            self.models[model_id] = model_data
            logger.info(f"Model {model_id} loaded from {filepath}")
            return True
            
        except Exception as e:
            logger.error(f"Error loading model: {str(e)}")
            return False
    
    def get_model_info(self, model_id: str) -> Dict[str, Any]:
        """Get information about a trained model"""
        try:
            if model_id not in self.models:
                return {'error': f'Model {model_id} not found'}
            
            model_info = self.models[model_id]
            
            return {
                'model_id': model_id,
                'type': model_info['type'],
                'n_topics': model_info.get('n_topics', 'unknown'),
                'created_at': model_info.get('created_at', 'unknown')
            }
            
        except Exception as e:
            logger.error(f"Error getting model info: {str(e)}")
            return {'error': str(e)}
