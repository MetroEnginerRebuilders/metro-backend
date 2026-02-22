-- Create item_types table with UUID primary key
CREATE TABLE IF NOT EXISTS item_types (
    item_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type_name VARCHAR(100) NOT NULL UNIQUE,
    item_type_code VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default item types
INSERT INTO item_types (item_type_name, item_type_code)
VALUES
    ('Work', 'WORK'),
    ('Spare', 'SPARE'),
    ('Discount', 'DISCOUNT'),
    ('Commission', 'COMMISSION')
ON CONFLICT (item_type_name) DO NOTHING;
