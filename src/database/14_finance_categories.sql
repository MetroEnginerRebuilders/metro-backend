-- Create finance_categories table with UUID primary key
CREATE TABLE IF NOT EXISTS finance_categories (
    finance_category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finance_category_name VARCHAR(255) NOT NULL,
    finance_type_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_finance_type FOREIGN KEY (finance_type_id) 
        REFERENCES finance_types(finance_type_id) 
        ON DELETE RESTRICT
);

-- Create indexes for faster searches
CREATE INDEX IF NOT EXISTS idx_finance_category_name ON finance_categories(finance_category_name);
CREATE INDEX IF NOT EXISTS idx_finance_category_type_id ON finance_categories(finance_type_id);

-- Insert default finance categories
-- Income categories
INSERT INTO finance_categories (finance_category_name, finance_type_id)
SELECT 'Lathe Work', finance_type_id FROM finance_types WHERE finance_type_code = 'INCOME'
ON CONFLICT DO NOTHING;

INSERT INTO finance_categories (finance_category_name, finance_type_id)
SELECT 'Spare Sale', finance_type_id FROM finance_types WHERE finance_type_code = 'INCOME'
ON CONFLICT DO NOTHING;

INSERT INTO finance_categories (finance_category_name, finance_type_id)
SELECT 'Coupon', finance_type_id FROM finance_types WHERE finance_type_code = 'INCOME'
ON CONFLICT DO NOTHING;

INSERT INTO finance_categories (finance_category_name, finance_type_id)
SELECT 'Kari Oil Sale', finance_type_id FROM finance_types WHERE finance_type_code = 'INCOME'
ON CONFLICT DO NOTHING;

INSERT INTO finance_categories (finance_category_name, finance_type_id)
SELECT 'Scrap Sale', finance_type_id FROM finance_types WHERE finance_type_code = 'INCOME'
ON CONFLICT DO NOTHING;

INSERT INTO finance_categories (finance_category_name, finance_type_id)
SELECT 'Stock Sale', finance_type_id FROM finance_types WHERE finance_type_code = 'INCOME'
ON CONFLICT DO NOTHING;

-- Expense categories
INSERT INTO finance_categories (finance_category_name, finance_type_id)
SELECT 'Food', finance_type_id FROM finance_types WHERE finance_type_code = 'EXPENSE'
ON CONFLICT DO NOTHING;

INSERT INTO finance_categories (finance_category_name, finance_type_id)
SELECT 'Stationary', finance_type_id FROM finance_types WHERE finance_type_code = 'EXPENSE'
ON CONFLICT DO NOTHING;

INSERT INTO finance_categories (finance_category_name, finance_type_id)
SELECT 'Petrol', finance_type_id FROM finance_types WHERE finance_type_code = 'EXPENSE'
ON CONFLICT DO NOTHING;

INSERT INTO finance_categories (finance_category_name, finance_type_id)
SELECT 'Field', finance_type_id FROM finance_types WHERE finance_type_code = 'EXPENSE'
ON CONFLICT DO NOTHING;

INSERT INTO finance_categories (finance_category_name, finance_type_id)
SELECT 'Parcel', finance_type_id FROM finance_types WHERE finance_type_code = 'EXPENSE'
ON CONFLICT DO NOTHING;

INSERT INTO finance_categories (finance_category_name, finance_type_id)
SELECT 'Material', finance_type_id FROM finance_types WHERE finance_type_code = 'EXPENSE'
ON CONFLICT DO NOTHING;

INSERT INTO finance_categories (finance_category_name, finance_type_id)
SELECT 'Auto', finance_type_id FROM finance_types WHERE finance_type_code = 'EXPENSE'
ON CONFLICT DO NOTHING;

INSERT INTO finance_categories (finance_category_name, finance_type_id)
SELECT 'Commission', finance_type_id FROM finance_types WHERE finance_type_code = 'EXPENSE'
ON CONFLICT DO NOTHING;

INSERT INTO finance_categories (finance_category_name, finance_type_id)
SELECT 'Mobile', finance_type_id FROM finance_types WHERE finance_type_code = 'EXPENSE'
ON CONFLICT DO NOTHING;

INSERT INTO finance_categories (finance_category_name, finance_type_id)
SELECT 'Other Expenses', finance_type_id FROM finance_types WHERE finance_type_code = 'EXPENSE'
ON CONFLICT DO NOTHING;
