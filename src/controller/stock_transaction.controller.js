const stockTransactionRepository = require('../repository/stock_transaction.repository');
const bankAccountRepository = require('../repository/bank_account.repository');
const dailyTransactionRepository = require('../repository/daily_transaction.repository');

const stockTransactionController = {
  // Create stock transaction
  create: async (req, res) => {
    try {
      const {
        shopId,
        transactionTypeId,
        bankAccountId,
        orderDate,
        description,
        items,
        totalAmount
      } = req.body;

      // Validate required fields
      if (!transactionTypeId || !bankAccountId || !orderDate || !items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: transactionTypeId, bankAccountId, orderDate, items'
        });
      }

      // Get stock type info to determine PURCHASE or RETURN
      const stockType = await stockTransactionRepository.getStockTypeById(transactionTypeId);
      if (!stockType) {
        return res.status(400).json({
          success: false,
          message: 'Invalid transaction type ID'
        });
      }

      // If transaction type is RETURN, validate stock availability
      if (stockType.stock_type_code === 'RETURN') {
        for (const item of items) {
          const availableStock = await stockTransactionRepository.getAvailableStock(
            item.companyId,
            item.modelId,
            item.itemId
          );

          if (item.quantity > availableStock) {
            return res.status(400).json({
              success: false,
              message: `Insufficient stock. We have only ${availableStock} units available for this item.`,
              availableQuantity: availableStock,
              requestedQuantity: item.quantity
            });
          }
        }
      }

      // Calculate total amount from items if not provided
      const calculatedTotal = items.reduce((sum, item) => {
        return sum + (item.quantity * item.unitPrice);
      }, 0);

      const finalTotalAmount = totalAmount || calculatedTotal;

      // Prepare stock transaction data
      const stockTransactionData = {
        shop_id: shopId || null,
        stock_type_id: transactionTypeId,
        order_date: orderDate,
        description: description || '',
        bank_account_id: bankAccountId,
        total_amount: finalTotalAmount
      };

      // Prepare items data (map frontend fields to database fields)
      const itemsData = items.map(item => ({
        company_id: item.companyId,
        model_id: item.modelId,
        spare_id: item.itemId,
        quantity: item.quantity,
        price: item.unitPrice
      }));

      // Create stock transaction
      const stockTransaction = await stockTransactionRepository.create(stockTransactionData, itemsData);

      // Update bank account balance
      const currentDate = new Date().toISOString().split('T')[0];
      if (stockType.stock_type_code === 'PURCHASE') {
        // Purchase: subtract from bank account (like expense)
        await bankAccountRepository.subtractBalance(bankAccountId, finalTotalAmount, currentDate);
      } else if (stockType.stock_type_code === 'RETURN') {
        // Return: add to bank account (like income)
        await bankAccountRepository.addBalance(bankAccountId, finalTotalAmount, currentDate);
      }

      const financeTypeCode = stockType.stock_type_code === 'PURCHASE' ? 'EXPENSE' : 'INCOME';
      const financeTypeId = await dailyTransactionRepository.getFinanceTypeIdByCode(financeTypeCode);

      await dailyTransactionRepository.deleteByReference('stock', stockTransaction.stock_transaction_id);
      await dailyTransactionRepository.create({
        shop_id: stockTransaction.shop_id,
        finance_types_id: financeTypeId,
        finance_categories_id: null,
        reference_type: 'stock',
        reference_id: stockTransaction.stock_transaction_id,
        bank_account_id: stockTransaction.bank_account_id,
        amount: stockTransaction.total_amount,
        transaction_date: stockTransaction.order_date,
        description: stockTransaction.description || null
      });

      res.status(201).json({
        success: true,
        message: 'Stock Created Successfully',
        data: stockTransaction
      });
    } catch (error) {
      console.error('Error creating stock transaction:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create stock transaction',
        error: error.message
      });
    }
  },

  // Update stock transaction (header + all items)
  update: async (req, res) => {
    try {
      const { stockTransactionId } = req.params;
      const {
        shopId,
        transactionTypeId,
        bankAccountId,
        orderDate,
        description,
        items,
        totalAmount,
        paymentStatus
      } = req.body;

      if (!stockTransactionId) {
        return res.status(400).json({
          success: false,
          message: 'stockTransactionId is required'
        });
      }

      if (!transactionTypeId || !bankAccountId || !orderDate || !items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: transactionTypeId, bankAccountId, orderDate, items'
        });
      }

      const stockType = await stockTransactionRepository.getStockTypeById(transactionTypeId);
      if (!stockType) {
        return res.status(400).json({
          success: false,
          message: 'Invalid transaction type ID'
        });
      }

      if (stockType.stock_type_code === 'RETURN') {
        for (const item of items) {
          const availableStock = await stockTransactionRepository.getAvailableStock(
            item.companyId,
            item.modelId,
            item.itemId
          );

          if (item.quantity > availableStock) {
            return res.status(400).json({
              success: false,
              message: `Insufficient stock. We have only ${availableStock} units available for this item.`,
              availableQuantity: availableStock,
              requestedQuantity: item.quantity
            });
          }
        }
      }

      const existingTransaction = await stockTransactionRepository.findById(stockTransactionId);
      if (!existingTransaction) {
        return res.status(404).json({
          success: false,
          message: 'Stock transaction not found'
        });
      }

      const oldTotalAmount = Number(existingTransaction.total_amount) || 0;
      const oldBankAccountId = existingTransaction.bank_account_id;
      const oldStockTypeCode = existingTransaction.stock_type_code;

      const calculatedTotal = items.reduce((sum, item) => {
        return sum + (item.quantity * item.unitPrice);
      }, 0);
      const finalTotalAmount = totalAmount || calculatedTotal;

      const validPaymentStatuses = ['unpaid', 'partial', 'paid', 'pending'];
      const finalPaymentStatus = paymentStatus && validPaymentStatuses.includes(String(paymentStatus).toLowerCase())
        ? String(paymentStatus).toLowerCase()
        : (existingTransaction.payment_status || 'unpaid');

      const stockTransactionData = {
        shop_id: shopId || null,
        stock_type_id: transactionTypeId,
        order_date: orderDate,
        description: description || '',
        bank_account_id: bankAccountId,
        total_amount: finalTotalAmount,
        payment_status: finalPaymentStatus,
      };

      const itemsData = items.map(item => ({
        company_id: item.companyId,
        model_id: item.modelId,
        spare_id: item.itemId,
        quantity: item.quantity,
        price: item.unitPrice
      }));

      const updatedTransaction = await stockTransactionRepository.updateWithItems(
        stockTransactionId,
        stockTransactionData,
        itemsData
      );

      if (!updatedTransaction) {
        return res.status(404).json({
          success: false,
          message: 'Stock transaction not found'
        });
      }

      const currentDate = new Date().toISOString().split('T')[0];

      if (oldBankAccountId && oldTotalAmount > 0) {
        if (oldStockTypeCode === 'PURCHASE') {
          await bankAccountRepository.addBalance(oldBankAccountId, oldTotalAmount, currentDate);
        } else if (oldStockTypeCode === 'RETURN') {
          await bankAccountRepository.subtractBalance(oldBankAccountId, oldTotalAmount, currentDate);
        }
      }

      if (stockType.stock_type_code === 'PURCHASE') {
        await bankAccountRepository.subtractBalance(bankAccountId, finalTotalAmount, currentDate);
      } else if (stockType.stock_type_code === 'RETURN') {
        await bankAccountRepository.addBalance(bankAccountId, finalTotalAmount, currentDate);
      }

      const financeTypeCode = stockType.stock_type_code === 'PURCHASE' ? 'EXPENSE' : 'INCOME';
      const financeTypeId = await dailyTransactionRepository.getFinanceTypeIdByCode(financeTypeCode);

      await dailyTransactionRepository.deleteByReference('stock', stockTransactionId);
      await dailyTransactionRepository.create({
        shop_id: updatedTransaction.shop_id,
        finance_types_id: financeTypeId,
        finance_categories_id: null,
        reference_type: 'stock',
        reference_id: stockTransactionId,
        bank_account_id: updatedTransaction.bank_account_id,
        amount: updatedTransaction.total_amount,
        transaction_date: updatedTransaction.order_date,
        description: updatedTransaction.description || null
      });

      const latestData = await stockTransactionRepository.findById(stockTransactionId);

      res.status(200).json({
        success: true,
        message: 'Stock Updated Successfully',
        data: latestData
      });
    } catch (error) {
      console.error('Error updating stock transaction:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update stock transaction',
        error: error.message
      });
    }
  },

  // Get all stock transactions with pagination and search
  getAll: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const searchTerm = req.query.search || '';

      const result = await stockTransactionRepository.findAll(page, limit, searchTerm);

      res.status(200).json({
        success: true,
        message: 'Stock transactions retrieved successfully',
        ...result
      });
    } catch (error) {
      console.error('Error fetching stock transactions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch stock transactions',
        error: error.message
      });
    }
  },

  // Get stock transaction by ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const stockTransaction = await stockTransactionRepository.findById(id);

      if (!stockTransaction) {
        return res.status(404).json({
          success: false,
          message: 'Stock transaction not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Stock transaction retrieved successfully',
        data: stockTransaction
      });
    } catch (error) {
      console.error('Error fetching stock transaction:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch stock transaction',
        error: error.message
      });
    }
  },

  // Get stock transaction details by transaction ID with name-based fields
  getDetailsByTransactionId: async (req, res) => {
    try {
      const { stockTransactionId } = req.params;

      const stockTransaction = await stockTransactionRepository.findById(stockTransactionId);

      if (!stockTransaction) {
        return res.status(404).json({
          success: false,
          message: 'Stock transaction not found'
        });
      }

      const data = {
        transaction: {
          stock_transaction_id: stockTransaction.stock_transaction_id,
          shop_id: stockTransaction.shop_id,
          shop_name: stockTransaction.shop_name,
          stock_type_id: stockTransaction.stock_type_id,
          stock_type_name: stockTransaction.stock_type_name,
          stock_type_code: stockTransaction.stock_type_code,
          bank_account_id: stockTransaction.bank_account_id,
          account_name: stockTransaction.account_name,
          account_number: stockTransaction.account_number,
          order_date: stockTransaction.order_date,
          description: stockTransaction.description,
          total_amount: Number(stockTransaction.total_amount) || 0,
          payment_status: stockTransaction.payment_status || 'unpaid',
          created_at: stockTransaction.created_at,
          updated_at: stockTransaction.updated_at
        },
        items: (stockTransaction.items || []).map((item) => ({
          stock_transaction_item_id: item.stock_transaction_item_id,
          company_id: item.company_id,
          company_name: item.company_name,
          model_id: item.model_id,
          model_name: item.model_name,
          spare_id: item.spare_id,
          spare_name: item.spare_name,
          quantity: Number(item.quantity) || 0,
          price: Number(item.price) || 0,
          line_total: Number(item.line_total) || 0
        }))
      };

      res.status(200).json({
        success: true,
        message: 'Stock transaction details retrieved successfully',
        data
      });
    } catch (error) {
      console.error('Error fetching stock transaction details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch stock transaction details',
        error: error.message
      });
    }
  },

  // Delete single stock transaction item
  deleteItem: async (req, res) => {
    try {
      const { itemId } = req.params;

      // Get item details before deletion
      const itemDetails = await stockTransactionRepository.getItemDetails(itemId);
      if (!itemDetails) {
        return res.status(404).json({
          success: false,
          message: 'Stock transaction item not found'
        });
      }

      // Check how many items exist in this transaction
      const itemCount = await stockTransactionRepository.countTransactionItems(itemDetails.stock_transaction_id);

      // Update bank account balance with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const itemAmount = parseFloat(itemDetails.item_amount);
      const transactionType = itemDetails.stock_type_code;

      if (itemCount === 1) {
        // Only one item exists - delete entire transaction
        await stockTransactionRepository.deleteTransaction(itemDetails.stock_transaction_id);
        await dailyTransactionRepository.deleteByReference('stock', itemDetails.stock_transaction_id);
      } else {
        // Multiple items exist - delete only this item
        await stockTransactionRepository.deleteItem(itemId);
        // Update transaction total amount
        const updatedTotal = await stockTransactionRepository.updateTransactionTotal(itemDetails.stock_transaction_id);

        const financeTypeCodeForLedger = itemDetails.stock_type_code === 'PURCHASE' ? 'EXPENSE' : 'INCOME';
        const financeTypeIdForLedger = await dailyTransactionRepository.getFinanceTypeIdByCode(financeTypeCodeForLedger);

        await dailyTransactionRepository.deleteByReference('stock', itemDetails.stock_transaction_id);
        await dailyTransactionRepository.create({
          shop_id: itemDetails.shop_id,
          finance_types_id: financeTypeIdForLedger,
          finance_categories_id: null,
          reference_type: 'stock',
          reference_id: itemDetails.stock_transaction_id,
          bank_account_id: itemDetails.bank_account_id,
          amount: updatedTotal.total_amount,
          transaction_date: itemDetails.order_date,
          description: itemDetails.description || null
        });
      }

      // Reverse bank account balance
      if (transactionType === 'PURCHASE') {
        // Reverse purchase: add back to bank account
        await bankAccountRepository.addBalance(itemDetails.bank_account_id, itemAmount, currentDate);
      } else if (transactionType === 'RETURN') {
        // Reverse return: subtract from bank account
        await bankAccountRepository.subtractBalance(itemDetails.bank_account_id, itemAmount, currentDate);
      }

      res.status(200).json({
        success: true,
        message: itemCount === 1 
          ? 'Stock Deleted Successfully' 
          : 'Stock Deleted Successfully'
      });
    } catch (error) {
      console.error('Error deleting stock transaction item:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete stock transaction item',
        error: error.message
      });
    }
  },

  // Get models by company from stock transactions
  getModelsByCompany: async (req, res) => {
    try {
      const { companyId } = req.params;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID is required'
        });
      }

      const models = await stockTransactionRepository.getModelsByCompany(companyId);

      res.status(200).json({
        success: true,
        message: 'Models retrieved successfully',
        data: models
      });
    } catch (error) {
      console.error('Error fetching models by company:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch models',
        error: error.message
      });
    }
  },

  // Get spares by model from stock transactions
  getSparesByModel: async (req, res) => {
    try {
      const { modelId } = req.params;

      if (!modelId) {
        return res.status(400).json({
          success: false,
          message: 'Model ID is required'
        });
      }

      const spares = await stockTransactionRepository.getSparesByModel(modelId);

      res.status(200).json({
        success: true,
        message: 'Spares retrieved successfully',
        data: spares
      });
    } catch (error) {
      console.error('Error fetching spares by model:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch spares',
        error: error.message
      });
    }
  },

  // Get companies from stock transactions
  getCompanies: async (req, res) => {
    try {
      const companies = await stockTransactionRepository.getCompanies();

      res.status(200).json({
        success: true,
        message: 'Companies with available stock retrieved successfully',
        data: companies
      });
    } catch (error) {
      console.error('Error fetching companies:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch companies',
        error: error.message
      });
    }
  },

  // Get stock availability details for a specific company/model/spare
  getStockAvailabilityDetails: async (req, res) => {
    try {
      const { companyId, modelId, spareId } = req.body;

      if (!companyId || !modelId || !spareId) {
        return res.status(400).json({
          success: false,
          message: 'companyId, modelId and spareId are required'
        });
      }

      const data = await stockTransactionRepository.getStockAvailabilityDetails(
        companyId,
        modelId,
        spareId
      );

      res.status(200).json({
        success: true,
        message: 'Stock availability fetched successfully',
        data
      });
    } catch (error) {
      console.error('Error fetching stock availability details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch stock availability details',
        error: error.message
      });
    }
  },

  // Get stock list by type (PURCHASE, RETURN, or current stock)
  getStockList: async (req, res) => {
    try {
      const stockTypeCode = req.query.stockTypeCode || null;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const searchTerm = req.query.search || '';

      const result = await stockTransactionRepository.getStockList(stockTypeCode, page, limit, searchTerm);

      res.status(200).json({
        success: true,
        message: stockTypeCode 
          ? `${stockTypeCode} stock list retrieved successfully` 
          : 'Current stock list retrieved successfully',
        ...result
      });
    } catch (error) {
      console.error('Error fetching stock list:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch stock list',
        error: error.message
      });
    }
  },

  // Get purchase stock summary list
  getPurchaseStockList: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const searchTerm = req.query.search || '';

      const result = await stockTransactionRepository.getPurchaseStockList(page, limit, searchTerm);

      res.status(200).json({
        success: true,
        message: 'Purchase stock list retrieved successfully',
        ...result
      });
    } catch (error) {
      console.error('Error fetching purchase stock list:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch purchase stock list',
        error: error.message
      });
    }
  }
};

module.exports = stockTransactionController;
