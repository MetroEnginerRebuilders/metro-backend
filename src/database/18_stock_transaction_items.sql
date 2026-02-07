-- Create stock_transaction_items table with UUID primary key
CREATE TABLE IF NOT EXISTS stock_transaction_items (
    stock_transaction_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_transaction_id UUID NOT NULL,
    company_id UUID NOT NULL,
    model_id UUID NOT NULL,
    spare_id UUID NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_transaction_id) REFERENCES stock_transaction(stock_transaction_id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE,
    FOREIGN KEY (model_id) REFERENCES model(model_id) ON DELETE CASCADE,
    FOREIGN KEY (spare_id) REFERENCES spare(spare_id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_stock_transaction_items_transaction ON stock_transaction_items(stock_transaction_id);
CREATE INDEX IF NOT EXISTS idx_stock_transaction_items_company ON stock_transaction_items(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_transaction_items_model ON stock_transaction_items(model_id);
CREATE INDEX IF NOT EXISTS idx_stock_transaction_items_spare ON stock_transaction_items(spare_id);
