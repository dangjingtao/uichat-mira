# Knowledge Base Backend Schema

## Scope

This schema is designed for the current single-knowledge-base MVP, while keeping room for future expansion to:

- multiple knowledge bases
- multiple embedding models
- rebuilding vector indexes when embedding dimensions change
- mixed retrieval strategies (FTS + vector)

## Core tables

### `knowledge_bases`

Single source of truth for a knowledge base entity.

Key fields:

- `id`
- `name`
- `description`
- `status`
- `embedding_model_config_id`
- `chunking_config_json`
- `created_at`
- `updated_at`

Current bootstrap seeds one default row:

- `id = default`
- `name = 默认知识库`

### `documents`

Stores uploaded document metadata and raw normalized text.

Key fields:

- `id`
- `knowledge_base_id`
- `name`
- `source_type`
- `source_label`
- `file_ext`
- `mime_type`
- `file_size`
- `content_text`
- `index_status`
- `enabled`
- `chunk_count`
- `char_count`
- `token_count`
- `error_message`
- `created_at`
- `updated_at`

### `document_chunks`

Stores chunked content for retrieval and citation.

Key fields:

- `id`
- `knowledge_base_id`
- `document_id`
- `chunk_index`
- `content`
- `char_count`
- `token_count`
- `start_offset`
- `end_offset`
- `created_at`

## Full-text retrieval

### `document_chunks_fts`

SQLite FTS5 virtual table bound to `document_chunks`.

Design:

- external-content FTS table
- insert / update / delete triggers keep it in sync

This supports lightweight keyword retrieval without additional indexing services.

## Vector retrieval

### `knowledge_base_vector_indexes`

Registry table for vector index metadata.

Key fields:

- `id`
- `knowledge_base_id`
- `table_name`
- `embedding_model_config_id`
- `dimensions`
- `distance_metric`
- `is_active`
- `created_at`
- `updated_at`

## Why the sqlite-vec table is created lazily

`sqlite-vec` requires a fixed embedding dimension in the `vec0` table definition.

Because embedding models may change in the future, we do **not** hardcode one dimension at bootstrap time.

Instead:

- relational tables are created immediately
- FTS is created immediately
- vec table creation is deferred until an embedding model dimension is known

Helper:

- `ensureChunkEmbeddingVectorTable({ dimensions, tableName })`

Default planned vec table name:

- `document_chunk_embeddings_vec`

## Current lifecycle

1. Bootstrap SQLite database
2. Create relational knowledge-base tables
3. Create FTS table and triggers
4. Seed default knowledge base row
5. Load `sqlite-vec` extension
6. Later, when embedding dimensions are known, create vec table

## Future expansion path

This design supports:

- adding `knowledge_base_members` for permissions
- adding `ingestion_jobs` for async pipelines
- adding multiple vec tables when embedding dimensions change
- rebuilding active vector indexes per knowledge base
