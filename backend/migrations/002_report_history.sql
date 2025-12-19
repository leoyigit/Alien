-- =====================================================
-- ALIEN PORTAL: Report History Migration
-- Run this SQL in Supabase SQL Editor
-- =====================================================

-- Create report_history table
CREATE TABLE public.report_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT NOT NULL UNIQUE,  -- 4-char alphanumeric (e.g., "9S0X")
    report_type TEXT NOT NULL,       -- pm_status, migration_tracker, communication
    content TEXT NOT NULL,           -- Full report markdown content
    project_count INTEGER,           -- Number of projects included
    generated_by UUID REFERENCES portal_users(id),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB                   -- Additional data (project_ids, filters, etc.)
);

-- Create indexes for efficient queries
CREATE INDEX idx_report_history_type ON report_history(report_type);
CREATE INDEX idx_report_history_generated_at ON report_history(generated_at DESC);
CREATE INDEX idx_report_history_report_id ON report_history(report_id);

-- Row Level Security
ALTER TABLE report_history ENABLE ROW LEVEL SECURITY;

-- Policy: Only internal users and superadmins can view reports
CREATE POLICY "Internal users can view report history" ON report_history
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM portal_users WHERE id = auth.uid() AND role IN ('superadmin', 'internal'))
    );

-- Policy: Only authenticated users who generated reports can insert
CREATE POLICY "Authenticated users can create reports" ON report_history
    FOR INSERT WITH CHECK (
        auth.uid() = generated_by AND
        EXISTS (SELECT 1 FROM portal_users WHERE id = auth.uid() AND role IN ('superadmin', 'internal'))
    );

-- Add comment for documentation
COMMENT ON TABLE report_history IS 'Stores generated AI reports with unique IDs for historical reference and comparison';
COMMENT ON COLUMN report_history.report_id IS 'Unique 4-character alphanumeric identifier (e.g., 9S0X, 38ID)';
COMMENT ON COLUMN report_history.metadata IS 'JSON object containing project_ids, filters, and other generation parameters';
