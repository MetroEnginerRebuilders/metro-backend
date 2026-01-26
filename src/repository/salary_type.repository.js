const pool = require("../config/database");

class SalaryTypeRepository {
  // Get all salary types
  async findAll() {
    const query = "SELECT * FROM salary_type ORDER BY salary_type ASC";
    const result = await pool.query(query);
    return result.rows;
  }

  // Get salary type by ID
  async findById(salaryTypeId) {
    const query = "SELECT * FROM salary_type WHERE salary_type_id = $1";
    const result = await pool.query(query, [salaryTypeId]);
    return result.rows[0];
  }
}

module.exports = new SalaryTypeRepository();
