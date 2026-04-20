import numpy as np
from typing import List, Optional, Union, Dict
import logging
from sentence_transformers import SentenceTransformer
import torch
from sklearn.metrics.pairwise import cosine_similarity
import pickle
import os

logger = logging.getLogger(__name__)

class EmbeddingGenerator:
    def __init__(self):
        """Initialize embedding generator with pre-trained models"""
        try:
            self.models = {}
            self.default_model = 'all-MiniLM-L6-v2'
            
            # Additional specialized models
            self.available_models = {
                'all-MiniLM-L6-v2': 'sentence-transformers/all-MiniLM-L6-v2',
                'paraphrase-MiniLM-L6-v2': 'sentence-transformers/paraphrase-MiniLM-L6-v2',
                'stsb-roberta-large': 'sentence-transformers/stsb-roberta-large',
                'scientific-abstracts': 'sentence-transformers/allenai-specter',  # Scientific papers
                'multilingual-MiniLM': 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
            }
            
            # Load default model
            self._load_model(self.default_model)
            
            logger.info("Embedding generator initialized successfully")
            
        except Exception as e:
            logger.error(f"Error initializing embedding generator: {str(e)}")
            raise
    
    def _load_model(self, model_name: str) -> None:
        """Load a specific model"""
        try:
            if model_name in self.models:
                return
            
            full_model_name = self.available_models.get(model_name, model_name)
            
            logger.info(f"Loading model: {full_model_name}")
            model = SentenceTransformer(full_model_name)
            
            # Move to GPU if available
            if torch.cuda.is_available():
                model = model.to('cuda')
                logger.info("Model moved to GPU")
            
            self.models[model_name] = model
            
        except Exception as e:
            logger.error(f"Error loading model {model_name}: {str(e)}")
            raise
    
    def generate_embeddings(self, text: Union[str, List[str]], model_name: str = None) -> Optional[np.ndarray]:
        """Generate embeddings for text or list of texts"""
        try:
            if not text:
                return None
            
            model_name = model_name or self.default_model
            
            if model_name not in self.models:
                self._load_model(model_name)
            
            model = self.models[model_name]
            
            if isinstance(text, str):
                # Single text
                embedding = model.encode(text, convert_to_numpy=True)
                return embedding
            else:
                # List of texts
                embeddings = model.encode(text, convert_to_numpy=True)
                return embeddings
                
        except Exception as e:
            logger.error(f"Error generating embeddings: {str(e)}")
            return None
    
    def generate_batch_embeddings(self, texts: List[str], model_name: str = None, batch_size: int = 32) -> List[Optional[np.ndarray]]:
        """Generate embeddings for a batch of texts"""
        try:
            if not texts:
                return []
            
            model_name = model_name or self.default_model
            
            if model_name not in self.models:
                self._load_model(model_name)
            
            model = self.models[model_name]
            
            embeddings = []
            
            # Process in batches
            for i in range(0, len(texts), batch_size):
                batch_texts = texts[i:i + batch_size]
                batch_embeddings = model.encode(batch_texts, convert_to_numpy=True)
                embeddings.extend(batch_embeddings)
            
            return embeddings
            
        except Exception as e:
            logger.error(f"Error generating batch embeddings: {str(e)}")
            return [None] * len(texts)
    
    def calculate_similarity(self, text1: str, text2: str, model_name: str = None) -> float:
        """Calculate cosine similarity between two texts"""
        try:
            embeddings = self.generate_embeddings([text1, text2], model_name)
            
            if embeddings is None or len(embeddings) < 2:
                return 0.0
            
            # Reshape for cosine_similarity
            emb1 = embeddings[0].reshape(1, -1)
            emb2 = embeddings[1].reshape(1, -1)
            
            similarity = cosine_similarity(emb1, emb2)[0][0]
            return float(similarity)
            
        except Exception as e:
            logger.error(f"Error calculating similarity: {str(e)}")
            return 0.0
    
    def calculate_similarity_matrix(self, texts: List[str], model_name: str = None) -> np.ndarray:
        """Calculate similarity matrix for multiple texts"""
        try:
            if not texts:
                return np.array([])
            
            embeddings = self.generate_embeddings(texts, model_name)
            
            if embeddings is None:
                return np.zeros((len(texts), len(texts)))
            
            similarity_matrix = cosine_similarity(embeddings)
            return similarity_matrix
            
        except Exception as e:
            logger.error(f"Error calculating similarity matrix: {str(e)}")
            return np.zeros((len(texts), len(texts)))
    
    def find_most_similar(self, query_text: str, candidate_texts: List[str], model_name: str = None, top_k: int = 5) -> List[Dict[str, Union[str, float]]]:
        """Find most similar texts to a query"""
        try:
            if not candidate_texts:
                return []
            
            # Generate embeddings
            all_texts = [query_text] + candidate_texts
            embeddings = self.generate_embeddings(all_texts, model_name)
            
            if embeddings is None or len(embeddings) < 2:
                return []
            
            query_embedding = embeddings[0].reshape(1, -1)
            candidate_embeddings = embeddings[1:]
            
            # Calculate similarities
            similarities = cosine_similarity(query_embedding, candidate_embeddings)[0]
            
            # Get top-k most similar
            top_indices = np.argsort(similarities)[::-1][:top_k]
            
            results = []
            for idx in top_indices:
                if similarities[idx] > 0:  # Only include positive similarities
                    results.append({
                        'text': candidate_texts[idx],
                        'similarity': float(similarities[idx]),
                        'index': int(idx)
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"Error finding most similar texts: {str(e)}")
            return []
    
    def cluster_embeddings(self, texts: List[str], n_clusters: int = 5, model_name: str = None) -> Dict[str, Union[List[int], np.ndarray]]:
        """Cluster texts based on their embeddings"""
        try:
            if not texts or len(texts) < n_clusters:
                return {'clusters': [], 'centroids': np.array([])}
            
            from sklearn.cluster import KMeans
            
            # Generate embeddings
            embeddings = self.generate_embeddings(texts, model_name)
            
            if embeddings is None:
                return {'clusters': [], 'centroids': np.array([])}
            
            # Perform clustering
            kmeans = KMeans(n_clusters=n_clusters, random_state=42)
            cluster_labels = kmeans.fit_predict(embeddings)
            
            return {
                'clusters': cluster_labels.tolist(),
                'centroids': kmeans.cluster_centers_
            }
            
        except Exception as e:
            logger.error(f"Error clustering embeddings: {str(e)}")
            return {'clusters': [], 'centroids': np.array([])}
    
    def reduce_dimensions(self, embeddings: np.ndarray, method: str = 'pca', n_components: int = 2) -> np.ndarray:
        """Reduce dimensionality of embeddings for visualization"""
        try:
            if embeddings is None or embeddings.size == 0:
                return np.array([])
            
            if method.lower() == 'pca':
                from sklearn.decomposition import PCA
                reducer = PCA(n_components=n_components)
            elif method.lower() == 'tsne':
                from sklearn.manifold import TSNE
                reducer = TSNE(n_components=n_components, random_state=42)
            else:
                raise ValueError(f"Unsupported dimensionality reduction method: {method}")
            
            reduced_embeddings = reducer.fit_transform(embeddings)
            return reduced_embeddings
            
        except Exception as e:
            logger.error(f"Error reducing dimensions: {str(e)}")
            return np.array([])
    
    def save_embeddings(self, embeddings: np.ndarray, filepath: str) -> bool:
        """Save embeddings to file"""
        try:
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            
            with open(filepath, 'wb') as f:
                pickle.dump(embeddings, f)
            
            logger.info(f"Embeddings saved to {filepath}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving embeddings: {str(e)}")
            return False
    
    def load_embeddings(self, filepath: str) -> Optional[np.ndarray]:
        """Load embeddings from file"""
        try:
            if not os.path.exists(filepath):
                logger.warning(f"Embeddings file not found: {filepath}")
                return None
            
            with open(filepath, 'rb') as f:
                embeddings = pickle.load(f)
            
            logger.info(f"Embeddings loaded from {filepath}")
            return embeddings
            
        except Exception as e:
            logger.error(f"Error loading embeddings: {str(e)}")
            return None
    
    def get_embedding_info(self, model_name: str = None) -> Dict[str, Union[str, int]]:
        """Get information about the embedding model"""
        try:
            model_name = model_name or self.default_model
            
            if model_name not in self.models:
                self._load_model(model_name)
            
            model = self.models[model_name]
            
            # Get embedding dimension by encoding a sample text
            sample_embedding = model.encode("sample text", convert_to_numpy=True)
            
            return {
                'model_name': model_name,
                'full_model_name': self.available_models.get(model_name, model_name),
                'embedding_dimension': sample_embedding.shape[0],
                'device': 'cuda' if torch.cuda.is_available() else 'cpu',
                'available_models': list(self.available_models.keys())
            }
            
        except Exception as e:
            logger.error(f"Error getting embedding info: {str(e)}")
            return {}
    
    def semantic_search(self, query: str, documents: List[str], model_name: str = None, threshold: float = 0.5) -> List[Dict[str, Union[str, float, int]]]:
        """Perform semantic search on documents"""
        try:
            if not documents:
                return []
            
            # Generate embeddings
            all_texts = [query] + documents
            embeddings = self.generate_embeddings(all_texts, model_name)
            
            if embeddings is None or len(embeddings) < 2:
                return []
            
            query_embedding = embeddings[0].reshape(1, -1)
            doc_embeddings = embeddings[1:]
            
            # Calculate similarities
            similarities = cosine_similarity(query_embedding, doc_embeddings)[0]
            
            # Filter by threshold and sort
            results = []
            for i, similarity in enumerate(similarities):
                if similarity >= threshold:
                    results.append({
                        'document': documents[i],
                        'similarity': float(similarity),
                        'index': i
                    })
            
            # Sort by similarity (descending)
            results.sort(key=lambda x: x['similarity'], reverse=True)
            
            return results
            
        except Exception as e:
            logger.error(f"Error in semantic search: {str(e)}")
            return []
    
    def update_model(self, model_name: str, model_path: str) -> bool:
        """Update or add a new model"""
        try:
            logger.info(f"Loading custom model from {model_path}")
            model = SentenceTransformer(model_path)
            
            if torch.cuda.is_available():
                model = model.to('cuda')
            
            self.models[model_name] = model
            self.available_models[model_name] = model_path
            
            logger.info(f"Model {model_name} loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error updating model: {str(e)}")
            return False
