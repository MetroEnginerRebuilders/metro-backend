-- Create invoice_items table with UUID primary key
CREATE TABLE IF NOT EXISTS invoice_items (
    invoice_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL,
    item_type_id UUID NOT NULL,
    work_id UUID,
    spare_id UUID,
    remarks TEXT,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    total_price DECIMAL(15, 2) NOT NULL,
    company_id UUID,
    model_id UUID,
    finance_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id)
        REFERENCES invoice(invoice_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_invoice_items_work FOREIGN KEY (work_id)
        REFERENCES work(work_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_invoice_items_spare FOREIGN KEY (spare_id)
        REFERENCES spare(spare_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_invoice_items_company FOREIGN KEY (company_id)
        REFERENCES company(company_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_invoice_items_model FOREIGN KEY (model_id)
        REFERENCES model(model_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_invoice_items_finance 
        FOREIGN KEY (finance_id) 
        REFERENCES finance(finance_id) 
        ON DELETE SET NULL
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_item_type_id ON invoice_items(item_type_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_work_id ON invoice_items(work_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_spare_id ON invoice_items(spare_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_company_id ON invoice_items(company_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_model_id ON invoice_items(model_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_finance_id ON invoice_items(finance_id);

