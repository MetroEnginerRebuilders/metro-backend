const pool = require("../config/database");

class DailyTransactionRepository {
  async getFinanceTypeIdByCode(financeTypeCode, client = null) {
    const executor = client || pool;
    const query = `
      SELECT finance_type_id
      FROM finance_types
      WHERE finance_type_code = $1
      LIMIT 1
    `;
    const result = await executor.query(query, [financeTypeCode]);
    return result.rows[0]?.finance_type_id || null;
  }

  async create(entry, client = null) {
    const executor = client || pool;
    const query = `
      INSERT INTO daily_transaction (
        shop_id,
        finance_types_id,
        finance_categories_id,
        reference_type,
        reference_id,
        bank_account_id,
        amount,
        transaction_date,
        description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      entry.shop_id || null,
      entry.finance_types_id || null,
      entry.finance_categories_id || null,
      entry.reference_type || null,
      entry.reference_id || null,
      entry.bank_account_id || null,
      Number(entry.amount) || 0,
      entry.transaction_date,
      entry.description || null,
    ];

    const result = await executor.query(query, values);
    return result.rows[0];
  }

  async deleteByReference(referenceType, referenceId, client = null) {
    const executor = client || pool;
    const query = `
      DELETE FROM daily_transaction
      WHERE reference_type = $1
        AND reference_id = $2
    `;
    await executor.query(query, [referenceType, referenceId]);
  }

  async getIncomeExpenseTotalsByDateRange(fromDate, toDate) {
    const totalsQuery = `
      SELECT
        COALESCE(
          SUM(CASE WHEN ft.finance_type_code = 'INCOME' THEN dt.amount ELSE 0 END),
          0
        ) AS total_income,
        COALESCE(
          SUM(CASE WHEN ft.finance_type_code = 'EXPENSE' THEN dt.amount ELSE 0 END),
          0
        ) AS total_expense
      FROM daily_transaction dt
      LEFT JOIN finance_types ft
        ON dt.finance_types_id = ft.finance_type_id
      WHERE dt.transaction_date BETWEEN $1::date AND $2::date
    `;

    const totalsResult = await pool.query(totalsQuery, [fromDate, toDate]);
    const selectedPeriod = totalsResult.rows[0] || {};
    const totalIncome = Number(selectedPeriod.total_income) || 0;
    const totalExpense = Number(selectedPeriod.total_expense) || 0;

    return {
      from_date: fromDate,
      to_date: toDate,
      total_income: totalIncome,
      total_expense: totalExpense,
      net_amount: totalIncome - totalExpense,
    };
  }

  async getMonthlyIncomeExpenseByYear(year) {
    const monthlyQuery = `
      WITH month_series AS (
        SELECT generate_series(1, 12) AS month_num
      )
      SELECT
        ms.month_num,
        to_char(make_date($1::int, ms.month_num, 1), 'Mon') AS month_label,
        COALESCE(
          SUM(CASE WHEN ft.finance_type_code = 'INCOME' THEN dt.amount ELSE 0 END),
          0
        ) AS total_income,
        COALESCE(
          SUM(CASE WHEN ft.finance_type_code = 'EXPENSE' THEN dt.amount ELSE 0 END),
          0
        ) AS total_expense
      FROM month_series ms
      LEFT JOIN daily_transaction dt
        ON EXTRACT(YEAR FROM dt.transaction_date)::int = $1::int
       AND EXTRACT(MONTH FROM dt.transaction_date) = ms.month_num
      LEFT JOIN finance_types ft
        ON dt.finance_types_id = ft.finance_type_id
      GROUP BY ms.month_num
      ORDER BY ms.month_num ASC
    `;

    const result = await pool.query(monthlyQuery, [year]);

    const monthlyData = result.rows.map((row) => ({
      month: Number(row.month_num),
      month_label: row.month_label,
      total_income: Number(row.total_income) || 0,
      total_expense: Number(row.total_expense) || 0,
    }));

    return {
      year,
      monthly_data: monthlyData,
    };
  }

  async getTransactionsByDateRangeByFinanceType(fromDate, toDate, financeTypeCode) {
    const financeTypeId = await this.getFinanceTypeIdByCode(financeTypeCode);

    if (!financeTypeId) {
      return [];
    }

    const query = `
      SELECT
        dt.transaction_id,
        dt.shop_id,
        dt.finance_types_id,
        dt.finance_categories_id,
        CASE
          WHEN LOWER(COALESCE(dt.reference_type, '')) = 'finance' THEN COALESCE(fc_fin.finance_category_name, fc.finance_category_name)
          ELSE dt.reference_type
        END AS reference_type,
        dt.reference_id,
        dt.bank_account_id,
        dt.amount,
        dt.transaction_date,
        dt.description,
        dt.created_at,
        ft.finance_type_code,
        ft.finance_type_name,
        fc.finance_category_name,
        ba.account_name,
        CASE
          WHEN LOWER(COALESCE(dt.reference_type, '')) = 'customer' THEN
            CASE
              WHEN c.customer_address1 IS NOT NULL AND c.customer_address1 <> ''
                THEN c.customer_name || ' - ' || c.customer_address1
              ELSE c.customer_name
            END
          WHEN LOWER(COALESCE(dt.reference_type, '')) = 'finance' THEN
            CASE
              WHEN LOWER(COALESCE(fc_fin.finance_category_name, fc.finance_category_name, '')) = 'commission'
               AND ft.finance_type_code = 'EXPENSE'
               AND dt.description IS NOT NULL
               AND dt.description <> ''
                THEN dt.description
              ELSE NULL
            END
          WHEN LOWER(COALESCE(dt.reference_type, '')) = 'invoice_payment' THEN COALESCE(
            CASE
              WHEN c_ip.customer_name IS NOT NULL AND c_ip.customer_address1 IS NOT NULL AND c_ip.customer_address1 <> ''
                THEN c_ip.customer_name || ' - ' || c_ip.customer_address1
              ELSE c_ip.customer_name
            END,
            inv.invoice_number
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
          WHEN LOWER(COALESCE(dt.reference_type, '')) = 'stock' THEN COALESCE(sh_dt.shop_name, sh_stock.shop_name, st.stock_type_name)
          ELSE NULL
        END AS reference_name
      FROM daily_transaction dt
      LEFT JOIN finance_types ft
        ON dt.finance_types_id = ft.finance_type_id
      LEFT JOIN finance_categories fc
        ON dt.finance_categories_id = fc.finance_category_id
      LEFT JOIN bank_account ba
        ON dt.bank_account_id = ba.bank_account_id
      LEFT JOIN shop sh_dt
        ON dt.shop_id = sh_dt.shop_id
      LEFT JOIN customer c
        ON LOWER(COALESCE(dt.reference_type, '')) = 'customer'
       AND dt.reference_id = c.customer_id
      LEFT JOIN shop sh_ref
        ON LOWER(COALESCE(dt.reference_type, '')) = 'shop'
       AND dt.reference_id = sh_ref.shop_id
      LEFT JOIN finance f
        ON LOWER(COALESCE(dt.reference_type, '')) = 'finance'
       AND dt.reference_id = f.finance_id
      LEFT JOIN finance_categories fc_fin
        ON f.finance_category_id = fc_fin.finance_category_id
      LEFT JOIN invoice_items ii_fin
        ON f.finance_id = ii_fin.finance_id
      LEFT JOIN invoice inv_fin
        ON ii_fin.invoice_id = inv_fin.invoice_id
      LEFT JOIN customer c_fin
        ON inv_fin.customer_id = c_fin.customer_id
      LEFT JOIN invoice_payment ip
        ON LOWER(COALESCE(dt.reference_type, '')) = 'invoice_payment'
       AND dt.reference_id = ip.invoice_payment_id
      LEFT JOIN invoice inv
        ON ip.invoice_id = inv.invoice_id
      LEFT JOIN customer c_ip
        ON inv.customer_id = c_ip.customer_id
      LEFT JOIN job j
        ON LOWER(COALESCE(dt.reference_type, '')) = 'job'
       AND dt.reference_id = j.job_id
      LEFT JOIN customer c_job
        ON j.customer_id = c_job.customer_id
      LEFT JOIN staff_salary ss
        ON LOWER(COALESCE(dt.reference_type, '')) = 'salary'
       AND dt.reference_id = ss.staff_salary_id
      LEFT JOIN staff s
        ON ss.staff_id = s.staff_id
      LEFT JOIN stock_transaction stx
        ON LOWER(COALESCE(dt.reference_type, '')) = 'stock'
       AND dt.reference_id = stx.stock_transaction_id
      LEFT JOIN shop sh_stock
        ON stx.shop_id = sh_stock.shop_id
      LEFT JOIN stock_types st
        ON stx.stock_type_id = st.stock_type_id
      WHERE dt.transaction_date BETWEEN $1::date AND $2::date
        AND dt.finance_types_id = $3
      ORDER BY dt.transaction_date DESC, dt.created_at DESC
    `;

    const result = await pool.query(query, [fromDate, toDate, financeTypeId]);

    return result.rows.map((row) => {
      const isFinanceCategoryReference =
        row.reference_type &&
        row.finance_category_name &&
        String(row.reference_type).toLowerCase() ===
          String(row.finance_category_name).toLowerCase();

      return {
        ...row,
        amount: Number(row.amount) || 0,
        reference_name: isFinanceCategoryReference ? null : row.reference_name || null,
      };
    });
  }

  async getIncomeTransactionsByDateRange(fromDate, toDate) {
    return this.getTransactionsByDateRangeByFinanceType(fromDate, toDate, "INCOME");
  }

  async getExpenseTransactionsByDateRange(fromDate, toDate) {
    return this.getTransactionsByDateRangeByFinanceType(fromDate, toDate, "EXPENSE");
  }

  async getTransactionsByDate(date) {
    const query = `
      SELECT
        dt.transaction_id,
        dt.shop_id,
        dt.finance_types_id,
        dt.finance_categories_id,
        dt.reference_type,
        dt.reference_id,
        dt.bank_account_id,
        dt.amount,
        dt.transaction_date,
        dt.description,
        dt.created_at,
        ft.finance_type_code,
        ft.finance_type_name,
        fc.finance_category_name,
        ba.account_name,
        sh_dt.shop_name AS daily_shop_name,
        sh_stock.shop_name AS stock_shop_name,
        s.staff_name,
        j.job_number,
        inv.invoice_number,
        CASE
          WHEN LOWER(COALESCE(dt.reference_type, '')) = 'stock' THEN
            'stock-' || COALESCE(sh_dt.shop_name, sh_stock.shop_name, 'unknown')
          WHEN LOWER(COALESCE(dt.reference_type, '')) = 'salary' THEN
            'salary-' || COALESCE(s.staff_name, 'unknown')
          WHEN LOWER(COALESCE(dt.reference_type, '')) = 'job' THEN
            'job-' || COALESCE(j.job_number, 'unknown')
          WHEN LOWER(COALESCE(dt.reference_type, '')) IN ('invoice', 'invoice_payment') THEN
            'invoice-' || COALESCE(inv.invoice_number, 'unknown')
          WHEN LOWER(COALESCE(dt.reference_type, '')) = 'finance'
           AND ft.finance_type_code = 'INCOME' THEN
            'income-' || COALESCE(fc_fin.finance_category_name, fc.finance_category_name, 'unknown')
          WHEN LOWER(COALESCE(dt.reference_type, '')) = 'finance'
           AND ft.finance_type_code = 'EXPENSE'
           AND LOWER(COALESCE(fc_fin.finance_category_name, fc.finance_category_name, '')) = 'commission'
           AND dt.description IS NOT NULL
           AND dt.description <> '' THEN
            dt.description
          WHEN LOWER(COALESCE(dt.reference_type, '')) = 'finance'
           AND ft.finance_type_code = 'EXPENSE' THEN
            'expense-' || COALESCE(fc_fin.finance_category_name, fc.finance_category_name, 'unknown')
          ELSE LOWER(COALESCE(dt.reference_type, 'unknown'))
        END AS common_key
      FROM daily_transaction dt
      LEFT JOIN finance_types ft
        ON dt.finance_types_id = ft.finance_type_id
      LEFT JOIN finance_categories fc
        ON dt.finance_categories_id = fc.finance_category_id
      LEFT JOIN bank_account ba
        ON dt.bank_account_id = ba.bank_account_id
      LEFT JOIN shop sh_dt
        ON dt.shop_id = sh_dt.shop_id
      LEFT JOIN finance f
        ON LOWER(COALESCE(dt.reference_type, '')) = 'finance'
       AND dt.reference_id = f.finance_id
      LEFT JOIN finance_categories fc_fin
        ON f.finance_category_id = fc_fin.finance_category_id
      LEFT JOIN stock_transaction stx
        ON LOWER(COALESCE(dt.reference_type, '')) = 'stock'
       AND dt.reference_id = stx.stock_transaction_id
      LEFT JOIN shop sh_stock
        ON stx.shop_id = sh_stock.shop_id
      LEFT JOIN staff_salary ss
        ON LOWER(COALESCE(dt.reference_type, '')) = 'salary'
       AND dt.reference_id = ss.staff_salary_id
      LEFT JOIN staff s
        ON ss.staff_id = s.staff_id
      LEFT JOIN job j
        ON LOWER(COALESCE(dt.reference_type, '')) = 'job'
       AND dt.reference_id = j.job_id
      LEFT JOIN invoice_payment ip
        ON LOWER(COALESCE(dt.reference_type, '')) = 'invoice_payment'
       AND dt.reference_id = ip.invoice_payment_id
      LEFT JOIN invoice inv
        ON (
          (LOWER(COALESCE(dt.reference_type, '')) = 'invoice' AND dt.reference_id = inv.invoice_id)
          OR (LOWER(COALESCE(dt.reference_type, '')) = 'invoice_payment' AND ip.invoice_id = inv.invoice_id)
        )
      WHERE dt.transaction_date = $1::date
      ORDER BY dt.created_at DESC
    `;

    const result = await pool.query(query, [date]);

    return result.rows.map((row) => ({
      transaction_id: row.transaction_id,
      reference_id: row.reference_id,
      transaction_date: row.transaction_date,
      amount: Number(row.amount) || 0,
      description: row.common_key,
    }));
  }
}

module.exports = new DailyTransactionRepository();