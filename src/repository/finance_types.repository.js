const pool = require("../config/database");

class FinanceTypesRepository {
  // Get all finance types
  async findAll() {
    const query = "SELECT * FROM finance_types ORDER BY finance_type_name ASC";
    const result = await pool.query(query);
    return result.rows;
  }

  // Get finance type by ID
  async findById(financeTypeId) {
    const query = "SELECT * FROM finance_types WHERE finance_type_id = $1";
    const result = await pool.query(query, [financeTypeId]);
    return result.rows[0];
  }
}

module.exports = new FinanceTypesRepository();
