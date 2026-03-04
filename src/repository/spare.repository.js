const pool = require("../config/database");

class SpareRepository {
  // Create new spare
  async create(spareName) {
    const query = "INSERT INTO spare (spare_name) VALUES ($1) RETURNING *";
    const result = await pool.query(query, [spareName]);
    return result.rows[0];
  }

  // Get all spares with pagination and search
  async findAll(searchTerm = "", page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    let query = "SELECT * FROM spare";
    let countQuery = "SELECT COUNT(*) FROM spare";
    let params = [];
    let countParams = [];
    
    if (searchTerm && searchTerm.trim() !== "") {
      const searchCondition = " WHERE spare_name ILIKE $1";
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

  // Get spare by ID
  async findById(spareId) {
    const query = "SELECT * FROM spare WHERE spare_id = $1";
    const result = await pool.query(query, [spareId]);
    return result.rows[0];
  }

  // Check if spare name already exists
  async findByName(spareName) {
    const query = "SELECT * FROM spare WHERE LOWER(spare_name) = LOWER($1) LIMIT 1";
    const result = await pool.query(query, [spareName]);
    return result.rows[0];
  }

  // Update spare
  async update(spareId, spareName) {
    const query = "UPDATE spare SET spare_name = $1, updated_at = NOW() WHERE spare_id = $2 RETURNING *";
    const result = await pool.query(query, [spareName, spareId]);
    return result.rows[0];
  }

  // Delete spare
  async delete(spareId) {
    const query = "DELETE FROM spare WHERE spare_id = $1 RETURNING *";
    const result = await pool.query(query, [spareId]);
    return result.rows[0];
  }
}

module.exports = new SpareRepository();
