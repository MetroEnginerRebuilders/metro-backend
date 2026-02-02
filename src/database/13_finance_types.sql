-- Create finance_types table with UUID primary key
CREATE TABLE IF NOT EXISTS finance_types (
    finance_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finance_type_name VARCHAR(100) NOT NULL UNIQUE,
    finance_type_code VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default finance types
INSERT INTO finance_types (finance_type_name, finance_type_code) 
VALUES 
    ('Income', 'INCOME'),
    ('Expense', 'EXPENSE')
ON CONFLICT (finance_type_name) DO NOTHING;
