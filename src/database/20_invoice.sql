-- Create invoice table with UUID primary key
CREATE TABLE IF NOT EXISTS invoice (
    invoice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    job_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    invoice_date DATE NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    invoice_status VARCHAR(50) NOT NULL DEFAULT 'draft',
    payment_status VARCHAR(50) NOT NULL DEFAULT 'unpaid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_invoice_job FOREIGN KEY (job_id)
        REFERENCES job(job_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_invoice_customer FOREIGN KEY (customer_id)
        REFERENCES customer(customer_id)
        ON DELETE RESTRICT
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoice_number ON invoice(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoice_job_id ON invoice(job_id);
CREATE INDEX IF NOT EXISTS idx_invoice_customer_id ON invoice(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoice_date ON invoice(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoice_status ON invoice(invoice_status);
CREATE INDEX IF NOT EXISTS idx_payment_status ON invoice(payment_status);
