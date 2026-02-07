-- Create stock_transaction_types table with UUID primary key
CREATE TABLE IF NOT EXISTS stock_types (
    stock_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_type_name VARCHAR(100) NOT NULL UNIQUE,
    stock_type_code VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default stock transaction types
INSERT INTO stock_types (stock_type_name, stock_type_code) 
VALUES 
    ('Purchase', 'PURCHASE'),
    ('Return', 'RETURN')
ON CONFLICT (stock_type_name) DO NOTHING;