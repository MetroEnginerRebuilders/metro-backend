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

  // Add stock payment and update stock transaction payment status
  addPayment: async ({ stockTransactionId, bankAccountId, amountPaid, paymentOn, remarks = null }) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const stockTransactionQuery = `
        SELECT
          st.stock_transaction_id,
          st.stock_type_id,
          st.total_amount
        FROM stock_transaction st
        WHERE st.stock_transaction_id = $1
        FOR UPDATE
      `;
      const stockTransactionResult = await client.query(stockTransactionQuery, [stockTransactionId]);

      if (stockTransactionResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const stockTransaction = stockTransactionResult.rows[0];

      const insertPaymentQuery = `
        INSERT INTO stock_payment (
          stock_transaction_id,
          stock_type_id,
          bank_account_id,
          amount_paid,
          payment_status,
          payment_on,
          remarks
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const insertedPaymentResult = await client.query(insertPaymentQuery, [
        stockTransactionId,
        stockTransaction.stock_type_id,
        bankAccountId,
        amountPaid,
        'unpaid',
        paymentOn,
        remarks,
      ]);

      const totalPaidQuery = `
        SELECT COALESCE(SUM(amount_paid), 0) AS total_paid
        FROM stock_payment
        WHERE stock_transaction_id = $1
      `;
      const totalPaidResult = await client.query(totalPaidQuery, [stockTransactionId]);
      const totalPaid = Number(totalPaidResult.rows[0]?.total_paid) || 0;
      const totalAmount = Number(stockTransaction.total_amount) || 0;

      let computedPaymentStatus = 'unpaid';
      if (totalPaid > 0 && totalPaid < totalAmount) {
        computedPaymentStatus = 'partial';
      } else if (totalAmount > 0 && totalPaid >= totalAmount) {
        computedPaymentStatus = 'paid';
      }

      const updateStockTransactionStatusQuery = `
        UPDATE stock_transaction
        SET payment_status = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE stock_transaction_id = $2
      `;
      await client.query(updateStockTransactionStatusQuery, [computedPaymentStatus, stockTransactionId]);

      const updatePaymentStatusQuery = `
        UPDATE stock_payment
        SET payment_status = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE stock_payment_id = $2
        RETURNING *
      `;
      const updatedPaymentResult = await client.query(updatePaymentStatusQuery, [
        computedPaymentStatus,
        insertedPaymentResult.rows[0].stock_payment_id,
      ]);

      await client.query('COMMIT');

      return {
        payment: updatedPaymentResult.rows[0],
        total_paid: totalPaid,
        total_amount: totalAmount,
        payment_status: computedPaymentStatus,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Get stock payments by stock transaction ID
  findPaymentsByStockTransactionId: async (stockTransactionId) => {
    const stockTransactionQuery = `
      SELECT stock_transaction_id, total_amount
      FROM stock_transaction
      WHERE stock_transaction_id = $1
    `;
    const stockTransactionResult = await pool.query(stockTransactionQuery, [stockTransactionId]);

    if (!stockTransactionResult.rows[0]) {
      throw new Error('Stock transaction not found');
    }

    const totalAmount = Number(stockTransactionResult.rows[0].total_amount) || 0;

    const paymentsQuery = `
      SELECT
        sp.stock_payment_id,
        sp.stock_transaction_id,
        sp.stock_type_id,
        sp.bank_account_id,
        sp.amount_paid,
        sp.payment_status,
        sp.payment_on,
        sp.remarks,
        sp.created_at,
        sp.updated_at,
        ba.account_name,
        ba.account_number
      FROM stock_payment sp
      LEFT JOIN bank_account ba ON sp.bank_account_id = ba.bank_account_id
      WHERE sp.stock_transaction_id = $1
      ORDER BY sp.payment_on ASC, sp.created_at ASC
    `;

    const summaryQuery = `
      SELECT
        COUNT(*)::INT AS payment_count,
        COALESCE(SUM(amount_paid), 0) AS total_paid
      FROM stock_payment
      WHERE stock_transaction_id = $1
    `;

    const [paymentsResult, summaryResult] = await Promise.all([
      pool.query(paymentsQuery, [stockTransactionId]),
      pool.query(summaryQuery, [stockTransactionId]),
    ]);

    const totalPaid = Number(summaryResult.rows[0]?.total_paid) || 0;
    const balanceAmount = totalAmount - totalPaid;

    return {
      payments: paymentsResult.rows,
      summary: {
        payment_count: Number(summaryResult.rows[0]?.payment_count) || 0,
        total_amount: totalAmount,
        total_paid: totalPaid,
        balance_amount: balanceAmount,
      },
    };
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

  // Update stock transaction header and replace items
  updateWithItems: async (stockTransactionId, stockTransactionData, items) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existingQuery = `
        SELECT stock_transaction_id
        FROM stock_transaction
        WHERE stock_transaction_id = $1
        FOR UPDATE
      `;
      const existingResult = await client.query(existingQuery, [stockTransactionId]);
      if (existingResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const updateHeaderQuery = `
        UPDATE stock_transaction
        SET
          shop_id = $1,
          stock_type_id = $2,
          order_date = $3,
          description = $4,
          bank_account_id = $5,
          total_amount = $6,
          payment_status = $7,
          updated_at = CURRENT_TIMESTAMP
        WHERE stock_transaction_id = $8
        RETURNING *
      `;

      const updatedHeaderResult = await client.query(updateHeaderQuery, [
        stockTransactionData.shop_id,
        stockTransactionData.stock_type_id,
        stockTransactionData.order_date,
        stockTransactionData.description,
        stockTransactionData.bank_account_id,
        stockTransactionData.total_amount,
        stockTransactionData.payment_status,
        stockTransactionId,
      ]);

      const deleteItemsQuery = `
        DELETE FROM stock_transaction_items
        WHERE stock_transaction_id = $1
      `;
      await client.query(deleteItemsQuery, [stockTransactionId]);

      if (items && items.length > 0) {
        const insertItemQuery = `
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
          await client.query(insertItemQuery, [
            stockTransactionId,
            item.company_id,
            item.model_id,
            item.spare_id,
            item.quantity,
            item.price,
          ]);
        }
      }

      await client.query('COMMIT');
      return updatedHeaderResult.rows[0];
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
        st.payment_status,
        COALESCE(sp_pay.total_amount_paid, 0)::NUMERIC(15,2) AS amount_paid,
        st.created_at,
        st.updated_at
      FROM stock_transaction st
      LEFT JOIN shop s ON st.shop_id = s.shop_id
      LEFT JOIN stock_types stt ON st.stock_type_id = stt.stock_type_id
      LEFT JOIN bank_account ba ON st.bank_account_id = ba.bank_account_id
      LEFT JOIN (
        SELECT stock_transaction_id, COALESCE(SUM(amount_paid), 0) AS total_amount_paid
        FROM stock_payment
        GROUP BY stock_transaction_id
      ) sp_pay ON st.stock_transaction_id = sp_pay.stock_transaction_id
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
        st.payment_status,
        COALESCE(sp_pay.total_amount_paid, 0)::NUMERIC(15,2) AS amount_paid,
        st.created_at,
        st.updated_at
      FROM stock_transaction st
      LEFT JOIN shop s ON st.shop_id = s.shop_id
      LEFT JOIN stock_types stt ON st.stock_type_id = stt.stock_type_id
      LEFT JOIN bank_account ba ON st.bank_account_id = ba.bank_account_id
      LEFT JOIN (
        SELECT stock_transaction_id, COALESCE(SUM(amount_paid), 0) AS total_amount_paid
        FROM stock_payment
        GROUP BY stock_transaction_id
      ) sp_pay ON st.stock_transaction_id = sp_pay.stock_transaction_id
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
        st.shop_id,
        st.order_date,
        st.description,
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
      SELECT
        c.company_id,
        c.company_name,
        SUM(
          CASE
            WHEN stt.stock_type_code = 'PURCHASE' THEN sti.quantity
            WHEN stt.stock_type_code = 'RETURN' THEN -sti.quantity
            ELSE 0
          END
        ) AS current_quantity
      FROM stock_transaction_items sti
      JOIN stock_transaction st ON sti.stock_transaction_id = st.stock_transaction_id
      JOIN stock_types stt ON st.stock_type_id = stt.stock_type_id
      JOIN company c ON sti.company_id = c.company_id
      GROUP BY c.company_id, c.company_name
      HAVING SUM(
        CASE
          WHEN stt.stock_type_code = 'PURCHASE' THEN sti.quantity
          WHEN stt.stock_type_code = 'RETURN' THEN -sti.quantity
          ELSE 0
        END
      ) > 0
      ORDER BY c.company_name
    `;
    const result = await pool.query(query);
    return result.rows.map((row) => ({
      ...row,
      current_quantity: Number(row.current_quantity) || 0,
    }));
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

  // Get available stock and latest bought price for a specific item
  getStockAvailabilityDetails: async (companyId, modelId, spareId) => {
    const query = `
      WITH stock_balance AS (
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
          ) AS available_quantity
        FROM stock_transaction_items sti
        JOIN stock_transaction st ON sti.stock_transaction_id = st.stock_transaction_id
        JOIN stock_types stt ON st.stock_type_id = stt.stock_type_id
        WHERE sti.company_id = $1
          AND sti.model_id = $2
          AND sti.spare_id = $3
      ),
      latest_purchase AS (
        SELECT
          sti.price AS bought_price
        FROM stock_transaction_items sti
        JOIN stock_transaction st ON sti.stock_transaction_id = st.stock_transaction_id
        JOIN stock_types stt ON st.stock_type_id = stt.stock_type_id
        WHERE sti.company_id = $1
          AND sti.model_id = $2
          AND sti.spare_id = $3
          AND stt.stock_type_code = 'PURCHASE'
        ORDER BY st.order_date DESC, st.created_at DESC, sti.stock_transaction_item_id DESC
        LIMIT 1
      )
      SELECT
        sb.available_quantity,
        lp.bought_price
      FROM stock_balance sb
      LEFT JOIN latest_purchase lp ON true
    `;

    const result = await pool.query(query, [companyId, modelId, spareId]);
    const row = result.rows[0] || {};

    return {
      availableQuantity: Number(row.available_quantity) || 0,
      boughtPrice: row.bought_price !== null && row.bought_price !== undefined
        ? Number(row.bought_price)
        : null,
    };
  },

  // Get purchase stock transaction summary list
  getPurchaseStockList: async (page = 1, limit = 10, searchTerm = '') => {
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        st.stock_transaction_id,
        s.shop_name,
        COUNT(sti.stock_transaction_item_id)::INT AS no_of_items,
        COALESCE(st.total_amount, 0)::NUMERIC(15,2) AS total_price,
        COALESCE(sp_pay.total_amount_paid, 0)::NUMERIC(15,2) AS amount_paid,
        st.order_date AS purchase_date,
        COALESCE(st.payment_status, 'unpaid') AS payment_status
      FROM stock_transaction st
      JOIN stock_types stt ON st.stock_type_id = stt.stock_type_id
      LEFT JOIN shop s ON st.shop_id = s.shop_id
      LEFT JOIN stock_transaction_items sti ON st.stock_transaction_id = sti.stock_transaction_id
      LEFT JOIN (
        SELECT stock_transaction_id, COALESCE(SUM(amount_paid), 0) AS total_amount_paid
        FROM stock_payment
        GROUP BY stock_transaction_id
      ) sp_pay ON st.stock_transaction_id = sp_pay.stock_transaction_id
      WHERE stt.stock_type_code = 'PURCHASE'
    `;

    const queryParams = [];

    if (searchTerm) {
      queryParams.push(`%${searchTerm}%`);
      query += ` AND (
        COALESCE(s.shop_name, '') ILIKE $${queryParams.length}
        OR COALESCE(st.payment_status, '') ILIKE $${queryParams.length}
        OR CAST(COALESCE(st.total_amount, 0) AS TEXT) ILIKE $${queryParams.length}
      )`;
    }

    query += `
      GROUP BY st.stock_transaction_id, s.shop_name, st.total_amount, sp_pay.total_amount_paid, st.order_date, st.payment_status, st.created_at
      ORDER BY st.order_date DESC, st.created_at DESC
    `;

    const countQuery = `SELECT COUNT(*) FROM (${query}) AS count_query`;
    const countResult = await pool.query(countQuery, queryParams);
    const totalRecords = parseInt(countResult.rows[0].count);

    queryParams.push(limit, offset);
    query += ` LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;

    const result = await pool.query(query, queryParams);

    return {
      data: result.rows.map((row) => ({
        ...row,
        no_of_items: Number(row.no_of_items) || 0,
        total_price: Number(row.total_price) || 0,
        amount_paid: Number(row.amount_paid) || 0,
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalRecords / limit),
        totalRecords,
        limit,
      },
    };
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
          COALESCE(sp_pay.total_amount_paid, 0)::NUMERIC(15,2) AS amount_paid,
          st.created_at
        FROM stock_transaction_items sti
        JOIN stock_transaction st ON sti.stock_transaction_id = st.stock_transaction_id
        JOIN stock_types stt ON st.stock_type_id = stt.stock_type_id
        JOIN shop s ON st.shop_id = s.shop_id
        JOIN company c ON sti.company_id = c.company_id
        JOIN model m ON sti.model_id = m.model_id
        JOIN spare sp ON sti.spare_id = sp.spare_id
        JOIN bank_account ba ON st.bank_account_id = ba.bank_account_id
        LEFT JOIN (
          SELECT stock_transaction_id, COALESCE(SUM(amount_paid), 0) AS total_amount_paid
          FROM stock_payment
          GROUP BY stock_transaction_id
        ) sp_pay ON st.stock_transaction_id = sp_pay.stock_transaction_id
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
