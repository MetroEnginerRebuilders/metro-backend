-- Create stock_transaction table with UUID primary key
CREATE TABLE IF NOT EXISTS stock_transaction (
    stock_transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL,
    stock_type_id UUID NOT NULL,
    order_date DATE NOT NULL,
    description TEXT,
    bank_account_id UUID NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shop(shop_id) ON DELETE CASCADE,
    FOREIGN KEY (stock_type_id) REFERENCES stock_types(stock_type_id) ON DELETE RESTRICT,
    FOREIGN KEY (bank_account_id) REFERENCES bank_account(bank_account_id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_stock_transaction_shop ON stock_transaction(shop_id);
CREATE INDEX IF NOT EXISTS idx_stock_transaction_type ON stock_transaction(stock_type_id);
CREATE INDEX IF NOT EXISTS idx_stock_transaction_bank_account ON stock_transaction(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_stock_transaction_order_date ON stock_transaction(order_date);
