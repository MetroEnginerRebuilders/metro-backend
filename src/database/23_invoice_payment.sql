-- Create invoice_payment table with UUID primary key
CREATE TABLE IF NOT EXISTS invoice_payment (
    invoice_payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL,
    bank_account_id UUID NOT NULL,
    amount_paid DECIMAL(15, 2) NOT NULL DEFAULT 0,
    remarks TEXT,
    payment_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_invoice_payment_invoice FOREIGN KEY (invoice_id)
        REFERENCES invoice(invoice_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_invoice_payment_bank_account FOREIGN KEY (bank_account_id)
        REFERENCES bank_account(bank_account_id)
        ON DELETE RESTRICT
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoice_payment_invoice_id ON invoice_payment(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payment_bank_account_id ON invoice_payment(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payment_date ON invoice_payment(payment_date);
CREATE INDEX IF NOT EXISTS idx_invoice_payment_status ON invoice_payment(status);
