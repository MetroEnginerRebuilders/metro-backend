-- Create stock_payment table with UUID primary key
CREATE TABLE IF NOT EXISTS stock_payment (
    stock_payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_transaction_id UUID NOT NULL,
    stock_type_id UUID NOT NULL,
    bank_account_id UUID NOT NULL,
    amount_paid DECIMAL(15, 2) NOT NULL DEFAULT 0,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    payment_on DATE NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_stock_payment_stock_transaction FOREIGN KEY (stock_transaction_id)
        REFERENCES stock_transaction(stock_transaction_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_stock_payment_stock_type FOREIGN KEY (stock_type_id)
        REFERENCES stock_types(stock_type_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_stock_payment_bank_account FOREIGN KEY (bank_account_id)
        REFERENCES bank_account(bank_account_id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_stock_payment_amount_paid_non_negative CHECK (amount_paid >= 0),
    CONSTRAINT chk_stock_payment_status CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'pending'))
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_stock_payment_stock_transaction_id ON stock_payment(stock_transaction_id);
CREATE INDEX IF NOT EXISTS idx_stock_payment_stock_type_id ON stock_payment(stock_type_id);
CREATE INDEX IF NOT EXISTS idx_stock_payment_bank_account_id ON stock_payment(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_stock_payment_payment_on ON stock_payment(payment_on);
CREATE INDEX IF NOT EXISTS idx_stock_payment_status ON stock_payment(payment_status);
