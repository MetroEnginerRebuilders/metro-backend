const pool = require("../config/database");

class CompanyRepository {
  // Create new company
  async create(companyData) {
    const query = `
      INSERT INTO company (company_name, executive_name, executive_phone_number) 
      VALUES ($1, $2, $3) 
      RETURNING *
    `;
    const result = await pool.query(query, [
      companyData.companyName,
      companyData.executiveName || null,
      companyData.executivePhoneNumber || null
    ]);
    return result.rows[0];
  }

  // Get all companies with pagination and search
  async findAll(searchTerm = "", page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    let query = "SELECT * FROM company";
    let countQuery = "SELECT COUNT(*) FROM company";
    let params = [];
    let countParams = [];
    
    if (searchTerm && searchTerm.trim() !== "") {
      const searchCondition = " WHERE company_name ILIKE $1 OR executive_name ILIKE $1";
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

  // Get company by ID
  async findById(companyId) {
    const query = "SELECT * FROM company WHERE company_id = $1";
    const result = await pool.query(query, [companyId]);
    return result.rows[0];
  }

  // Check if company name already exists (for validation)
  async findByName(companyName) {
    const query = "SELECT * FROM company WHERE company_name = $1";
    const result = await pool.query(query, [companyName]);
    return result.rows[0];
  }

  // Update company
  async update(companyId, companyData) {
    const query = `
      UPDATE company 
      SET company_name = $1, 
          executive_name = $2, 
          executive_phone_number = $3,
          updated_at = NOW() 
      WHERE company_id = $4 
      RETURNING *
    `;
    const result = await pool.query(query, [
      companyData.companyName,
      companyData.executiveName || null,
      companyData.executivePhoneNumber || null,
      companyId
    ]);
    return result.rows[0];
  }

  // Delete company
  async delete(companyId) {
    const query = "DELETE FROM company WHERE company_id = $1 RETURNING *";
    const result = await pool.query(query, [companyId]);
    return result.rows[0];
  }
}

module.exports = new CompanyRepository();
