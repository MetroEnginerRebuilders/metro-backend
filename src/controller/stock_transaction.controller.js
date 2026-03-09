const stockTransactionRepository = require('../repository/stock_transaction.repository');
const bankAccountRepository = require('../repository/bank_account.repository');
const dailyTransactionRepository = require('../repository/daily_transaction.repository');
const shopRepository = require('../repository/shop.repository');

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
        totalAmount,
        paidAmount = 0,
        useShopCredit = true,
      } = req.body;

      // Validate required fields
      if (!transactionTypeId || !orderDate || !items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: transactionTypeId, orderDate, items'
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
      const immediatePaidAmount = Math.max(0, Number(paidAmount) || 0);

      if (immediatePaidAmount > 0 && !bankAccountId) {
        return res.status(400).json({
          success: false,
          message: 'bankAccountId is required when paidAmount is greater than 0'
        });
      }

      // Prepare stock transaction data
      const stockTransactionData = {
        shop_id: shopId || null,
        stock_type_id: transactionTypeId,
        order_date: orderDate,
        description: description || '',
        bank_account_id: bankAccountId || null,
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
      const selectedShop = shopId ? await shopRepository.findById(shopId) : null;
      const selectedShopName = selectedShop?.shop_name || 'selected shop';

      let adjustedByCredit = 0;
      let paidNow = 0;
      let initialPaymentResult = null;

      if (stockType.stock_type_code === 'PURCHASE') {
        if (useShopCredit !== false && shopId) {
          adjustedByCredit = await stockTransactionRepository.applyAvailableCreditToPurchase({
            shopId,
            stockTransactionId: stockTransaction.stock_transaction_id,
            purchaseAmount: finalTotalAmount,
            remarks: `Auto adjustment of credit from ${selectedShopName}`,
          });
        }

        const remainingPayable = Math.max(Number(finalTotalAmount) - adjustedByCredit, 0);
        paidNow = Math.min(immediatePaidAmount, remainingPayable);

        if (paidNow > 0) {
          await bankAccountRepository.subtractBalance(bankAccountId, paidNow, orderDate);
          initialPaymentResult = await stockTransactionRepository.addPayment({
            stockTransactionId: stockTransaction.stock_transaction_id,
            bankAccountId,
            amountPaid: paidNow,
            paymentOn: orderDate,
            remarks: 'Initial purchase payment',
          });
        }
      } else if (stockType.stock_type_code === 'RETURN') {
        paidNow = Math.min(immediatePaidAmount, Number(finalTotalAmount) || 0);

        if (paidNow > 0) {
          await bankAccountRepository.addBalance(bankAccountId, paidNow, orderDate);
          initialPaymentResult = await stockTransactionRepository.addPayment({
            stockTransactionId: stockTransaction.stock_transaction_id,
            bankAccountId,
            amountPaid: paidNow,
            paymentOn: orderDate,
            remarks: 'Initial return settlement',
          });
        }

        const creditAmount = Math.max(Number(finalTotalAmount) - paidNow, 0);
        if (creditAmount > 0 && shopId) {
          await stockTransactionRepository.createCreditLedgerEntry({
            shopId,
            stockTransactionId: stockTransaction.stock_transaction_id,
            entryType: 'RETURN_CREDIT',
            amount: creditAmount,
            remarks: `Return credit from ${selectedShopName}`,
          });
        }
      }

      const paymentMeta = await stockTransactionRepository.calculateAndUpdatePaymentStatus(stockTransaction.stock_transaction_id);

      if (initialPaymentResult?.payment?.stock_payment_id && paidNow > 0) {
        const financeTypeCode = stockType.stock_type_code === 'PURCHASE' ? 'EXPENSE' : 'INCOME';
        const financeTypeId = await dailyTransactionRepository.getFinanceTypeIdByCode(financeTypeCode);

        await dailyTransactionRepository.create({
          shop_id: stockTransaction.shop_id,
          finance_types_id: financeTypeId,
          finance_categories_id: null,
          reference_type: 'stock_payment',
          reference_id: initialPaymentResult.payment.stock_payment_id,
          bank_account_id: stockTransaction.bank_account_id,
          amount: paidNow,
          transaction_date: stockTransaction.order_date,
          description: stockTransaction.description || `Initial ${String(stockType.stock_type_code || '').toLowerCase()} settlement`,
        });
      }

      const latestData = await stockTransactionRepository.findById(stockTransaction.stock_transaction_id);

      res.status(201).json({
        success: true,
        message: 'Stock Created Successfully',
        data: {
          ...latestData,
          payment_summary: paymentMeta,
          adjusted_by_credit: adjustedByCredit,
          paid_now: paidNow,
        }
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
        paymentStatus,
        paidAmount = 0,
        useShopCredit = true,
      } = req.body;

      if (!stockTransactionId) {
        return res.status(400).json({
          success: false,
          message: 'stockTransactionId is required'
        });
      }

      if (!transactionTypeId || !orderDate || !items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: transactionTypeId, orderDate, items'
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

      const calculatedTotal = items.reduce((sum, item) => {
        return sum + (item.quantity * item.unitPrice);
      }, 0);
      const finalTotalAmount = totalAmount || calculatedTotal;
      const immediatePaidAmount = Math.max(0, Number(paidAmount) || 0);

      if (immediatePaidAmount > 0 && !bankAccountId) {
        return res.status(400).json({
          success: false,
          message: 'bankAccountId is required when paidAmount is greater than 0'
        });
      }

      const validPaymentStatuses = ['unpaid', 'partial', 'paid', 'pending'];
      const finalPaymentStatus = paymentStatus && validPaymentStatuses.includes(String(paymentStatus).toLowerCase())
        ? String(paymentStatus).toLowerCase()
        : (existingTransaction.payment_status || 'unpaid');

      const stockTransactionData = {
        shop_id: shopId || null,
        stock_type_id: transactionTypeId,
        order_date: orderDate,
        description: description || '',
        bank_account_id: bankAccountId || null,
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
      const selectedShop = shopId ? await shopRepository.findById(shopId) : null;
      const selectedShopName = selectedShop?.shop_name || 'selected shop';

      if (!updatedTransaction) {
        return res.status(404).json({
          success: false,
          message: 'Stock transaction not found'
        });
      }

      let adjustedByCredit = 0;
      let paidNow = 0;
      let additionalPaymentResult = null;

      if (stockType.stock_type_code === 'PURCHASE') {
        if (useShopCredit !== false && shopId) {
          adjustedByCredit = await stockTransactionRepository.applyAvailableCreditToPurchase({
            shopId,
            stockTransactionId,
            purchaseAmount: finalTotalAmount,
            remarks: `Auto adjustment of credit from ${selectedShopName}`,
          });
        }

        const alreadyPaid = Number(existingTransaction.amount_paid) || 0;
        const remainingPayable = Math.max(Number(finalTotalAmount) - adjustedByCredit - alreadyPaid, 0);
        paidNow = Math.min(immediatePaidAmount, remainingPayable);

        if (paidNow > 0) {
          await bankAccountRepository.subtractBalance(bankAccountId, paidNow, orderDate);
          additionalPaymentResult = await stockTransactionRepository.addPayment({
            stockTransactionId,
            bankAccountId,
            amountPaid: paidNow,
            paymentOn: orderDate,
            remarks: 'Additional payment on purchase update',
          });
        }
      } else if (stockType.stock_type_code === 'RETURN') {
        const alreadyPaid = Number(existingTransaction.amount_paid) || 0;
        const remainingReceivable = Math.max(Number(finalTotalAmount) - alreadyPaid, 0);
        paidNow = Math.min(immediatePaidAmount, remainingReceivable);

        if (paidNow > 0) {
          await bankAccountRepository.addBalance(bankAccountId, paidNow, orderDate);
          additionalPaymentResult = await stockTransactionRepository.addPayment({
            stockTransactionId,
            bankAccountId,
            amountPaid: paidNow,
            paymentOn: orderDate,
            remarks: 'Additional settlement on return update',
          });
        }

        const unsettledCredit = Math.max(Number(finalTotalAmount) - (alreadyPaid + paidNow), 0);
        if (unsettledCredit > 0 && shopId) {
          await stockTransactionRepository.createCreditLedgerEntry({
            shopId,
            stockTransactionId,
            entryType: 'RETURN_CREDIT',
            amount: unsettledCredit,
            remarks: `Return credit from ${selectedShopName}`,
          });
        }
      }

      const paymentMeta = await stockTransactionRepository.calculateAndUpdatePaymentStatus(stockTransactionId);

      await dailyTransactionRepository.deleteByReference('stock', stockTransactionId);

      if (additionalPaymentResult?.payment?.stock_payment_id && paidNow > 0) {
        const financeTypeCode = stockType.stock_type_code === 'PURCHASE' ? 'EXPENSE' : 'INCOME';
        const financeTypeId = await dailyTransactionRepository.getFinanceTypeIdByCode(financeTypeCode);

        await dailyTransactionRepository.create({
          shop_id: updatedTransaction.shop_id,
          finance_types_id: financeTypeId,
          finance_categories_id: null,
          reference_type: 'stock_payment',
          reference_id: additionalPaymentResult.payment.stock_payment_id,
          bank_account_id: updatedTransaction.bank_account_id,
          amount: paidNow,
          transaction_date: updatedTransaction.order_date,
          description: updatedTransaction.description || `Additional ${String(stockType.stock_type_code || '').toLowerCase()} settlement`,
        });
      }

      const latestData = await stockTransactionRepository.findById(stockTransactionId);

      res.status(200).json({
        success: true,
        message: 'Stock Updated Successfully',
        data: {
          ...latestData,
          payment_summary: paymentMeta,
          adjusted_by_credit: adjustedByCredit,
          paid_now: paidNow,
        }
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

  // Add payment for stock transaction
  payStockTransaction: async (req, res) => {
    try {
      const {
        stockTransactionId,
        bankAccountId,
        amountPaid,
        paymentDate,
        remarks,
      } = req.body;

      if (!stockTransactionId || !bankAccountId || amountPaid === undefined || amountPaid === null || !paymentDate) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: stockTransactionId, bankAccountId, amountPaid, paymentDate'
        });
      }

      const paidAmount = Number(amountPaid);
      if (Number.isNaN(paidAmount) || paidAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'amountPaid must be greater than 0'
        });
      }

      const parsedPaymentDate = new Date(paymentDate);
      if (Number.isNaN(parsedPaymentDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid paymentDate'
        });
      }

      const bankAccount = await bankAccountRepository.findById(bankAccountId);
      if (!bankAccount) {
        return res.status(404).json({
          success: false,
          message: 'Bank account not found'
        });
      }

      const result = await stockTransactionRepository.addPayment({
        stockTransactionId,
        bankAccountId,
        amountPaid: paidAmount,
        paymentOn: paymentDate,
        remarks: remarks || null,
      });

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Stock transaction not found'
        });
      }

      const stockTransaction = await stockTransactionRepository.findById(stockTransactionId);

      if (result.stock_type_code === 'PURCHASE') {
        await bankAccountRepository.subtractBalance(bankAccountId, paidAmount, paymentDate);
      } else if (result.stock_type_code === 'RETURN') {
        await bankAccountRepository.addBalance(bankAccountId, paidAmount, paymentDate);

        if (stockTransaction?.shop_id) {
          const availableCredit = await stockTransactionRepository.getShopCreditBalance(stockTransaction.shop_id);
          const debitAmount = Math.min(availableCredit, paidAmount);

          if (debitAmount > 0) {
          await stockTransactionRepository.createCreditLedgerEntry({
            shopId: stockTransaction.shop_id,
            stockTransactionId,
            entryType: 'MANUAL_DEBIT',
            amount: debitAmount,
            remarks: remarks || `Credit settlement from ${stockTransaction?.shop_name || 'selected shop'}`,
          });
          }
        }
      }

      const financeTypeCode = result.stock_type_code === 'RETURN' ? 'INCOME' : 'EXPENSE';
      const financeTypeId = await dailyTransactionRepository.getFinanceTypeIdByCode(financeTypeCode);
      await dailyTransactionRepository.create({
        shop_id: stockTransaction?.shop_id || null,
        finance_types_id: financeTypeId,
        finance_categories_id: null,
        reference_type: 'stock_payment',
        reference_id: result.payment.stock_payment_id,
        bank_account_id: bankAccountId,
        amount: paidAmount,
        transaction_date: paymentDate,
        description: remarks || `Stock ${String(result.stock_type_code || '').toLowerCase()} payment for transaction ${stockTransactionId}`,
      });

      return res.status(201).json({
        success: true,
        message: 'Stock payment added successfully',
        data: {
          stock_payment_id: result.payment.stock_payment_id,
          stock_transaction_id: result.payment.stock_transaction_id,
          stock_type_id: result.payment.stock_type_id,
          bank_account_id: result.payment.bank_account_id,
          amount_paid: Number(result.payment.amount_paid) || 0,
          payment_status: result.payment_status,
          payment_on: result.payment.payment_on,
          remarks: result.payment.remarks,
          total_paid: result.total_paid,
          total_amount: result.total_amount,
          created_at: result.payment.created_at,
          updated_at: result.payment.updated_at,
        },
      });
    } catch (error) {
      console.error('Error adding stock payment:', error);

      if (error.message === 'amountPaid exceeds balance amount') {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to add stock payment',
        error: error.message,
      });
    }
  },

  // View payments by stock transaction ID
  listPaymentsByStockTransactionId: async (req, res) => {
    try {
      const { stockTransactionId } = req.params;

      if (!stockTransactionId) {
        return res.status(400).json({
          success: false,
          message: 'stockTransactionId is required',
        });
      }

      const result = await stockTransactionRepository.findPaymentsByStockTransactionId(stockTransactionId);

      return res.status(200).json({
        success: true,
        message: 'Stock payments fetched successfully',
        data: {
          stock_transaction_id: stockTransactionId,
          summary: {
            payment_count: Number(result.summary?.payment_count || 0),
            total_amount: Number(result.summary?.total_amount || 0),
            total_paid: Number(result.summary?.total_paid || 0),
            balance_amount: Number(result.summary?.balance_amount || 0),
          },
          payments: result.payments,
        },
      });
    } catch (error) {
      console.error('Error fetching stock payments:', error);

      if (error.message === 'Stock transaction not found') {
        return res.status(404).json({
          success: false,
          message: 'Stock transaction not found',
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Internal server error',
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
          ...(stockTransaction.stock_type_code === 'RETURN'
            ? {
                credit_amount: Number(stockTransaction.total_amount) || 0,
                amount_get: Number(stockTransaction.amount_paid) || 0,
              }
            : {
                total_amount: Number(stockTransaction.total_amount) || 0,
                amount_paid: Number(stockTransaction.amount_paid) || 0,
              }),
          payment_status: stockTransaction.payment_status || 'unpaid',
          created_at: stockTransaction.created_at,
          updated_at: stockTransaction.updated_at
        },
        credit_details: {
          credit_amount: Number(stockTransaction.credit_summary?.credit_amount) || 0,
          adjusted_amount: Number(stockTransaction.credit_summary?.adjusted_amount) || 0,
        },
        credit_entries: (stockTransaction.credit_ledger || []).map((entry) => ({
          credit_ledger_id: entry.credit_ledger_id,
          entry_type: entry.entry_type,
          amount: Number(entry.amount) || 0,
          remarks: entry.remarks,
          created_at: entry.created_at,
        })),
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
  },

  // Get returned stock summary list
  getReturnStockList: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const searchTerm = req.query.search || '';

      const result = await stockTransactionRepository.getReturnStockList(page, limit, searchTerm);

      res.status(200).json({
        success: true,
        message: 'Returned stock list retrieved successfully',
        ...result
      });
    } catch (error) {
      console.error('Error fetching returned stock list:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch returned stock list',
        error: error.message
      });
    }
  },

  // Get returned stock transaction details by transaction ID
  getReturnDetailsByTransactionId: async (req, res) => {
    try {
      const { stockTransactionId } = req.params;

      const stockTransaction = await stockTransactionRepository.findById(stockTransactionId);

      if (!stockTransaction || stockTransaction.stock_type_code !== 'RETURN') {
        return res.status(404).json({
          success: false,
          message: 'Returned stock transaction not found'
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
          credit_amount: Number(stockTransaction.total_amount) || 0,
          amount_get: Number(stockTransaction.amount_paid) || 0,
          payment_status: stockTransaction.payment_status || 'unpaid',
          created_at: stockTransaction.created_at,
          updated_at: stockTransaction.updated_at
        },
        credit_details: {
          credit_amount: Number(stockTransaction.credit_summary?.credit_amount) || 0,
          adjusted_amount: Number(stockTransaction.credit_summary?.adjusted_amount) || 0,
        },
        credit_entries: (stockTransaction.credit_ledger || []).map((entry) => ({
          credit_ledger_id: entry.credit_ledger_id,
          entry_type: entry.entry_type,
          amount: Number(entry.amount) || 0,
          remarks: entry.remarks,
          created_at: entry.created_at,
        })),
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
        message: 'Returned stock details retrieved successfully',
        data
      });
    } catch (error) {
      console.error('Error fetching returned stock details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch returned stock details',
        error: error.message
      });
    }
  },

  // Get shop credit balance summary by shop ID
  getShopCreditBalance: async (req, res) => {
    try {
      const shopId = req.body?.shopId || req.query?.shopId || req.params?.shopId;

      if (!shopId) {
        return res.status(400).json({
          success: false,
          message: 'shopId is required',
        });
      }

      const summary = await stockTransactionRepository.getShopCreditSummary(shopId);

      return res.status(200).json({
        success: true,
        message: 'Shop credit balance fetched successfully',
        data: {
          shop_id: shopId,
          credit_amount_to_get: Number(summary.credit_amount_to_get) || 0,
          has_credit_balance: Boolean(summary.has_credit_balance),
        },
      });
    } catch (error) {
      console.error('Error fetching shop credit balance:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch shop credit balance',
        error: error.message,
      });
    }
  }
};

module.exports = stockTransactionController;
