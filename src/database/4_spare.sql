-- Create spare table with UUID primary key
CREATE TABLE IF NOT EXISTS spare (
    spare_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spare_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on spare_name for faster searches
CREATE INDEX IF NOT EXISTS idx_spare_name ON spare(spare_name);

-- Sample data (optional - uncomment if needed)
-- INSERT INTO spare (spare_name) VALUES 
-- ('Engine Oil'),
-- ('Brake Pads'),
-- ('Air Filter');
