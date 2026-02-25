-- Create daily_transaction table with UUID primary key
CREATE TABLE IF NOT EXISTS daily_transaction (
    transaction_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID,
    finance_types_id UUID, -- INCOME / EXPENSE / TRANSFER
    finance_categories_id UUID,
    reference_type VARCHAR(50), -- invoice, stock, salary, etc.
    reference_id UUID, -- link to invoice_id, stock_id etc.
    bank_account_id UUID NULL,
    amount NUMERIC(15,2) NOT NULL,
    transaction_date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_daily_transaction_shop FOREIGN KEY (shop_id)
        REFERENCES shop(shop_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_daily_transaction_finance_type FOREIGN KEY (finance_types_id)
        REFERENCES finance_types(finance_type_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_daily_transaction_finance_category FOREIGN KEY (finance_categories_id)
        REFERENCES finance_categories(finance_category_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_daily_transaction_bank_account FOREIGN KEY (bank_account_id)
        REFERENCES bank_account(bank_account_id)
        ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_daily_transaction_date
    ON daily_transaction(transaction_date);

CREATE INDEX IF NOT EXISTS idx_daily_transaction_shop
    ON daily_transaction(shop_id);

CREATE INDEX IF NOT EXISTS idx_daily_transaction_finance_type
    ON daily_transaction(finance_types_id);

CREATE INDEX IF NOT EXISTS idx_daily_transaction_finance_category
    ON daily_transaction(finance_categories_id);

CREATE INDEX IF NOT EXISTS idx_daily_transaction_bank_account
    ON daily_transaction(bank_account_id);

CREATE INDEX IF NOT EXISTS idx_daily_transaction_reference
    ON daily_transaction(reference_type, reference_id);
