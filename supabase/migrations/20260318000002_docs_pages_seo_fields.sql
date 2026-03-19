-- Add SEO metadata fields to docs_pages
alter table docs_pages add column meta_title text;
alter table docs_pages add column meta_description text;

-- Rollback:
-- alter table docs_pages drop column meta_title;
-- alter table docs_pages drop column meta_description;
