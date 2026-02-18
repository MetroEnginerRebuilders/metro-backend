-- Create job table with UUID primary key
CREATE TABLE IF NOT EXISTS job (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL,
    description TEXT,
    advance_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    bank_account_id UUID,
    received_items TEXT,
    start_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_job_customer FOREIGN KEY (customer_id)
        REFERENCES customer(customer_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_job_bank_account FOREIGN KEY (bank_account_id)
        REFERENCES bank_account(bank_account_id)
        ON DELETE RESTRICT
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_job_number ON job(job_number);
CREATE INDEX IF NOT EXISTS idx_job_customer_id ON job(customer_id);
CREATE INDEX IF NOT EXISTS idx_job_bank_account_id ON job(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_job_start_date ON job(start_date);
CREATE INDEX IF NOT EXISTS idx_job_status ON job(status);
