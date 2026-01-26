const pool = require("../config/database");

class StaffRepository {
  // Create new staff
  async create(staffData) {
    const query = `
      INSERT INTO staff (staff_name, salary, active_date) 
      VALUES ($1, $2, $3) 
      RETURNING *
    `;
    const result = await pool.query(query, [
      staffData.staffName,
      staffData.salary || null,
      staffData.activeDate
    ]);
    return result.rows[0];
  }

  // Get all staff with pagination and search
  async findAll(searchTerm = "", page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    let query = "SELECT * FROM staff";
    let countQuery = "SELECT COUNT(*) FROM staff";
    let params = [];
    let countParams = [];
    
    if (searchTerm && searchTerm.trim() !== "") {
      const searchCondition = " WHERE staff_name ILIKE $1";
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

  // Get all active staff with pagination and search
  async findActive(searchTerm = "", page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    let query = "SELECT * FROM staff WHERE inactive_date IS NULL";
    let countQuery = "SELECT COUNT(*) FROM staff WHERE inactive_date IS NULL";
    let params = [];
    let countParams = [];
    
    if (searchTerm && searchTerm.trim() !== "") {
      const searchCondition = " AND staff_name ILIKE $1";
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

  // Get staff by ID
  async findById(staffId) {
    const query = "SELECT * FROM staff WHERE staff_id = $1";
    const result = await pool.query(query, [staffId]);
    return result.rows[0];
  }

  // Update staff
  async update(staffId, staffData) {
    // Validate inactive date is after active date
    if (staffData.inactiveDate) {
      const activeDate = new Date(staffData.activeDate);
      const inactiveDate = new Date(staffData.inactiveDate);
      
      if (inactiveDate <= activeDate) {
        throw new Error("Inactive date must be after active date");
      }
    }

    const query = `
      UPDATE staff 
      SET staff_name = $1, 
          salary = $2,
          active_date = $3, 
          inactive_date = $4,
          updated_at = NOW() 
      WHERE staff_id = $5 
      RETURNING *
    `;
    const result = await pool.query(query, [
      staffData.staffName,
      staffData.salary || null,
      staffData.activeDate,
      staffData.inactiveDate || null,
      staffId
    ]);
    return result.rows[0];
  }

  // Delete staff
  async delete(staffId) {
    const query = "DELETE FROM staff WHERE staff_id = $1 RETURNING *";
    const result = await pool.query(query, [staffId]);
    return result.rows[0];
  }
}

module.exports = new StaffRepository();
