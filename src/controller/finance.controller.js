const financeRepository = require("../repository/finance.repository");

class FinanceController {
  // Get all income finance records (finance_type_code = 'INCOME')
  async list(req, res) {
    try {
      const incomeTypeId = await financeRepository.getIncomeTypeId();
      
      if (!incomeTypeId) {
        return res.status(500).json({
          success: false,
          message: "Income finance type not found in system",
        });
      }

      const allFinance = await financeRepository.findAll();
      const incomeRecords = allFinance.filter(record => record.finance_type_id === incomeTypeId);

      res.json({
        success: true,
        data: incomeRecords,
      });
    } catch (error) {
      console.error("List finance error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get income finance record by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const finance = await financeRepository.findById(id);

      if (!finance) {
        return res.status(404).json({
          success: false,
          message: "Finance record not found",
        });
      }

      // Verify it's an income record
      const incomeTypeId = await financeRepository.getIncomeTypeId();
      if (finance.finance_type_id !== incomeTypeId) {
        return res.status(404).json({
          success: false,
          message: "Record is not an income transaction",
        });
      }

      res.json({
        success: true,
        data: finance,
      });
    } catch (error) {
      console.error("Get finance by ID error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Create new income finance record
  async create(req, res) {
    try {
      const { 
        bank_account_id, 
        finance_category_id, 
        amount, 
        transaction_date,
        description,
        remarks 
      } = req.body;

      // Validation
      if (!bank_account_id || !finance_category_id || !amount || !transaction_date) {
        return res.status(400).json({
          success: false,
          message: "Bank account, finance category, amount, and transaction date are required",
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

      const finance = await financeRepository.create({
        bank_account_id,
        finance_category_id,
        finance_type_id: incomeTypeId,
        amount,
        transaction_date,
        description,
        remarks,
      });

      res.status(201).json({
        success: true,
        message: "Income finance record created successfully",
        data: finance,
      });
    } catch (error) {
      console.error("Create finance error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Update income finance record
  async update(req, res) {
    try {
      const { id } = req.params;
      const { 
        bank_account_id, 
        finance_category_id, 
        amount, 
        transaction_date,
        description,
        remarks 
      } = req.body;

      // Validation
      if (!bank_account_id || !finance_category_id || !amount || !transaction_date) {
        return res.status(400).json({
          success: false,
          message: "Bank account, finance category, amount, and transaction date are required",
        });
      }

      // Verify it's an income record before updating
      const existingRecord = await financeRepository.findById(id);
      if (!existingRecord) {
        return res.status(404).json({
          success: false,
          message: "Finance record not found",
        });
      }

      const incomeTypeId = await financeRepository.getIncomeTypeId();
      if (existingRecord.finance_type_id !== incomeTypeId) {
        return res.status(400).json({
          success: false,
          message: "Record is not an income transaction and cannot be updated through this endpoint",
        });
      }

      const finance = await financeRepository.update(id, {
        bank_account_id,
        finance_category_id,
        finance_type_id: incomeTypeId,
        amount,
        transaction_date,
        description,
        remarks,
      });

      res.json({
        success: true,
        message: "Income finance record updated successfully",
        data: finance,
      });
    } catch (error) {
      console.error("Update finance error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Delete finance record (income or expense based on financeTypeCode)
  async delete(req, res) {
    try {
      const { id } = req.params;
      const { financeTypeCode } = req.query;

      // Verify record exists
      const record = await financeRepository.findById(id);
      if (!record) {
        return res.status(404).json({
          success: false,
          message: "Finance record not found",
        });
      }

      // If financeTypeCode is provided, verify it matches
      if (financeTypeCode) {
        if (financeTypeCode === 'INCOME') {
          const incomeTypeId = await financeRepository.getIncomeTypeId();
          if (record.finance_type_id !== incomeTypeId) {
            return res.status(400).json({
              success: false,
              message: "Record is not an income transaction",
            });
          }
        } else if (financeTypeCode === 'EXPENSE') {
          const expenseTypeId = await financeRepository.getExpenseTypeId();
          if (record.finance_type_id !== expenseTypeId) {
            return res.status(400).json({
              success: false,
              message: "Record is not an expense transaction",
            });
          }
        }
      }

      // Delete finance and related invoice items
      const finance = await financeRepository.delete(id);

      res.json({
        success: true,
        message: "Finance record deleted successfully",
        data: finance,
      });
    } catch (error) {
      console.error("Delete finance error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get income finance records by date range
  async getByDateRange(req, res) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: "Start date and end date are required",
        });
      }

      const incomeTypeId = await financeRepository.getIncomeTypeId();
      const allFinance = await financeRepository.findByDateRange(startDate, endDate);
      const incomeRecords = allFinance.filter(record => record.finance_type_id === incomeTypeId);

      res.json({
        success: true,
        data: incomeRecords,
      });
    } catch (error) {
      console.error("Get finance by date range error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get income finance records by bank account
  async getByBankAccount(req, res) {
    try {
      const { bankAccountId } = req.params;
      
      const incomeTypeId = await financeRepository.getIncomeTypeId();
      const allFinance = await financeRepository.findByBankAccount(bankAccountId);
      const incomeRecords = allFinance.filter(record => record.finance_type_id === incomeTypeId);

      res.json({
        success: true,
        data: incomeRecords,
      });
    } catch (error) {
      console.error("Get finance by bank account error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async getMonthlyReport(req, res) {
    try {
      const { month, year } = req.body;

      if (!month || !year) {
        return res.status(400).json({
          success: false,
          message: "Month and year are required",
        });
      }

      const monthNum = new Date(`${month} 1, ${year}`).getMonth() + 1;
      if (isNaN(monthNum)) {
        return res.status(400).json({
          success: false,
          message: "Invalid month or year",
        });
      }

      const report = await financeRepository.getMonthlyReport(monthNum, parseInt(year));

      res.json({
        success: true,
        message: "Monthly report generated successfully",
        data: report,
      });
    } catch (error) {
      console.error("Get monthly report error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async downloadMonthlyReportPDF(req, res) {
    try {
      const { month, year } = req.body;

      if (!month || !year) {
        return res.status(400).json({
          success: false,
          message: "Month and year are required",
        });
      }

      const monthNum = new Date(`${month} 1, ${year}`).getMonth() + 1;
      if (isNaN(monthNum)) {
        return res.status(400).json({
          success: false,
          message: "Invalid month or year",
        });
      }

      const report = await financeRepository.getMonthlyReport(monthNum, parseInt(year));

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Monthly_Report_${report.month}_${report.year}.pdf"`
      );

      const monthlyReportPDFGenerator = require("../utils/monthlyReportPDFGenerator");
      monthlyReportPDFGenerator.generateMonthlyReportPDF(report, res);
    } catch (error) {
      console.error("Download monthly report PDF error:", error);

      if (res.headersSent) {
        res.end();
        return;
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
}

module.exports = new FinanceController();
