-- Create customer table with UUID primary key
CREATE TABLE IF NOT EXISTS customer (
    customer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_number VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_address1 TEXT,
    customer_address2 TEXT,
    customer_phone_number VARCHAR(20),
    customer_type_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_customer_type FOREIGN KEY (customer_type_id) 
        REFERENCES customer_type(customer_type_id) 
        ON DELETE RESTRICT
);

-- Create indexes for faster searches and lookups
CREATE INDEX IF NOT EXISTS idx_customer_name ON customer(customer_name);
CREATE INDEX IF NOT EXISTS idx_customer_number ON customer(customer_number);
CREATE INDEX IF NOT EXISTS idx_customer_type_id ON customer(customer_type_id);
