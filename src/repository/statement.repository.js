const pool = require("../config/database");

class StatementRepository {
  async getShopStatement(shopId) {
    const query = `
      SELECT
        sti.stock_transaction_item_id AS transaction_id,
        st.stock_transaction_id AS reference_id,
        st.order_date AS transaction_date,
        st.shop_id,
        s.shop_name,
        stt.stock_type_code,
        stt.stock_type_name,
        c.company_name,
        m.model_name,
        sp.spare_name,
        sti.quantity,
        sti.price,
        (COALESCE(sti.quantity, 0) * COALESCE(sti.price, 0)) AS amount,
        CASE
          WHEN stt.stock_type_code = 'PURCHASE' THEN 'expense'
          WHEN stt.stock_type_code = 'RETURN' THEN 'income'
          ELSE 'expense'
        END AS entry_type,
        CASE
          WHEN stt.stock_type_code = 'PURCHASE' THEN 'purchase stock'
          WHEN stt.stock_type_code = 'RETURN' AND st.shop_id IS NULL THEN 'stock sale'
          WHEN stt.stock_type_code = 'RETURN' AND st.shop_id IS NOT NULL THEN 'return stock'
          ELSE LOWER(COALESCE(stt.stock_type_name, 'stock'))
        END AS transaction_type,
        CASE
          WHEN stt.stock_type_code = 'RETURN' AND st.shop_id IS NULL THEN 'company payment'
          ELSE NULL
        END AS payment_type,
        st.description
      FROM stock_transaction_items sti
      INNER JOIN stock_transaction st
        ON sti.stock_transaction_id = st.stock_transaction_id
      INNER JOIN stock_types stt
        ON st.stock_type_id = stt.stock_type_id
      LEFT JOIN shop s
        ON st.shop_id = s.shop_id
      LEFT JOIN company c
        ON sti.company_id = c.company_id
      LEFT JOIN model m
        ON sti.model_id = m.model_id
      LEFT JOIN spare sp
        ON sti.spare_id = sp.spare_id
      WHERE st.shop_id = $1
         OR (st.shop_id IS NULL AND stt.stock_type_code = 'RETURN')
      ORDER BY st.order_date DESC, st.created_at DESC, sti.stock_transaction_item_id DESC
    `;

    const result = await pool.query(query, [shopId]);

    return result.rows.map((row) => ({
      transaction_id: row.transaction_id,
      reference_id: row.reference_id,
      transaction_date: row.transaction_date,
      transaction_type: row.transaction_type,
      entry_type: row.entry_type,
      payment_type: row.payment_type,
      amount: Number(row.amount) || 0,
      quantity: Number(row.quantity) || 0,
      unit_price: Number(row.price) || 0,
      description: !row.shop_id
        ? "Company Payment"
        : row.stock_type_code === "PURCHASE"
          ? "Stock Purchase Order"
          : row.stock_type_code === "RETURN"
            ? "Stock Return Order"
            : row.description || null,
      company_name: row.company_name || null,
      model_name: row.model_name || null,
      spare_name: row.spare_name || null,
      shop_name: row.shop_name || null,
      stock_type: row.stock_type_name || null,
    }));
  }

  async getCustomerStatement(customerId) {
    const query = `
      WITH remarks_summary AS (
        SELECT
          ii.invoice_id,
          STRING_AGG(ii.remarks, '/' ORDER BY ii.created_at) FILTER (
            WHERE ii.remarks IS NOT NULL AND ii.remarks <> ''
          ) AS item_remarks
        FROM invoice_items ii
        GROUP BY ii.invoice_id
      ),
      payment_summary AS (
        SELECT
          ip.invoice_id,
          COALESCE(SUM(ip.amount_paid), 0) AS paid_amount,
          MAX(ip.payment_date) AS last_payment_date
        FROM invoice_payment ip
        GROUP BY ip.invoice_id
      ),
      invoice_base AS (
        SELECT
          inv.invoice_id,
          inv.invoice_number,
          inv.invoice_date,
          COALESCE(inv.total_amount, 0) AS total_amount,
          inv.job_id,
          j.job_number,
          j.customer_id,
          j.received_items,
          COALESCE(ps.paid_amount, 0) AS paid_amount,
          ps.last_payment_date,
          rs.item_remarks
        FROM invoice inv
        INNER JOIN job j
          ON inv.job_id = j.job_id
        LEFT JOIN payment_summary ps
          ON inv.invoice_id = ps.invoice_id
        LEFT JOIN remarks_summary rs
          ON inv.invoice_id = rs.invoice_id
        WHERE j.customer_id = $1
      )
      SELECT
        out_rows.transaction_id,
        out_rows.reference_id,
        out_rows.transaction_date,
        out_rows.transaction_type,
        out_rows.entry_type,
        out_rows.amount,
        out_rows.description,
        out_rows.received_items
      FROM (
        SELECT
          j.job_id AS transaction_id,
          j.job_id AS reference_id,
          j.start_date AS transaction_date,
          'job-advance'::text AS transaction_type,
          'income'::text AS entry_type,
          COALESCE(j.advance_amount, 0)::numeric AS amount,
          COALESCE(j.job_number) AS description,
          j.received_items
        FROM job j
        WHERE j.customer_id = $1
          AND COALESCE(j.advance_amount, 0) > 0

        UNION ALL

        SELECT
          ib.invoice_id AS transaction_id,
          ib.invoice_id AS reference_id,
          COALESCE(ib.last_payment_date, ib.invoice_date) AS transaction_date,
          ('invoice-' || COALESCE(ib.invoice_number, 'unknown'))::text AS transaction_type,
          'income'::text AS entry_type,
          LEAST(ib.paid_amount, ib.total_amount)::numeric AS amount,
          COALESCE(ib.job_number, ib.job_id::text) AS description,
          ib.received_items
        FROM invoice_base ib
        WHERE ib.paid_amount > 0

        UNION ALL

        SELECT
          ib.invoice_id AS transaction_id,
          ib.invoice_id AS reference_id,
          ib.invoice_date AS transaction_date,
          ('invoice-' || COALESCE(ib.invoice_number, 'unknown'))::text AS transaction_type,
          'expense'::text AS entry_type,
          GREATEST(ib.total_amount - ib.paid_amount, 0)::numeric AS amount,
          COALESCE(ib.item_remarks, '')::text AS description,
          ib.received_items
        FROM invoice_base ib
        WHERE (ib.total_amount - ib.paid_amount) > 0
      ) AS out_rows
      ORDER BY out_rows.transaction_date DESC, out_rows.transaction_id DESC
    `;

    const result = await pool.query(query, [customerId]);

    return result.rows.map((row) => ({
      transaction_id: row.transaction_id,
      reference_id: row.reference_id,
      transaction_date: row.transaction_date,
      transaction_type: row.transaction_type,
      entry_type: row.entry_type || null,
      amount: Number(row.amount) || 0,
      description: row.description || null,
      received_items: row.received_items || null,
    }));
  }
}

module.exports = new StatementRepository();
