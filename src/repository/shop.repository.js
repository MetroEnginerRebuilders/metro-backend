const pool = require("../config/database");

class ShopRepository {
  // Create new shop
  async create(shopData) {
    const query = `
      INSERT INTO shop (shop_name, shop_address, shop_phone_number) 
      VALUES ($1, $2, $3) 
      RETURNING *
    `;
    const result = await pool.query(query, [
      shopData.shopName,
      shopData.shopAddress,
      shopData.shopPhoneNumber
    ]);
    return result.rows[0];
  }

  // Get all shops with pagination and search
  async findAll(searchTerm = "", page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    let query = "SELECT * FROM shop";
    let countQuery = "SELECT COUNT(*) FROM shop";
    let params = [];
    let countParams = [];
    
    if (searchTerm && searchTerm.trim() !== "") {
      const searchCondition = " WHERE shop_name ILIKE $1 OR shop_address ILIKE $1 OR shop_phone_number ILIKE $1";
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

  // Get shop by ID
  async findById(shopId) {
    const query = "SELECT * FROM shop WHERE shop_id = $1";
    const result = await pool.query(query, [shopId]);
    return result.rows[0];
  }

  // Update shop
  async update(shopId, shopData) {
    const query = `
      UPDATE shop 
      SET shop_name = $1, shop_address = $2, shop_phone_number = $3, updated_at = NOW() 
      WHERE shop_id = $4 
      RETURNING *
    `;
    const result = await pool.query(query, [
      shopData.shopName,
      shopData.shopAddress,
      shopData.shopPhoneNumber,
      shopId
    ]);
    return result.rows[0];
  }

  // Delete shop
  async delete(shopId) {
    const query = "DELETE FROM shop WHERE shop_id = $1 RETURNING *";
    const result = await pool.query(query, [shopId]);
    return result.rows[0];
  }
}

module.exports = new ShopRepository();
