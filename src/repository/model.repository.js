const pool = require("../config/database");

class ModelRepository {
  // Create new model
  async create(modelData) {
    const query = `
      INSERT INTO model (model_name) 
      VALUES ($1) 
      RETURNING *
    `;
    const result = await pool.query(query, [modelData.modelName]);
    return result.rows[0];
  }

  // Get all models with pagination and search
  async findAll(searchTerm = "", page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    let query = "SELECT * FROM model";
    let countQuery = "SELECT COUNT(*) FROM model";
    let params = [];
    let countParams = [];
    
    if (searchTerm && searchTerm.trim() !== "") {
      const searchCondition = " WHERE model_name ILIKE $1";
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

  // Get model by ID
  async findById(modelId) {
    const query = "SELECT * FROM model WHERE model_id = $1";
    const result = await pool.query(query, [modelId]);
    return result.rows[0];
  }

  // Check if model name already exists (for validation)
  async findByName(modelName) {
    const query = "SELECT * FROM model WHERE model_name = $1";
    const result = await pool.query(query, [modelName]);
    return result.rows[0];
  }

  // Update model
  async update(modelId, modelData) {
    const query = `
      UPDATE model 
      SET model_name = $1, updated_at = NOW() 
      WHERE model_id = $2 
      RETURNING *
    `;
    const result = await pool.query(query, [modelData.modelName, modelId]);
    return result.rows[0];
  }

  // Delete model
  async delete(modelId) {
    const query = "DELETE FROM model WHERE model_id = $1 RETURNING *";
    const result = await pool.query(query, [modelId]);
    return result.rows[0];
  }
}

module.exports = new ModelRepository();
