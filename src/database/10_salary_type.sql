-- Create salary_type table with UUID primary key
CREATE TABLE IF NOT EXISTS salary_type (
    salary_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salary_type VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default salary types
INSERT INTO salary_type (salary_type) 
VALUES ('Salary'), ('Advance')
ON CONFLICT (salary_type) DO NOTHING;
