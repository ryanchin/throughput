-- Add type column to docs_pages to distinguish knowledge pages from docs pages
-- Both share the same table structure but are queried separately by type.

alter table docs_pages
  add column type text not null default 'knowledge'
  check (type in ('knowledge', 'docs'));

-- All existing rows are knowledge pages
update docs_pages set type = 'knowledge' where type = 'knowledge';

-- Index for filtering by type
create index idx_docs_pages_type on docs_pages (type);

-- Composite index for common query pattern: type + status
create index idx_docs_pages_type_status on docs_pages (type, status);
