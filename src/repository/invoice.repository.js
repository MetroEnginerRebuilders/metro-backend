const pool = require("../config/database");

class InvoiceRepository {
  async findCustomerByInvoiceId(invoiceId) {
    const query = `
      SELECT c.*
      FROM invoice i
      INNER JOIN customer c ON i.customer_id = c.customer_id
      WHERE i.invoice_id = $1
    `;
    const result = await pool.query(query, [invoiceId]);
    return result.rows[0];
  }

  async findJobByInvoiceId(invoiceId) {
    const query = `
      SELECT j.*
      FROM invoice i
      INNER JOIN job j ON i.job_id = j.job_id
      WHERE i.invoice_id = $1
    `;
    const result = await pool.query(query, [invoiceId]);
    return result.rows[0];
  }

  async findById(invoiceId) {
    const query = `
      SELECT 
        i.*, 
        c.customer_name,
        c.customer_number,
        j.job_number
      FROM invoice i
      LEFT JOIN customer c ON i.customer_id = c.customer_id
      LEFT JOIN job j ON i.job_id = j.job_id
      WHERE i.invoice_id = $1
    `;
    const result = await pool.query(query, [invoiceId]);
    return result.rows[0];
  }

  async findDetailsByInvoiceId(invoiceId) {
    const query = `
      SELECT
        i.invoice_id AS invoice_id,
        i.invoice_number AS invoice_number,
        i.job_id AS invoice_job_id,
        i.customer_id AS invoice_customer_id,
        i.invoice_date AS invoice_date,
        i.total_amount AS invoice_total_amount,
        i.invoice_status AS invoice_status,
        i.payment_status AS invoice_payment_status,
        i.created_at AS invoice_created_at,
        i.updated_at AS invoice_updated_at,
        j.job_id AS job_id,
        j.job_number AS job_number,
        j.customer_id AS job_customer_id,
        j.description AS job_description,
        j.advance_amount AS job_advance_amount,
        j.bank_account_id AS job_bank_account_id,
        j.received_items AS job_received_items,
        j.start_date AS job_start_date,
        j.status AS job_status,
        j.created_at AS job_created_at,
        j.updated_at AS job_updated_at,
        c.customer_id AS customer_id,
        c.customer_number AS customer_number,
        c.customer_name AS customer_name,
        c.customer_address1 AS customer_address1,
        c.customer_address2 AS customer_address2,
        c.customer_phone_number AS customer_phone_number,
        c.customer_type_id AS customer_type_id,
        c.created_at AS customer_created_at,
        c.updated_at AS customer_updated_at
      FROM invoice i
      INNER JOIN job j ON i.job_id = j.job_id
      INNER JOIN customer c ON i.customer_id = c.customer_id
      WHERE i.invoice_id = $1
    `;
    const result = await pool.query(query, [invoiceId]);
    return result.rows[0];
  }

  async findItemsByInvoiceId(invoiceId) {
    const query = `
      SELECT
        ii.invoice_item_id,
        ii.invoice_id,
        ii.item_type_id,
        ii.work_id,
        ii.spare_id,
        ii.remarks,
        ii.quantity,
        ii.unit_price,
        ii.total_price,
        ii.company_id,
        ii.model_id,
        ii.created_at,
        ii.updated_at,
        it.item_type_name,
        it.item_type_code,
        c.company_name,
        s.spare_name,
        m.model_name
      FROM invoice_items ii
      LEFT JOIN item_types it ON ii.item_type_id = it.item_type_id
      LEFT JOIN company c ON ii.company_id = c.company_id
      LEFT JOIN spare s ON ii.spare_id = s.spare_id
      LEFT JOIN model m ON ii.model_id = m.model_id
      WHERE ii.invoice_id = $1
      ORDER BY ii.created_at ASC
    `;
    const result = await pool.query(query, [invoiceId]);
    return result.rows;
  }

  async findAll(searchTerm = "", page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        i.*, 
        c.customer_name,
        c.customer_number,
        j.job_number
      FROM invoice i
      LEFT JOIN customer c ON i.customer_id = c.customer_id
      LEFT JOIN job j ON i.job_id = j.job_id
    `;
    let countQuery = "SELECT COUNT(*) FROM invoice i";
    let params = [];
    let countParams = [];

    if (searchTerm && searchTerm.trim() !== "") {
      const searchCondition = `
        WHERE i.invoice_number ILIKE $1
          OR c.customer_name ILIKE $1
          OR c.customer_number ILIKE $1
          OR j.job_number ILIKE $1
          OR i.invoice_status ILIKE $1
          OR i.payment_status ILIKE $1
      `;
      query += searchCondition;
      countQuery += `
        LEFT JOIN customer c ON i.customer_id = c.customer_id
        LEFT JOIN job j ON i.job_id = j.job_id
        ${searchCondition}
      `;
      const searchParam = `%${searchTerm.trim()}%`;
      params.push(searchParam);
      countParams.push(searchParam);
    }

    query += " ORDER BY i.created_at DESC LIMIT $" + (params.length + 1) + " OFFSET $" + (params.length + 2);
    params.push(limit, offset);

    const [dataResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams),
    ]);

    return {
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].count),
    };
  }
}

module.exports = new InvoiceRepository();
