-- Create staff_salary table with UUID primary key
CREATE TABLE IF NOT EXISTS staff_salary (
    staff_salary_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL,
    bank_account_id UUID NOT NULL,
    effective_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    salary_type_id UUID NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_staff FOREIGN KEY (staff_id) 
        REFERENCES staff(staff_id) 
        ON DELETE RESTRICT,
    CONSTRAINT fk_bank_account FOREIGN KEY (bank_account_id) 
        REFERENCES bank_account(bank_account_id) 
        ON DELETE RESTRICT,
    CONSTRAINT fk_salary_type FOREIGN KEY (salary_type_id) 
        REFERENCES salary_type(salary_type_id) 
        ON DELETE RESTRICT
);

-- Create indexes for faster searches
CREATE INDEX IF NOT EXISTS idx_staff_salary_staff_id ON staff_salary(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_salary_bank_account_id ON staff_salary(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_staff_salary_effective_date ON staff_salary(effective_date);
