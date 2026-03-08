CREATE TABLE IF NOT EXISTS stock_credit_ledger (
    credit_ledger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL,
    stock_transaction_id UUID,
    entry_type VARCHAR(30) NOT NULL, -- RETURN_CREDIT, PURCHASE_ADJUSTMENT, MANUAL_CREDIT, MANUAL_DEBIT
    amount DECIMAL(15, 2) NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_stock_credit_ledger_shop FOREIGN KEY (shop_id)
        REFERENCES shop(shop_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_stock_credit_ledger_stock_transaction FOREIGN KEY (stock_transaction_id)
        REFERENCES stock_transaction(stock_transaction_id)
        ON DELETE SET NULL,

    CONSTRAINT chk_stock_credit_ledger_entry_type
        CHECK (entry_type IN ('RETURN_CREDIT', 'PURCHASE_ADJUSTMENT', 'MANUAL_CREDIT', 'MANUAL_DEBIT')),

    CONSTRAINT chk_stock_credit_ledger_amount_positive
        CHECK (amount > 0)
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_stock_credit_ledger_shop_id
    ON stock_credit_ledger(shop_id);

CREATE INDEX IF NOT EXISTS idx_stock_credit_ledger_stock_transaction_id
    ON stock_credit_ledger(stock_transaction_id);

CREATE INDEX IF NOT EXISTS idx_stock_credit_ledger_entry_type
    ON stock_credit_ledger(entry_type);

CREATE INDEX IF NOT EXISTS idx_stock_credit_ledger_created_at
    ON stock_credit_ledger(created_at);