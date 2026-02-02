-- Create finance table with UUID primary key
CREATE TABLE IF NOT EXISTS finance (
    finance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id UUID NOT NULL,
    finance_category_id UUID NOT NULL,
    finance_type_id UUID NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    transaction_date DATE NOT NULL,
    description TEXT,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bank_account_id) REFERENCES bank_account(bank_account_id) ON DELETE CASCADE,
    FOREIGN KEY (finance_category_id) REFERENCES finance_categories(finance_category_id) ON DELETE CASCADE,
    FOREIGN KEY (finance_type_id) REFERENCES finance_types(finance_type_id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_finance_bank_account ON finance(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_finance_category ON finance(finance_category_id);
CREATE INDEX IF NOT EXISTS idx_finance_type ON finance(finance_type_id);
CREATE INDEX IF NOT EXISTS idx_finance_transaction_date ON finance(transaction_date);
