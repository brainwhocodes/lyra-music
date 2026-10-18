CREATE TABLE `track_embeddings` (
  `track_id` text PRIMARY KEY NOT NULL REFERENCES `tracks`(`track_id`) ON DELETE CASCADE,
  `content_hash` text NOT NULL,
  `model` text NOT NULL,
  `revision` text NOT NULL,
  `dimensions` integer NOT NULL,
  `retrieval_vector` text NOT NULL,
  `classification_vector` text NOT NULL,
  `similarity_vector` text NOT NULL,
  `indexed_at` text NOT NULL
);
