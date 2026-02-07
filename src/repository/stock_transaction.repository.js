const pool = require('../config/database');

const stockTransactionRepository = {
  // Get stock type by ID
  getStockTypeById: async (id) => {
    const query = `
      SELECT stock_type_id, stock_type_name, stock_type_code
      FROM stock_types 
      WHERE stock_type_id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  },

  // Get stock transaction type ID by code
  getStockTypeIdByCode: async (code) => {
    const query = `
      SELECT stock_type_id 
      FROM stock_types 
      WHERE stock_type_code = $1
    `;
    const result = await pool.query(query, [code]);
    return result.rows[0];
  },

  // Create stock transaction with items
  create: async (stockTransactionData, items) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert stock transaction header
      const insertQuery = `
        INSERT INTO stock_transaction (
          shop_id,
          stock_type_id,
          order_date,
          description,
          bank_account_id,
          total_amount
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await client.query(insertQuery, [
        stockTransactionData.shop_id,
        stockTransactionData.stock_type_id,
        stockTransactionData.order_date,
        stockTransactionData.description,
        stockTransactionData.bank_account_id,
        stockTransactionData.total_amount
      ]);

      const stockTransaction = result.rows[0];

      // Insert stock transaction items
      if (items && items.length > 0) {
        const itemInsertQuery = `
          INSERT INTO stock_transaction_items (
            stock_transaction_id,
            company_id,
            model_id,
            spare_id,
            quantity,
            price
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `;

        for (const item of items) {
          await client.query(itemInsertQuery, [
            stockTransaction.stock_transaction_id,
            item.company_id,
            item.model_id,
            item.spare_id,
            item.quantity,
            item.price
          ]);
        }
      }

      await client.query('COMMIT');
      return stockTransaction;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Find all stock transactions with pagination and search
  findAll: async (page = 1, limit = 10, searchTerm = '') => {
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        st.stock_transaction_id,
        st.shop_id,
        s.shop_name,
        st.stock_type_id,
        stt.stock_type_name,
        stt.stock_type_code,
        st.order_date,
        st.description,
        st.bank_account_id,
        ba.account_name,
        ba.account_number,
        st.total_amount,
        st.created_at,
        st.updated_at
      FROM stock_transaction st
      LEFT JOIN shop s ON st.shop_id = s.shop_id
      LEFT JOIN stock_types stt ON st.stock_type_id = stt.stock_type_id
      LEFT JOIN bank_account ba ON st.bank_account_id = ba.bank_account_id
      WHERE 1=1
    `;

    const queryParams = [];
    
    if (searchTerm) {
      queryParams.push(`%${searchTerm}%`);
      query += ` AND (
        st.description ILIKE $${queryParams.length}
        OR s.shop_name ILIKE $${queryParams.length}
        OR ba.account_name ILIKE $${queryParams.length}
        OR CAST(st.total_amount AS TEXT) ILIKE $${queryParams.length}
      )`;
    }

    query += ` ORDER BY st.order_date DESC, st.created_at DESC`;
    
    // Get total count
    const countQuery = `SELECT COUNT(*) FROM (${query}) AS count_query`;
    const countResult = await pool.query(countQuery, queryParams);
    const totalRecords = parseInt(countResult.rows[0].count);

    // Add pagination
    queryParams.push(limit, offset);
    query += ` LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;

    const result = await pool.query(query, queryParams);

    return {
      data: result.rows,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalRecords / limit),
        totalRecords,
        limit
      }
    };
  },

  // Find stock transaction by ID with items
  findById: async (id) => {
    const headerQuery = `
      SELECT 
        st.stock_transaction_id,
        st.shop_id,
        s.shop_name,
        st.stock_type_id,
        stt.stock_type_name,
        stt.stock_type_code,
        st.order_date,
        st.description,
        st.bank_account_id,
        ba.account_name,
        ba.account_number,
        st.total_amount,
        st.created_at,
        st.updated_at
      FROM stock_transaction st
      LEFT JOIN shop s ON st.shop_id = s.shop_id
      LEFT JOIN stock_types stt ON st.stock_type_id = stt.stock_type_id
      LEFT JOIN bank_account ba ON st.bank_account_id = ba.bank_account_id
      WHERE st.stock_transaction_id = $1
    `;

    const itemsQuery = `
      SELECT 
        sti.stock_transaction_item_id,
        sti.company_id,
        c.company_name,
        sti.model_id,
        m.model_name,
        sti.spare_id,
        sp.spare_name,
        sti.quantity,
        sti.price,
        (sti.quantity * sti.price) as line_total
      FROM stock_transaction_items sti
      LEFT JOIN company c ON sti.company_id = c.company_id
      LEFT JOIN model m ON sti.model_id = m.model_id
      LEFT JOIN spare sp ON sti.spare_id = sp.spare_id
      WHERE sti.stock_transaction_id = $1
      ORDER BY sti.created_at
    `;

    const headerResult = await pool.query(headerQuery, [id]);
    const itemsResult = await pool.query(itemsQuery, [id]);

    if (headerResult.rows.length === 0) {
      return null;
    }

    return {
      ...headerResult.rows[0],
      items: itemsResult.rows
    };
  },

  // Delete single stock transaction item
  deleteItem: async (itemId) => {
    const query = `
      DELETE FROM stock_transaction_items
      WHERE stock_transaction_item_id = $1
      RETURNING stock_transaction_id, quantity, price
    `;
    const result = await pool.query(query, [itemId]);
    return result.rows[0];
  },

  // Get item details with transaction info for delete operation
  getItemDetails: async (itemId) => {
    const query = `
      SELECT 
        sti.stock_transaction_item_id,
        sti.stock_transaction_id,
        sti.quantity,
        sti.price,
        (sti.quantity * sti.price) as item_amount,
        st.bank_account_id,
        st.stock_type_id,
        stt.stock_type_code
      FROM stock_transaction_items sti
      JOIN stock_transaction st ON sti.stock_transaction_id = st.stock_transaction_id
      JOIN stock_types stt ON st.stock_type_id = stt.stock_type_id
      WHERE sti.stock_transaction_item_id = $1
    `;
    const result = await pool.query(query, [itemId]);
    return result.rows[0];
  },

  // Update transaction total amount after item deletion
  updateTransactionTotal: async (transactionId) => {
    const query = `
      UPDATE stock_transaction
      SET total_amount = (
        SELECT COALESCE(SUM(quantity * price), 0)
        FROM stock_transaction_items
        WHERE stock_transaction_id = $1
      )
      WHERE stock_transaction_id = $1
      RETURNING total_amount
    `;
    const result = await pool.query(query, [transactionId]);
    return result.rows[0];
  },

  // Count items in a stock transaction
  countTransactionItems: async (transactionId) => {
    const query = `
      SELECT COUNT(*) as item_count
      FROM stock_transaction_items
      WHERE stock_transaction_id = $1
    `;
    const result = await pool.query(query, [transactionId]);
    return parseInt(result.rows[0].item_count);
  },

  // Delete entire stock transaction
  deleteTransaction: async (transactionId) => {
    const query = `
      DELETE FROM stock_transaction
      WHERE stock_transaction_id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [transactionId]);
    return result.rows[0];
  },

  // Get distinct models for a specific company from stock transactions
  getModelsByCompany: async (companyId) => {
    const query = `
      SELECT DISTINCT
        m.model_id,
        m.model_name
      FROM stock_transaction_items sti
      JOIN model m ON sti.model_id = m.model_id
      WHERE sti.company_id = $1
      ORDER BY m.model_name
    `;
    const result = await pool.query(query, [companyId]);
    return result.rows;
  },

  // Get distinct spares for a specific model from stock transactions
  getSparesByModel: async (modelId) => {
    const query = `
      SELECT DISTINCT
        s.spare_id,
        s.spare_name
      FROM stock_transaction_items sti
      JOIN spare s ON sti.spare_id = s.spare_id
      WHERE sti.model_id = $1
      ORDER BY s.spare_name
    `;
    const result = await pool.query(query, [modelId]);
    return result.rows;
  },

  // Get distinct companies from stock transactions
  getCompanies: async () => {
    const query = `
      SELECT DISTINCT
        c.company_id,
        c.company_name
      FROM stock_transaction_items sti
      JOIN company c ON sti.company_id = c.company_id
      ORDER BY c.company_name
    `;
    const result = await pool.query(query);
    return result.rows;
  },

  // Get available stock quantity for specific company, model, and spare
  getAvailableStock: async (companyId, modelId, spareId) => {
    const query = `
      SELECT 
        COALESCE(
          SUM(
            CASE 
              WHEN stt.stock_type_code = 'PURCHASE' THEN sti.quantity
              WHEN stt.stock_type_code = 'RETURN' THEN -sti.quantity
              ELSE 0
            END
          ), 
          0
        ) as available_quantity
      FROM stock_transaction_items sti
      JOIN stock_transaction st ON sti.stock_transaction_id = st.stock_transaction_id
      JOIN stock_types stt ON st.stock_type_id = stt.stock_type_id
      WHERE sti.company_id = $1 
        AND sti.model_id = $2 
        AND sti.spare_id = $3
    `;
    const result = await pool.query(query, [companyId, modelId, spareId]);
    return parseInt(result.rows[0].available_quantity) || 0;
  },

  // Get stock list by type with pagination and search
  getStockList: async (stockTypeCode, page = 1, limit = 10, searchTerm = '') => {
    const offset = (page - 1) * limit;

    if (stockTypeCode) {
      // List PURCHASE or RETURN transactions
      let query = `
        SELECT 
          sti.stock_transaction_item_id,
          st.stock_transaction_id,
          st.order_date,
          st.description as transaction_description,
          s.shop_id,
          s.shop_name,
          c.company_id,
          c.company_name,
          m.model_id,
          m.model_name,
          sp.spare_id,
          sp.spare_name,
          sti.quantity,
          sti.price,
          (sti.quantity * sti.price) as total_price,
          stt.stock_type_name,
          stt.stock_type_code,
          ba.bank_account_id,
          ba.account_name,
          st.created_at
        FROM stock_transaction_items sti
        JOIN stock_transaction st ON sti.stock_transaction_id = st.stock_transaction_id
        JOIN stock_types stt ON st.stock_type_id = stt.stock_type_id
        JOIN shop s ON st.shop_id = s.shop_id
        JOIN company c ON sti.company_id = c.company_id
        JOIN model m ON sti.model_id = m.model_id
        JOIN spare sp ON sti.spare_id = sp.spare_id
        JOIN bank_account ba ON st.bank_account_id = ba.bank_account_id
        WHERE stt.stock_type_code = $1
      `;

      const queryParams = [stockTypeCode];

      if (searchTerm) {
        queryParams.push(`%${searchTerm}%`);
        query += ` AND (
          c.company_name ILIKE $${queryParams.length}
          OR m.model_name ILIKE $${queryParams.length}
          OR sp.spare_name ILIKE $${queryParams.length}
          OR s.shop_name ILIKE $${queryParams.length}
          OR st.description ILIKE $${queryParams.length}
        )`;
      }

      query += ` ORDER BY st.order_date DESC, st.created_at DESC`;

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM (${query}) AS count_query`;
      const countResult = await pool.query(countQuery, queryParams);
      const totalRecords = parseInt(countResult.rows[0].count);

      // Add pagination
      queryParams.push(limit, offset);
      query += ` LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;

      const result = await pool.query(query, queryParams);

      return {
        data: result.rows,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalRecords / limit),
          totalRecords,
          limit
        }
      };
    } else {
      // Current stock - calculate balance grouped by company, model, spare
      let query = `
        SELECT 
          c.company_id,
          c.company_name,
          m.model_id,
          m.model_name,
          sp.spare_id,
          sp.spare_name,
          SUM(
            CASE 
              WHEN stt.stock_type_code = 'PURCHASE' THEN sti.quantity
              WHEN stt.stock_type_code = 'RETURN' THEN -sti.quantity
              ELSE 0
            END
          ) as current_quantity,
          AVG(sti.price) as average_price
        FROM stock_transaction_items sti
        JOIN stock_transaction st ON sti.stock_transaction_id = st.stock_transaction_id
        JOIN stock_types stt ON st.stock_type_id = stt.stock_type_id
        JOIN company c ON sti.company_id = c.company_id
        JOIN model m ON sti.model_id = m.model_id
        JOIN spare sp ON sti.spare_id = sp.spare_id
        WHERE 1=1
      `;

      const queryParams = [];

      if (searchTerm) {
        queryParams.push(`%${searchTerm}%`);
        query += ` AND (
          c.company_name ILIKE $${queryParams.length}
          OR m.model_name ILIKE $${queryParams.length}
          OR sp.spare_name ILIKE $${queryParams.length}
        )`;
      }

      query += ` 
        GROUP BY c.company_id, c.company_name, m.model_id, m.model_name, sp.spare_id, sp.spare_name
        HAVING SUM(
          CASE 
            WHEN stt.stock_type_code = 'PURCHASE' THEN sti.quantity
            WHEN stt.stock_type_code = 'RETURN' THEN -sti.quantity
            ELSE 0
          END
        ) > 0
        ORDER BY c.company_name, m.model_name, sp.spare_name
      `;

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM (${query}) AS count_query`;
      const countResult = await pool.query(countQuery, queryParams);
      const totalRecords = parseInt(countResult.rows[0].count);

      // Add pagination
      queryParams.push(limit, offset);
      query += ` LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;

      const result = await pool.query(query, queryParams);

      return {
        data: result.rows,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalRecords / limit),
          totalRecords,
          limit
        }
      };
    }
  }
};

module.exports = stockTransactionRepository;
