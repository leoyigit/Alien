-- Add ETA fields for Developer (PC) and Shopline (SL)
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS eta_pc TEXT,
ADD COLUMN IF NOT EXISTS eta_sl TEXT;

-- Add checking if needed (optional, just text fields for now)
COMMENT ON COLUMN projects.eta_pc IS 'Estimated Time of Arrival for Developer tasks';
COMMENT ON COLUMN projects.eta_sl IS 'Estimated Time of Arrival for Shopline tasks';
