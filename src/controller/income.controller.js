const financeRepository = require("../repository/finance.repository");
const bankAccountRepository = require("../repository/bank_account.repository");
const dailyTransactionRepository = require("../repository/daily_transaction.repository");

class IncomeController {
  // Create new income record
  async createIncome(req, res) {
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
      if (financeTypeCode && financeTypeCode !== 'INCOME') {
        return res.status(400).json({
          success: false,
          message: "Something went wrong",
        });
      }

      // Get income finance type ID
      const incomeTypeId = await financeRepository.getIncomeTypeId();
      
      if (!incomeTypeId) {
        return res.status(500).json({
          success: false,
          message: "Income finance type not found in system",
        });
      }

      // Create income record
      const income = await financeRepository.create({
        bank_account_id: bankAccountId,
        finance_category_id: financeCategoryId,
        finance_type_id: incomeTypeId,
        amount: parseFloat(amount),
        transaction_date: transactionDate,
        description: description || null,
        remarks: remarks || null,
      });

      // Add amount to bank account balance with current date as last_transaction
      await bankAccountRepository.addBalance(
        bankAccountId,
        parseFloat(amount),
        new Date()
      );

      res.status(201).json({
        success: true,
        message: "Income record created successfully",
        data: income,
      });
    } catch (error) {
      console.error("Create income error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }

  // Get all income records with pagination
  async listIncome(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || '';
      const financeCategoryName = req.query.financeCategoryName || '';
      const financeTypeCode = req.query.financeTypeCode || 'INCOME';

      console.log("Listing income records with params:", {
        page,
        limit,
        search,
        financeCategoryName,
        financeTypeCode
      });

      // Validate financeTypeCode
      if (financeTypeCode !== 'INCOME') {
        return res.status(400).json({
          success: false,
          message: "Invalid financeTypeCode. Expected 'INCOME'",
        });
      }

      // Get income finance type ID based on code
      const incomeTypeId = await financeRepository.getIncomeTypeId();
      
      if (!incomeTypeId) {
        return res.status(500).json({
          success: false,
          message: "Income finance type not found in system",
        });
      }

      // Get all finance records and filter for income
      const allFinance = await financeRepository.findAll();
      let incomeRecords = allFinance.filter(record => record.finance_type_id === incomeTypeId);

      // Apply finance category name filter if provided
      if (financeCategoryName && financeCategoryName.trim() !== '') {
        const categoryFilter = financeCategoryName.toLowerCase().trim();
        incomeRecords = incomeRecords.filter(record => {
          const categoryName = record.finance_category_name || '';
          return categoryName.toLowerCase().trim() === categoryFilter;
        });
      }

      // Apply search filter if search parameter exists
      if (search && search.trim() !== '') {
        const searchLower = search.toLowerCase().trim();
        incomeRecords = incomeRecords.filter(record => {
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
      const totalRecords = incomeRecords.length;
      const totalPages = Math.ceil(totalRecords / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedRecords = incomeRecords.slice(startIndex, endIndex);

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
      console.error("List income error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get income record by ID
  async getIncomeById(req, res) {
    try {
      const { id } = req.params;
      const income = await financeRepository.findById(id);

      if (!income) {
        return res.status(404).json({
          success: false,
          message: "Income record not found",
        });
      }

      // Verify it's an income record
      const incomeTypeId = await financeRepository.getIncomeTypeId();
      if (income.finance_type_id !== incomeTypeId) {
        return res.status(404).json({
          success: false,
          message: "Record is not an income transaction",
        });
      }

      res.json({
        success: true,
        data: income,
      });
    } catch (error) {
      console.error("Get income by ID error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Update income record
  async updateIncome(req, res) {
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
      if (financeTypeCode && financeTypeCode !== 'INCOME') {
        return res.status(400).json({
          success: false,
          message: "Invalid financeTypeCode. Expected 'INCOME'",
        });
      }

      // Get existing income record to check old amount
      const existingIncome = await financeRepository.findById(id);
      if (!existingIncome) {
        return res.status(404).json({
          success: false,
          message: "Income record not found",
        });
      }

      // Get income finance type ID
      const incomeTypeId = await financeRepository.getIncomeTypeId();
      
      if (!incomeTypeId) {
        return res.status(500).json({
          success: false,
          message: "Income finance type not found in system",
        });
      }

      // Verify it's an income record
      if (existingIncome.finance_type_id !== incomeTypeId) {
        return res.status(400).json({
          success: false,
          message: "Record is not an income transaction",
        });
      }

      const oldAmount = parseFloat(existingIncome.amount);
      const newAmount = parseFloat(amount);
      const amountDifference = newAmount - oldAmount;

      // Update income record
      const income = await financeRepository.update(id, {
        bank_account_id: bankAccountId,
        finance_category_id: financeCategoryId,
        finance_type_id: incomeTypeId,
        amount: newAmount,
        transaction_date: transactionDate,
        description: description || null,
        remarks: remarks || null,
      });

      if (!income) {
        return res.status(404).json({
          success: false,
          message: "Income record not found",
        });
      }

      // Update bank account balance based on amount difference
      if (amountDifference > 0) {
        // New amount is greater - add the difference to bank account
        await bankAccountRepository.addBalance(
          bankAccountId,
          amountDifference,
          new Date()
        );
      } else if (amountDifference < 0) {
        // New amount is less - subtract the difference from bank account
        await bankAccountRepository.subtractBalance(
          bankAccountId,
          Math.abs(amountDifference),
          new Date()
        );
      }
      // If amountDifference === 0, no change needed

      res.json({
        success: true,
        message: "Income record updated successfully",
        data: income,
      });
    } catch (error) {
      console.error("Update income error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Delete income record
  async deleteIncome(req, res) {
    try {
      const { id } = req.params;
      
      // Verify it's an income record before deleting
      const record = await financeRepository.findById(id);
      if (!record) {
        return res.status(404).json({
          success: false,
          message: "Income record not found",
        });
      }

      const incomeTypeId = await financeRepository.getIncomeTypeId();
      if (record.finance_type_id !== incomeTypeId) {
        return res.status(400).json({
          success: false,
          message: "Record is not an income transaction",
        });
      }

      // Delete the income record
      const income = await financeRepository.delete(id);

      // Subtract the income amount from bank account (reversing the income)
      await bankAccountRepository.subtractBalance(
        record.bank_account_id,
        parseFloat(record.amount),
        new Date()
      );

      res.json({
        success: true,
        message: "Income record deleted successfully",
        data: income,
      });
    } catch (error) {
      console.error("Delete income error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get income records by date range
  async getIncomeByDateRange(req, res) {
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

      const incomeRecords = await dailyTransactionRepository.getIncomeTransactionsByDateRange(
        fromDate,
        toDate
      );

      res.json({
        success: true,
        message: "Income transactions fetched successfully",
        data: incomeRecords,
      });
    } catch (error) {
      console.error("Get income by date range error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new IncomeController();
