const financeRepository = require("../repository/finance.repository");
const bankAccountRepository = require("../repository/bank_account.repository");
const dailyTransactionRepository = require("../repository/daily_transaction.repository");

class ExpenseController {
  // Create new expense record
  async createExpense(req, res) {
    try {
      const { 
        transactionDate, 
        description, 
        bankAccountId, 
        amount, 
        remarks, 
        financeCategoryId,
        financeTypeCode 
      } = req.body;

      // Validation
      if (!transactionDate || !bankAccountId || !financeCategoryId || !amount) {
        return res.status(400).json({
          success: false,
          message: "Transaction date, bank account, finance category, and amount are required",
        });
      }

      // Validate financeTypeCode
      if (financeTypeCode && financeTypeCode !== 'EXPENSE') {
        return res.status(400).json({
          success: false,
          message: "Something went wrong",
        });
      }

      // Get expense finance type ID
      const expenseTypeId = await financeRepository.getExpenseTypeId();
      
      if (!expenseTypeId) {
        return res.status(500).json({
          success: false,
          message: "Expense finance type not found in system",
        });
      }

      // Create expense record
      const expense = await financeRepository.create({
        bank_account_id: bankAccountId,
        finance_category_id: financeCategoryId,
        finance_type_id: expenseTypeId,
        amount: parseFloat(amount),
        transaction_date: transactionDate,
        description: description || null,
        remarks: remarks || null,
      });

      // Subtract amount from bank account balance with current date as last_transaction
      await bankAccountRepository.subtractBalance(
        bankAccountId,
        parseFloat(amount),
        new Date()
      );

      res.status(201).json({
        success: true,
        message: "Expense record created successfully",
        data: expense,
      });
    } catch (error) {
      console.error("Create expense error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }

  // Get all expense records with pagination
  async listExpense(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || '';
      const financeCategoryName = req.query.financeCategoryName || '';
      const financeTypeCode = req.query.financeTypeCode || 'EXPENSE';

      console.log("Listing expense records with params:", {
        page,
        limit,
        search,
        financeCategoryName,
        financeTypeCode
      });

      // Validate financeTypeCode
      if (financeTypeCode !== 'EXPENSE') {
        return res.status(400).json({
          success: false,
          message: "Invalid financeTypeCode. Expected 'EXPENSE'",
        });
      }

      // Get expense finance type ID based on code
      const expenseTypeId = await financeRepository.getExpenseTypeId();
      
      if (!expenseTypeId) {
        return res.status(500).json({
          success: false,
          message: "Expense finance type not found in system",
        });
      }

      // Get all finance records and filter for expense
      const allFinance = await financeRepository.findAll();
      let expenseRecords = allFinance.filter(record => record.finance_type_id === expenseTypeId);

      // Apply finance category name filter if provided
      if (financeCategoryName && financeCategoryName.trim() !== '') {
        const categoryFilter = financeCategoryName.toLowerCase().trim();
        expenseRecords = expenseRecords.filter(record => {
          const categoryName = record.finance_category_name || '';
          return categoryName.toLowerCase().trim() === categoryFilter;
        });
      }

      // Apply search filter if search parameter exists
      if (search && search.trim() !== '') {
        const searchLower = search.toLowerCase().trim();
        expenseRecords = expenseRecords.filter(record => {
          return (
            (record.description && record.description.toLowerCase().includes(searchLower)) ||
            (record.remarks && record.remarks.toLowerCase().includes(searchLower)) ||
            (record.account_name && record.account_name.toLowerCase().includes(searchLower)) ||
            (record.finance_category_name && record.finance_category_name.toLowerCase().includes(searchLower)) ||
            (record.amount && record.amount.toString().includes(searchLower))
          );
        });
      }

      // Calculate pagination
      const totalRecords = expenseRecords.length;
      const totalPages = Math.ceil(totalRecords / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedRecords = expenseRecords.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: paginatedRecords,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalRecords: totalRecords,
          limit: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      });
    } catch (error) {
      console.error("List expense error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get expense record by ID
  async getExpenseById(req, res) {
    try {
      const { id } = req.params;
      const expense = await financeRepository.findById(id);

      if (!expense) {
        return res.status(404).json({
          success: false,
          message: "Expense record not found",
        });
      }

      // Verify it's an expense record
      const expenseTypeId = await financeRepository.getExpenseTypeId();
      if (expense.finance_type_id !== expenseTypeId) {
        return res.status(404).json({
          success: false,
          message: "Record is not an expense transaction",
        });
      }

      res.json({
        success: true,
        data: expense,
      });
    } catch (error) {
      console.error("Get expense by ID error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Update expense record
  async updateExpense(req, res) {
    try {
      const { id } = req.params;
      const { 
        transactionDate, 
        description, 
        bankAccountId, 
        amount, 
        remarks, 
        financeCategoryId,
        financeTypeCode 
      } = req.body;

      // Validation
      if (!transactionDate || !bankAccountId || !financeCategoryId || !amount) {
        return res.status(400).json({
          success: false,
          message: "Transaction date, bank account, finance category, and amount are required",
        });
      }

      // Validate financeTypeCode
      if (financeTypeCode && financeTypeCode !== 'EXPENSE') {
        return res.status(400).json({
          success: false,
          message: "Invalid financeTypeCode. Expected 'EXPENSE'",
        });
      }

      // Get existing expense record to check old amount
      const existingExpense = await financeRepository.findById(id);
      if (!existingExpense) {
        return res.status(404).json({
          success: false,
          message: "Expense record not found",
        });
      }

      // Get expense finance type ID
      const expenseTypeId = await financeRepository.getExpenseTypeId();
      
      if (!expenseTypeId) {
        return res.status(500).json({
          success: false,
          message: "Expense finance type not found in system",
        });
      }

      // Verify it's an expense record
      if (existingExpense.finance_type_id !== expenseTypeId) {
        return res.status(400).json({
          success: false,
          message: "Record is not an expense transaction",
        });
      }

      const oldAmount = parseFloat(existingExpense.amount);
      const newAmount = parseFloat(amount);
      const amountDifference = newAmount - oldAmount;

      // Update expense record
      const expense = await financeRepository.update(id, {
        bank_account_id: bankAccountId,
        finance_category_id: financeCategoryId,
        finance_type_id: expenseTypeId,
        amount: newAmount,
        transaction_date: transactionDate,
        description: description || null,
        remarks: remarks || null,
      });

      if (!expense) {
        return res.status(404).json({
          success: false,
          message: "Expense record not found",
        });
      }

      // Update bank account balance based on amount difference
      // For expenses: if new amount > old amount, subtract more from bank
      //               if new amount < old amount, add back to bank
      if (amountDifference > 0) {
        // New expense amount is greater - subtract additional amount from bank account
        await bankAccountRepository.subtractBalance(
          bankAccountId,
          amountDifference,
          new Date()
        );
      } else if (amountDifference < 0) {
        // New expense amount is less - add back the difference to bank account
        await bankAccountRepository.addBalance(
          bankAccountId,
          Math.abs(amountDifference),
          new Date()
        );
      }
      // If amountDifference === 0, no change needed

      res.json({
        success: true,
        message: "Expense record updated successfully",
        data: expense,
      });
    } catch (error) {
      console.error("Update expense error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Delete expense record
  async deleteExpense(req, res) {
    try {
      const { id } = req.params;
      
      // Verify it's an expense record before deleting
      const record = await financeRepository.findById(id);
      if (!record) {
        return res.status(404).json({
          success: false,
          message: "Expense record not found",
        });
      }

      const expenseTypeId = await financeRepository.getExpenseTypeId();
      if (record.finance_type_id !== expenseTypeId) {
        return res.status(400).json({
          success: false,
          message: "Record is not an expense transaction",
        });
      }

      // Delete the expense record
      const expense = await financeRepository.delete(id);

      // Add back the expense amount to bank account (reversing the expense)
      await bankAccountRepository.addBalance(
        record.bank_account_id,
        parseFloat(record.amount),
        new Date()
      );

      res.json({
        success: true,
        message: "Expense record deleted successfully",
        data: expense,
      });
    } catch (error) {
      console.error("Delete expense error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get expense records by date range
  async getExpenseByDateRange(req, res) {
    try {
      const fromDate =
        req.body?.fromDate || req.query?.fromDate || req.body?.startDate || req.query?.startDate;
      const toDate =
        req.body?.toDate || req.query?.toDate || req.body?.endDate || req.query?.endDate;

      if (!fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          message: "fromDate and toDate are required",
        });
      }

      const start = new Date(fromDate);
      const end = new Date(toDate);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid fromDate or toDate",
        });
      }

      if (start > end) {
        return res.status(400).json({
          success: false,
          message: "fromDate must be less than or equal to toDate",
        });
      }

      const expenseRecords = await dailyTransactionRepository.getExpenseTransactionsByDateRange(
        fromDate,
        toDate
      );

      res.json({
        success: true,
        message: "Expense transactions fetched successfully",
        data: expenseRecords,
      });
    } catch (error) {
      console.error("Get expense by date range error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new ExpenseController();
