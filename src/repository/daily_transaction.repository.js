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
}

module.exports = new DailyTransactionRepository();