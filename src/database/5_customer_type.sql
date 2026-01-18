-- Create customer_type table with UUID primary key
CREATE TABLE IF NOT EXISTS customer_type (
    customer_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_type_name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert predefined customer types
INSERT INTO customer_type (customer_type_name) VALUES 
('Mechanic'),
('Workshop'),
('Customer')
ON CONFLICT (customer_type_name) DO NOTHING;