const pool = require('../config/database');

const stockTransactionTypesRepository = {
  // Get all stock transaction types
  findAll: async () => {
    const query = `
      SELECT 
        stock_type_id,
        stock_type_name,
        stock_type_code,
        created_at
      FROM stock_types
      ORDER BY stock_type_name
    `;
    const result = await pool.query(query);
    return result.rows;
  },

  // Find stock transaction type by ID
  findById: async (id) => {
    const query = `
      SELECT 
        stock_type_id,
        stock_type_name,
        stock_type_code,
        created_at
      FROM stock_types
      WHERE stock_type_id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  },

  // Find stock transaction type by code
  findByCode: async (code) => {
    const query = `
      SELECT 
        stock_type_id,
        stock_type_name,
        stock_type_code,
        created_at
      FROM stock_types
      WHERE stock_type_code = $1
    `;
    const result = await pool.query(query, [code]);
    return result.rows[0];
  }
};

module.exports = stockTransactionTypesRepository;
