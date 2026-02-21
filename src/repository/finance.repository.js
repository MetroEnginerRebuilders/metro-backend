const pool = require("../config/database");

class FinanceRepository {
  // Get all finance records
  async findAll() {
    const query = `
      SELECT 
        f.*,
        ba.account_name,
        fc.finance_category_name,
        ft.finance_type_name
      FROM finance f
      LEFT JOIN bank_account ba ON f.bank_account_id = ba.bank_account_id
      LEFT JOIN finance_categories fc ON f.finance_category_id = fc.finance_category_id
      LEFT JOIN finance_types ft ON f.finance_type_id = ft.finance_type_id
      ORDER BY f.transaction_date DESC, f.created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  // Get finance record by ID
  async findById(financeId) {
    const query = `
      SELECT 
        f.*,
        ba.account_name,
        fc.finance_category_name,
        ft.finance_type_name
      FROM finance f
      LEFT JOIN bank_account ba ON f.bank_account_id = ba.bank_account_id
      LEFT JOIN finance_categories fc ON f.finance_category_id = fc.finance_category_id
      LEFT JOIN finance_types ft ON f.finance_type_id = ft.finance_type_id
      WHERE f.finance_id = $1
    `;
    const result = await pool.query(query, [financeId]);
    return result.rows[0];
  }

  // Create new finance record
  async create(financeData) {
    const query = `
      INSERT INTO finance (
        bank_account_id, 
        finance_category_id, 
        finance_type_id, 
        amount, 
        transaction_date,
        description,
        remarks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      financeData.bank_account_id,
      financeData.finance_category_id,
      financeData.finance_type_id,
      financeData.amount,
      financeData.transaction_date,
      financeData.description || null,
      financeData.remarks || null,
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Update finance record
  async update(financeId, financeData) {
    const query = `
      UPDATE finance 
      SET 
        bank_account_id = $1,
        finance_category_id = $2,
        finance_type_id = $3,
        amount = $4,
        transaction_date = $5,
        description = $6,
        remarks = $7
      WHERE finance_id = $8
      RETURNING *
    `;
    const values = [
      financeData.bank_account_id,
      financeData.finance_category_id,
      financeData.finance_type_id,
      financeData.amount,
      financeData.transaction_date,
      financeData.description || null,
      financeData.remarks || null,
      financeId,
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Delete finance record
  async delete(financeId) {
    const query = "DELETE FROM finance WHERE finance_id = $1 RETURNING *";
    const result = await pool.query(query, [financeId]);
    return result.rows[0];
  }

  // Get finance records by date range
  async findByDateRange(startDate, endDate) {
    const query = `
      SELECT 
        f.*,
        ba.account_name,
        fc.finance_category_name,
        ft.finance_type_name
      FROM finance f
      LEFT JOIN bank_account ba ON f.bank_account_id = ba.bank_account_id
      LEFT JOIN finance_categories fc ON f.finance_category_id = fc.finance_category_id
      LEFT JOIN finance_types ft ON f.finance_type_id = ft.finance_type_id
      WHERE f.transaction_date BETWEEN $1 AND $2
      ORDER BY f.transaction_date DESC, f.created_at DESC
    `;
    const result = await pool.query(query, [startDate, endDate]);
    return result.rows;
  }

  // Get finance records by bank account
  async findByBankAccount(bankAccountId) {
    const query = `
      SELECT 
        f.*,
        ba.account_name,
        fc.finance_category_name,
        ft.finance_type_name
      FROM finance f
      LEFT JOIN bank_account ba ON f.bank_account_id = ba.bank_account_id
      LEFT JOIN finance_categories fc ON f.finance_category_id = fc.finance_category_id
      LEFT JOIN finance_types ft ON f.finance_type_id = ft.finance_type_id
      WHERE f.bank_account_id = $1
      ORDER BY f.transaction_date DESC, f.created_at DESC
    `;
    const result = await pool.query(query, [bankAccountId]);
    return result.rows;
  }

  // Get income finance type ID
  async getIncomeTypeId() {
    const query = "SELECT finance_type_id FROM finance_types WHERE finance_type_code = 'INCOME'";
    const result = await pool.query(query);
    return result.rows[0]?.finance_type_id;
  }

  // Get expense finance type ID
  async getExpenseTypeId() {
    const query = "SELECT finance_type_id FROM finance_types WHERE finance_type_code = 'EXPENSE'";
    const result = await pool.query(query);
    return result.rows[0]?.finance_type_id;
  }

  async getMonthlyReport(month, year) {
    try {
      // Get all expenses for the month
      const expensesQuery = `
        SELECT 
          f.transaction_date::DATE as date,
          fc.finance_category_name as expense_type,
          f.amount
        FROM finance f
        LEFT JOIN finance_categories fc ON f.finance_category_id = fc.finance_category_id
        WHERE f.finance_type_id = (SELECT finance_type_id FROM finance_types WHERE finance_type_code = 'EXPENSE')
          AND EXTRACT(YEAR FROM f.transaction_date) = $1
          AND EXTRACT(MONTH FROM f.transaction_date) = $2
        ORDER BY f.transaction_date ASC
      `;

      // Get all salaries for the month
      const salariesQuery = `
        SELECT 
          ss.effective_date::DATE as date,
          ss.amount
        FROM staff_salary ss
        WHERE EXTRACT(YEAR FROM ss.effective_date) = $1
          AND EXTRACT(MONTH FROM ss.effective_date) = $2
        ORDER BY ss.effective_date ASC
      `;

      // Get all income for the month
      const incomeQuery = `
        SELECT 
          f.transaction_date::DATE as date,
          fc.finance_category_name as income_type,
          f.amount
        FROM finance f
        LEFT JOIN finance_categories fc ON f.finance_category_id = fc.finance_category_id
        WHERE f.finance_type_id = (SELECT finance_type_id FROM finance_types WHERE finance_type_code = 'INCOME')
          AND EXTRACT(YEAR FROM f.transaction_date) = $1
          AND EXTRACT(MONTH FROM f.transaction_date) = $2
        ORDER BY f.transaction_date ASC
      `;

      const [expensesResult, salariesResult, incomeResult] = await Promise.all([
        pool.query(expensesQuery, [year, month]),
        pool.query(salariesQuery, [year, month]),
        pool.query(incomeQuery, [year, month]),
      ]);

      // Calculate days in month
      const daysInMonth = new Date(year, month, 0).getDate();

      // Build daily reports
      const dailyReports = [];
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dateStr = date.toISOString().split('T')[0];

        // Expenses for this day
        const dayExpenses = expensesResult.rows
          .filter(row => row.date.toISOString().split('T')[0] === dateStr)
          .map(row => ({
            expense_type: row.expense_type ,
            amount: row.amount.toString(),
          }));

        const totalExpenses = dayExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

        // Salary for this day
        const daySalaries = salariesResult.rows.filter(row => row.date.toISOString().split('T')[0] === dateStr);
        const salary = daySalaries.length > 0 ? Number(daySalaries[0].amount) : null;

        // Income for this day
        const dayIncome = incomeResult.rows
          .filter(row => row.date.toISOString().split('T')[0] === dateStr)
          .map(row => ({
            income_type: row.income_type,
            amount: row.amount.toString(),
          }));

        const totalIncome = dayIncome.reduce((sum, inc) => sum + Number(inc.amount), 0);

        dailyReports.push({
          date: dateStr,
          day: day,
          expenses: dayExpenses,
          total_expenses: totalExpenses,
          salary: salary,
          income: dayIncome,
          total_income: totalIncome,
        });
      }

      return {
        month: new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' }),
        year: year,
        daily_reports: dailyReports,
      };
    } catch (error) {
      console.error("Monthly report error:", error);
      throw error;
    }
  }
}

module.exports = new FinanceRepository();
