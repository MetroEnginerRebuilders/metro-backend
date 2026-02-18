const pool = require("../config/database");

class JobRepository {
  async findAll(searchTerm = "", page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        j.*, 
        c.customer_name,
        c.customer_number,
        ba.account_name
      FROM job j
      LEFT JOIN customer c ON j.customer_id = c.customer_id
      LEFT JOIN bank_account ba ON j.bank_account_id = ba.bank_account_id
    `;
    let countQuery = "SELECT COUNT(*) FROM job j";
    let params = [];
    let countParams = [];

    if (searchTerm && searchTerm.trim() !== "") {
      const searchCondition = `
        WHERE j.job_number ILIKE $1
          OR c.customer_name ILIKE $1
          OR c.customer_number ILIKE $1
          OR j.description ILIKE $1
          OR j.status ILIKE $1
          OR j.received_items ILIKE $1
      `;
      query += searchCondition;
      countQuery += `
        LEFT JOIN customer c ON j.customer_id = c.customer_id
        ${searchCondition}
      `;
      const searchParam = `%${searchTerm.trim()}%`;
      params.push(searchParam);
      countParams.push(searchParam);
    }

    query += " ORDER BY j.created_at DESC LIMIT $" + (params.length + 1) + " OFFSET $" + (params.length + 2);
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

  async createWithInvoice(jobData) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const year = new Date().getFullYear();
      const jobNumberResult = await client.query(
        `
        SELECT job_number
        FROM job
        WHERE job_number LIKE $1
        ORDER BY job_number DESC
        LIMIT 1
        FOR UPDATE
        `,
        [`${year}/J%`]
      );

      let nextJobSequence = 1;
      if (jobNumberResult.rows.length > 0) {
        const lastJobNumber = jobNumberResult.rows[0].job_number;
        const match = lastJobNumber.match(/\/J(\d+)$/);
        if (match) {
          nextJobSequence = parseInt(match[1], 10) + 1;
        }
      }

      const jobNumber = `${year}/J${String(nextJobSequence).padStart(4, "0")}`;

      const jobInsertResult = await client.query(
        `
        INSERT INTO job (
          job_number,
          customer_id,
          description,
          advance_amount,
          bank_account_id,
          received_items,
          start_date,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [
          jobNumber,
          jobData.customer_id,
          jobData.description || null,
          jobData.advance_amount || 0,
          jobData.bank_account_id || null,
          jobData.received_items || null,
          jobData.start_date,
          "pending",
        ]
      );

      const job = jobInsertResult.rows[0];

      if (jobData.bank_account_id && Number(jobData.advance_amount) > 0) {
        await client.query(
          `
          UPDATE bank_account
          SET current_balance = current_balance + $1,
              last_transaction = $2,
              updated_at = NOW()
          WHERE bank_account_id = $3
          `,
          [jobData.advance_amount, jobData.start_date, jobData.bank_account_id]
        );
      }

      const invoiceNumberResult = await client.query(
        `
        SELECT invoice_number
        FROM invoice
        ORDER BY invoice_number DESC
        LIMIT 1
        FOR UPDATE
        `
      );

      let nextInvoiceSequence = 0;
      if (invoiceNumberResult.rows.length > 0) {
        const lastInvoiceNumber = invoiceNumberResult.rows[0].invoice_number;
        const match = lastInvoiceNumber.match(/^INV(\d+)$/);
        if (match) {
          nextInvoiceSequence = parseInt(match[1], 10) + 1;
        }
      }

      const invoiceNumber = `INV${String(nextInvoiceSequence).padStart(4, "0")}`;

      const invoiceInsertResult = await client.query(
        `
        INSERT INTO invoice (
          invoice_number,
          job_id,
          customer_id,
          invoice_date,
          total_amount,
          invoice_status,
          payment_status
        ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6)
        RETURNING *
        `,
        [invoiceNumber, job.job_id, job.customer_id, 0, "open", "unpaid"]
      );

      const invoice = invoiceInsertResult.rows[0];

      await client.query("COMMIT");

      return { job, invoice };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new JobRepository();
