-- Create bank_account table with UUID primary key
CREATE TABLE IF NOT EXISTS bank_account (
    bank_account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_name VARCHAR(255) NOT NULL UNIQUE,
    account_number VARCHAR(100),
    opening_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    activate_date DATE NOT NULL,
    inactivate_date DATE,
    last_transaction TIMESTAMP,
    current_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster searches
CREATE INDEX IF NOT EXISTS idx_bank_account_name ON bank_account(account_name);
CREATE INDEX IF NOT EXISTS idx_bank_account_activate_date ON bank_account(activate_date);
