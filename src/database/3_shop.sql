-- Create shop table with UUID primary key
CREATE TABLE IF NOT EXISTS shop (
    shop_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_name VARCHAR(255) NOT NULL,
    shop_address TEXT,
    shop_phone_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on shop_name for faster searches
CREATE INDEX IF NOT EXISTS idx_shop_name ON shop(shop_name);

-- Sample data (optional - uncomment if needed)
-- INSERT INTO shop (shop_name, shop_address, shop_phone_number) VALUES 
-- ('Metro Electronics', '123 Main St, Delhi', '9876543210'),
-- ('City Hardware', '456 Park Ave, Mumbai', '9123456789');
