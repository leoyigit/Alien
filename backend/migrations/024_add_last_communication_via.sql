-- Add last_communication_via column to projects table
-- Tracks how PMs last communicated with the project

ALTER TABLE projects
ADD COLUMN last_communication_via TEXT[];

COMMENT ON COLUMN projects.last_communication_via IS 'Array of communication methods used in last update (slack, email, google_meet, huddle)';
