const pool = require("../config/database");

class FinanceCategoriesRepository {
  // Get finance categories by finance type code
  async findByFinanceTypeCode(financeTypeCode) {
    const query = `
      SELECT fc.*, ft.finance_type_name, ft.finance_type_code
      FROM finance_categories fc
      INNER JOIN finance_types ft ON fc.finance_type_id = ft.finance_type_id
      WHERE ft.finance_type_code = $1
      ORDER BY fc.finance_category_name ASC
    `;
    const result = await pool.query(query, [financeTypeCode]);
    return result.rows;
  }

  // Get all finance categories
  async findAll() {
    const query = `
      SELECT fc.*, ft.finance_type_name, ft.finance_type_code
      FROM finance_categories fc
      INNER JOIN finance_types ft ON fc.finance_type_id = ft.finance_type_id
      ORDER BY ft.finance_type_name ASC, fc.finance_category_name ASC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  // Get finance category by ID
  async findById(financeCategoryId) {
    const query = `
      SELECT fc.*, ft.finance_type_name, ft.finance_type_code
      FROM finance_categories fc
      INNER JOIN finance_types ft ON fc.finance_type_id = ft.finance_type_id
      WHERE fc.finance_category_id = $1
    `;
    const result = await pool.query(query, [financeCategoryId]);
    return result.rows[0];
  }
}

module.exports = new FinanceCategoriesRepository();
