-- Migration: Course Completion Scorecard
-- Adds enrollment status (enrolled/passed/failed) and final_score to course_enrollments

-- Add status column with default 'enrolled'
alter table course_enrollments
  add column status text not null default 'enrolled';

-- Add check constraint for valid statuses
alter table course_enrollments
  add constraint course_enrollments_status_check
  check (status in ('enrolled', 'passed', 'failed'));

-- Add final_score column (nullable — only set on completion)
alter table course_enrollments
  add column final_score numeric(5,2) default null;

-- Index for admin queries: find all enrollments by status
create index idx_course_enrollments_status on course_enrollments(status);

-- Index for per-user queries in admin dashboard
create index idx_course_enrollments_user_id on course_enrollments(user_id);

-- Rollback SQL:
-- alter table course_enrollments drop constraint course_enrollments_status_check;
-- alter table course_enrollments drop column status;
-- alter table course_enrollments drop column final_score;
-- drop index if exists idx_course_enrollments_status;
-- drop index if exists idx_course_enrollments_user_id;
