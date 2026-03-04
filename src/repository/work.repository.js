const pool = require("../config/database");

class WorkRepository {
  // Create new work
  async create(workName) {
    const query = "INSERT INTO work (work_name) VALUES ($1) RETURNING *";
    const result = await pool.query(query, [workName]);
    return result.rows[0];
  }

  // Get all works with pagination and search
  async findAll(searchTerm = "", page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    let query = "SELECT * FROM work";
    let countQuery = "SELECT COUNT(*) FROM work";
    let params = [];
    let countParams = [];
    
    if (searchTerm && searchTerm.trim() !== "") {
      const searchCondition = " WHERE work_name ILIKE $1";
      query += searchCondition;
      countQuery += searchCondition;
      params.push(`%${searchTerm.trim()}%`);
      countParams.push(`%${searchTerm.trim()}%`);
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

  // Get work by ID
  async findById(workId) {
    const query = "SELECT * FROM work WHERE work_id = $1";
    const result = await pool.query(query, [workId]);
    return result.rows[0];
  }

  // Check if work name already exists
  async findByName(workName) {
    const query = "SELECT * FROM work WHERE LOWER(work_name) = LOWER($1) LIMIT 1";
    const result = await pool.query(query, [workName]);
    return result.rows[0];
  }

  // Update work
  async update(workId, workName) {
    const query = "UPDATE work SET work_name = $1, updated_at = NOW() WHERE work_id = $2 RETURNING *";
    const result = await pool.query(query, [workName, workId]);
    return result.rows[0];
  }

  // Delete work
  async delete(workId) {
    const query = "DELETE FROM work WHERE work_id = $1 RETURNING *";
    const result = await pool.query(query, [workId]);
    return result.rows[0];
  }
}

module.exports = new WorkRepository();
