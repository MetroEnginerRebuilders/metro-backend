const bankAccountRepository = require("../repository/bank_account.repository");

class BankAccountController {
  // Create new bank account
  async create(req, res) {
    try {
      const { accountName, accountNumber, openingBalance, activateDate } = req.body;

      // Validate input
      if (!accountName || accountName.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Account name is required",
        });
      }

      if (openingBalance === undefined || openingBalance === null) {
        return res.status(400).json({
          success: false,
          message: "Opening balance is required",
        });
      }

      if (isNaN(openingBalance)) {
        return res.status(400).json({
          success: false,
          message: "Opening balance must be a valid number",
        });
      }

      if (!activateDate) {
        return res.status(400).json({
          success: false,
          message: "Activate date is required",
        });
      }

      // Check if account name already exists
      const existingAccount = await bankAccountRepository.findByName(accountName.trim());
      if (existingAccount) {
        return res.status(409).json({
          success: false,
          message: "Account name already exists",
        });
      }

      // Create bank account
      const bankAccount = await bankAccountRepository.create({
        accountName: accountName.trim(),
        accountNumber: accountNumber ? accountNumber.trim() : null,
        openingBalance: parseFloat(openingBalance),
        activateDate
      });

      res.status(201).json({
        success: true,
        message: "Bank account created successfully",
        data: bankAccount,
      });
    } catch (error) {
      console.error("Create bank account error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }

  // Get all bank accounts with pagination and search
  async list(req, res) {
    try {
      const { search, page = 1 } = req.query;
      const limit = 10;
      const pageNum = parseInt(page);
      
      if (pageNum < 1) {
        return res.status(400).json({
          success: false,
          message: "Page number must be greater than 0",
        });
      }
      
      const result = await bankAccountRepository.findAll(search, pageNum, limit);
      const totalPages = Math.ceil(result.total / limit);

      res.json({
        success: true,
        data: result.data,
        pagination: {
          currentPage: pageNum,
          totalPages: totalPages,
          totalItems: result.total,
          itemsPerPage: limit,
          hasNextPage: pageNum < totalPages,
          hasPreviousPage: pageNum > 1
        }
      });
    } catch (error) {
      console.error("List bank accounts error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get active bank accounts
  async listActive(req, res) {
    try {
      const data = await bankAccountRepository.findActive();

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error("List active bank accounts error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get bank transactions by date range with search and pagination
  async listTransactions(req, res) {
    try {
      const fromDate = req.body?.fromDate || req.query?.fromDate;
      const toDate = req.body?.toDate || req.query?.toDate;
      const search = req.body?.search || req.query?.search || "";
      const hasLimit = req.body?.limit !== undefined || req.query?.limit !== undefined;
      const hasPage = req.body?.page !== undefined || req.query?.page !== undefined;
      const limit = hasLimit ? parseInt(req.body?.limit || req.query?.limit, 10) : null;
      const page = hasPage ? parseInt(req.body?.page || req.query?.page, 10) : 1;

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

      if (hasLimit && (Number.isNaN(limit) || limit < 1)) {
        return res.status(400).json({
          success: false,
          message: "limit must be greater than 0",
        });
      }

      if (hasPage && (Number.isNaN(page) || page < 1)) {
        return res.status(400).json({
          success: false,
          message: "page must be greater than 0",
        });
      }

      const result = await bankAccountRepository.findTransactions({
        fromDate,
        toDate,
        search,
        page,
        limit,
      });

      const currentPage = hasLimit ? page : 1;
      const totalPages = hasLimit ? Math.ceil(result.total / limit) : 1;

      return res.json({
        success: true,
        data: result.data,
        summary: {
          ...result.summary,
          net_amount: result.summary.total_income - result.summary.total_expense,
        },
        pagination: {
          currentPage,
          totalPages,
          totalItems: result.total,
          itemsPerPage: hasLimit ? limit : result.total,
          hasNextPage: hasLimit ? currentPage < totalPages : false,
          hasPreviousPage: hasLimit ? currentPage > 1 : false,
        },
      });
    } catch (error) {
      console.error("List bank transactions error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Update bank account
  async update(req, res) {
    try {
      const { bankAccountId } = req.params;
      const { accountName, accountNumber, openingBalance, activateDate, inactivateDate } = req.body;

      // Validate input
      if (!accountName || accountName.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Account name is required",
        });
      }

      if (openingBalance === undefined || openingBalance === null) {
        return res.status(400).json({
          success: false,
          message: "Opening balance is required",
        });
      }

      if (isNaN(openingBalance)) {
        return res.status(400).json({
          success: false,
          message: "Opening balance must be a valid number",
        });
      }

      if (!activateDate) {
        return res.status(400).json({
          success: false,
          message: "Activate date is required",
        });
      }

      // Check if bank account exists
      const existingAccount = await bankAccountRepository.findById(bankAccountId);
      if (!existingAccount) {
        return res.status(404).json({
          success: false,
          message: "Bank account not found",
        });
      }

      // Check if new account name already exists (excluding current account)
      const duplicateAccount = await bankAccountRepository.findByName(accountName.trim());
      if (duplicateAccount && duplicateAccount.bank_account_id !== bankAccountId) {
        return res.status(409).json({
          success: false,
          message: "Account name already exists",
        });
      }

      // Update bank account
      const updatedAccount = await bankAccountRepository.update(bankAccountId, {
        accountName: accountName.trim(),
        accountNumber: accountNumber ? accountNumber.trim() : null,
        openingBalance: parseFloat(openingBalance),
        activateDate,
        inactivateDate: inactivateDate || null
      });

      res.json({
        success: true,
        message: "Bank account updated successfully",
        data: updatedAccount,
      });
    } catch (error) {
      console.error("Update bank account error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Delete bank account
  async delete(req, res) {
    try {
      const { bankAccountId } = req.params;

      // Check if bank account exists
      const existingAccount = await bankAccountRepository.findById(bankAccountId);
      if (!existingAccount) {
        return res.status(404).json({
          success: false,
          message: "Bank account not found",
        });
      }

      // Delete bank account
      await bankAccountRepository.delete(bankAccountId);

      res.json({
        success: true,
        message: "Bank account deleted successfully",
      });
    } catch (error) {
      console.error("Delete bank account error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Account transfer
  async transfer(req, res) {
    try {
      const { fromAccountId, toAccountId, amount, transferDate } = req.body;

      // Validate input
      if (!fromAccountId) {
        return res.status(400).json({
          success: false,
          message: "From account ID is required",
        });
      }

      if (!toAccountId) {
        return res.status(400).json({
          success: false,
          message: "To account ID is required",
        });
      }

      if (fromAccountId === toAccountId) {
        return res.status(400).json({
          success: false,
          message: "From account and to account cannot be the same",
        });
      }

      if (amount === undefined || amount === null) {
        return res.status(400).json({
          success: false,
          message: "Amount is required",
        });
      }

      if (isNaN(amount) || parseFloat(amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: "Amount must be a positive number",
        });
      }

      if (!transferDate) {
        return res.status(400).json({
          success: false,
          message: "Transfer date is required",
        });
      }

      // Perform transfer
      const result = await bankAccountRepository.transfer({
        fromAccountId,
        toAccountId,
        amount: parseFloat(amount),
        transferDate
      });

      res.json({
        success: true,
        message: "Transfer completed successfully",
        data: result,
      });
    } catch (error) {
      console.error("Account transfer error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }
}

module.exports = new BankAccountController();
