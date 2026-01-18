-- Create work table with UUID primary key
CREATE TABLE IF NOT EXISTS work (
    work_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on work_name for faster searches
CREATE INDEX IF NOT EXISTS idx_work_name ON work(work_name);

-- Sample data (optional - uncomment if needed)
-- INSERT INTO work (work_name) VALUES 
-- ('Construction'),
-- ('Maintenance'),
-- ('Repair');
