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
}

module.exports = new FinanceRepository();
