-- Create staff table with UUID primary key
CREATE TABLE IF NOT EXISTS staff (
    staff_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_name VARCHAR(255) NOT NULL,
    salary DECIMAL(15, 2),
    active_date DATE NOT NULL,
    inactive_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster searches
CREATE INDEX IF NOT EXISTS idx_staff_name ON staff(staff_name);
CREATE INDEX IF NOT EXISTS idx_staff_active_date ON staff(active_date);
