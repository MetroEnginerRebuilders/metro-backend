const pool = require("../config/database");

class BankAccountRepository {
  // Create new bank account
  async create(accountData) {
    const query = `
      INSERT INTO bank_account (
        account_name, account_number, opening_balance, activate_date, current_balance
      ) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *
    `;
    const result = await pool.query(query, [
      accountData.accountName,
      accountData.accountNumber || null,
      accountData.openingBalance,
      accountData.activateDate,
      accountData.openingBalance // current_balance initially equals opening_balance
    ]);
    return result.rows[0];
  }

  // Get all bank accounts with pagination and search
  async findAll(searchTerm = "", page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    let query = "SELECT * FROM bank_account";
    let countQuery = "SELECT COUNT(*) FROM bank_account";
    let params = [];
    let countParams = [];
    
    if (searchTerm && searchTerm.trim() !== "") {
      const searchCondition = " WHERE account_name ILIKE $1";
      query += searchCondition;
      countQuery += searchCondition;
      const searchParam = `%${searchTerm.trim()}%`;
      params.push(searchParam);
      countParams.push(searchParam);
    }
    
    query += " ORDER BY created_at DESC LIMIT $" + (params.length + 1) + " OFFSET $" + (params.length + 2);
    params.push(limit, offset);
    
    const [dataResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams)
    ]);
    
    return {
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  // Get active bank accounts
  async findActive() {
    const query = `
      SELECT *
      FROM bank_account
      WHERE activate_date <= CURRENT_DATE
        AND (inactivate_date IS NULL OR inactivate_date > CURRENT_DATE)
      ORDER BY account_name ASC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  // Get bank transactions with date range, search and pagination
  async findTransactions({ fromDate, toDate, search = "", page = 1, limit = null }) {
    const offset = limit ? (page - 1) * limit : 0;
    const params = [fromDate, toDate];

    let whereClause = `
      WHERE dt.transaction_date BETWEEN $1::date AND $2::date
    `;

    if (search && search.trim() !== "") {
      params.push(`%${search.trim()}%`);
      whereClause += `
        AND (
          ba.account_name ILIKE $${params.length}
          OR COALESCE(dt.description, '') ILIKE $${params.length}
          OR COALESCE(dt.reference_type, '') ILIKE $${params.length}
          OR COALESCE(ft.finance_type_name, '') ILIKE $${params.length}
          OR COALESCE(fc.finance_category_name, '') ILIKE $${params.length}
          OR CAST(dt.amount AS TEXT) ILIKE $${params.length}
        )
      `;
    }

    const baseQuery = `
      FROM daily_transaction dt
      LEFT JOIN bank_account ba ON dt.bank_account_id = ba.bank_account_id
      LEFT JOIN finance_types ft ON dt.finance_types_id = ft.finance_type_id
      LEFT JOIN finance_categories fc ON dt.finance_categories_id = fc.finance_category_id
      LEFT JOIN customer c ON LOWER(COALESCE(dt.reference_type, '')) = 'customer'
        AND dt.reference_id = c.customer_id
      LEFT JOIN shop sh_ref ON LOWER(COALESCE(dt.reference_type, '')) = 'shop'
        AND dt.reference_id = sh_ref.shop_id
      LEFT JOIN finance f ON LOWER(COALESCE(dt.reference_type, '')) = 'finance'
        AND dt.reference_id = f.finance_id
      LEFT JOIN finance_categories fc_ref ON f.finance_category_id = fc_ref.finance_category_id
      LEFT JOIN invoice_payment ip ON LOWER(COALESCE(dt.reference_type, '')) = 'invoice_payment'
        AND dt.reference_id = ip.invoice_payment_id
      LEFT JOIN invoice inv_ip ON ip.invoice_id = inv_ip.invoice_id
      LEFT JOIN customer c_ip ON inv_ip.customer_id = c_ip.customer_id
      LEFT JOIN invoice inv_direct ON LOWER(COALESCE(dt.reference_type, '')) = 'invoice'
        AND dt.reference_id = inv_direct.invoice_id
      LEFT JOIN customer c_inv ON inv_direct.customer_id = c_inv.customer_id
      LEFT JOIN job j ON LOWER(COALESCE(dt.reference_type, '')) = 'job'
        AND dt.reference_id = j.job_id
      LEFT JOIN customer c_job ON j.customer_id = c_job.customer_id
      LEFT JOIN staff_salary ss ON LOWER(COALESCE(dt.reference_type, '')) = 'salary'
        AND dt.reference_id = ss.staff_salary_id
      LEFT JOIN staff s ON ss.staff_id = s.staff_id
      LEFT JOIN stock_transaction stx ON LOWER(COALESCE(dt.reference_type, '')) = 'stock'
        AND dt.reference_id = stx.stock_transaction_id
      LEFT JOIN shop sh_stock ON stx.shop_id = sh_stock.shop_id
      LEFT JOIN stock_types st ON stx.stock_type_id = st.stock_type_id
      ${whereClause}
    `;

    let dataQuery = `
      SELECT
        dt.transaction_id,
        dt.bank_account_id,
        ba.account_name,
        dt.finance_types_id,
        ft.finance_type_code,
        ft.finance_type_name,
        dt.finance_categories_id,
        fc.finance_category_name,
        dt.reference_type,
        dt.reference_id,
        dt.amount,
        dt.transaction_date,
        COALESCE(
          NULLIF(TRIM(COALESCE(dt.description, '')), ''),
          CASE
            WHEN LOWER(COALESCE(dt.reference_type, '')) = 'customer' THEN
              CASE
                WHEN c.customer_address1 IS NOT NULL AND c.customer_address1 <> ''
                  THEN c.customer_name || ' - ' || c.customer_address1
                ELSE c.customer_name
              END
            WHEN LOWER(COALESCE(dt.reference_type, '')) = 'finance' THEN COALESCE(fc_ref.finance_category_name, fc.finance_category_name)
            WHEN LOWER(COALESCE(dt.reference_type, '')) = 'invoice_payment' THEN COALESCE(
              CASE
                WHEN c_ip.customer_name IS NOT NULL AND c_ip.customer_address1 IS NOT NULL AND c_ip.customer_address1 <> ''
                  THEN c_ip.customer_name || ' - ' || c_ip.customer_address1
                ELSE c_ip.customer_name
              END,
              inv_ip.invoice_number
            )
            WHEN LOWER(COALESCE(dt.reference_type, '')) = 'invoice' THEN COALESCE(
              CASE
                WHEN c_inv.customer_name IS NOT NULL AND c_inv.customer_address1 IS NOT NULL AND c_inv.customer_address1 <> ''
                  THEN c_inv.customer_name || ' - ' || c_inv.customer_address1
                ELSE c_inv.customer_name
              END,
              inv_direct.invoice_number
            )
            WHEN LOWER(COALESCE(dt.reference_type, '')) = 'job' THEN COALESCE(
              CASE
                WHEN c_job.customer_name IS NOT NULL AND c_job.customer_address1 IS NOT NULL AND c_job.customer_address1 <> ''
                  THEN c_job.customer_name || ' - ' || c_job.customer_address1
                ELSE c_job.customer_name
              END,
              j.job_number
            )
            WHEN LOWER(COALESCE(dt.reference_type, '')) = 'shop' THEN
              CASE
                WHEN sh_ref.shop_address IS NOT NULL AND sh_ref.shop_address <> ''
                  THEN sh_ref.shop_name || ' - ' || sh_ref.shop_address
                ELSE sh_ref.shop_name
              END
            WHEN LOWER(COALESCE(dt.reference_type, '')) = 'salary' THEN s.staff_name
            WHEN LOWER(COALESCE(dt.reference_type, '')) = 'stock' THEN COALESCE(sh_stock.shop_name, st.stock_type_name)
            ELSE NULL
          END
        ) AS description,
        dt.created_at
      ${baseQuery}
      ORDER BY dt.transaction_date DESC, dt.created_at DESC
    `;

    const dataParams = [...params];
    if (limit) {
      dataQuery += `\n      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      dataParams.push(limit, offset);
    }

    const countQuery = `
      SELECT COUNT(*)::INT AS total
      ${baseQuery}
    `;

    const summaryQuery = `
      SELECT
        COALESCE(SUM(CASE WHEN ft.finance_type_code = 'INCOME' THEN dt.amount ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN ft.finance_type_code = 'EXPENSE' THEN dt.amount ELSE 0 END), 0) AS total_expense
      ${baseQuery}
    `;

    const [dataResult, countResult, summaryResult] = await Promise.all([
      pool.query(dataQuery, dataParams),
      pool.query(countQuery, params),
      pool.query(summaryQuery, params),
    ]);

    const summary = summaryResult.rows[0] || {};

    return {
      data: dataResult.rows.map((row) => ({
        ...row,
        amount: Number(row.amount) || 0,
      })),
      total: countResult.rows[0]?.total || 0,
      summary: {
        total_income: Number(summary.total_income) || 0,
        total_expense: Number(summary.total_expense) || 0,
      },
    };
  }

  // Get bank account by ID
  async findById(bankAccountId) {
    const query = "SELECT * FROM bank_account WHERE bank_account_id = $1";
    const result = await pool.query(query, [bankAccountId]);
    return result.rows[0];
  }

  // Check if account name already exists (for validation)
  async findByName(accountName) {
    const query = "SELECT * FROM bank_account WHERE account_name = $1";
    const result = await pool.query(query, [accountName]);
    return result.rows[0];
  }

  // Update bank account
  async update(bankAccountId, accountData) {
    const query = `
      UPDATE bank_account 
      SET account_name = $1, 
          account_number = $2,
          opening_balance = $3, 
          activate_date = $4, 
          inactivate_date = $5,
          updated_at = NOW() 
      WHERE bank_account_id = $6 
      RETURNING *
    `;
    const result = await pool.query(query, [
      accountData.accountName,
      accountData.accountNumber || null,
      accountData.openingBalance,
      accountData.activateDate,
      accountData.inactivateDate || null,
      bankAccountId
    ]);
    return result.rows[0];
  }

  // Delete bank account
  async delete(bankAccountId) {
    const query = "DELETE FROM bank_account WHERE bank_account_id = $1 RETURNING *";
    const result = await pool.query(query, [bankAccountId]);
    return result.rows[0];
  }

  // Account transfer
  async transfer(transferData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get from account
      const fromAccountQuery = "SELECT * FROM bank_account WHERE bank_account_id = $1 FOR UPDATE";
      const fromAccountResult = await client.query(fromAccountQuery, [transferData.fromAccountId]);
      const fromAccount = fromAccountResult.rows[0];

      if (!fromAccount) {
        throw new Error("From account not found");
      }

      // Check if from account has sufficient balance
      if (parseFloat(fromAccount.current_balance) < parseFloat(transferData.amount)) {
        throw new Error("Insufficient balance in from account");
      }

      // Get to account
      const toAccountQuery = "SELECT * FROM bank_account WHERE bank_account_id = $1 FOR UPDATE";
      const toAccountResult = await client.query(toAccountQuery, [transferData.toAccountId]);
      const toAccount = toAccountResult.rows[0];

      if (!toAccount) {
        throw new Error("To account not found");
      }

      // Update from account - subtract amount
      const updateFromQuery = `
        UPDATE bank_account 
        SET current_balance = current_balance - $1,
            last_transaction = $2,
            updated_at = NOW()
        WHERE bank_account_id = $3
        RETURNING *
      `;
      const updatedFromAccount = await client.query(updateFromQuery, [
        transferData.amount,
        transferData.transferDate,
        transferData.fromAccountId
      ]);

      // Update to account - add amount
      const updateToQuery = `
        UPDATE bank_account 
        SET current_balance = current_balance + $1,
            last_transaction = $2,
            updated_at = NOW()
        WHERE bank_account_id = $3
        RETURNING *
      `;
      const updatedToAccount = await client.query(updateToQuery, [
        transferData.amount,
        transferData.transferDate,
        transferData.toAccountId
      ]);

      await client.query('COMMIT');

      return {
        fromAccount: updatedFromAccount.rows[0],
        toAccount: updatedToAccount.rows[0]
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Add amount to bank account (for income)
  async addBalance(bankAccountId, amount, transactionDate) {
    const query = `
      UPDATE bank_account 
      SET current_balance = current_balance + $1,
          last_transaction = $2,
          updated_at = NOW()
      WHERE bank_account_id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [amount, transactionDate, bankAccountId]);
    return result.rows[0];
  }

  // Subtract amount from bank account (for expense)
  async subtractBalance(bankAccountId, amount, transactionDate) {
    const query = `
      UPDATE bank_account 
      SET current_balance = current_balance - $1,
          last_transaction = $2,
          updated_at = NOW()
      WHERE bank_account_id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [amount, transactionDate, bankAccountId]);
    return result.rows[0];
  }
}

module.exports = new BankAccountRepository();
