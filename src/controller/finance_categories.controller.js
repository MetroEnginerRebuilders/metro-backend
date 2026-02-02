const financeCategoriesRepository = require("../repository/finance_categories.repository");

class FinanceCategoriesController {
  // Get income categories
  async listIncome(req, res) {
    try {
      const financeCategories = await financeCategoriesRepository.findByFinanceTypeCode('INCOME');

      res.json({
        success: true,
        data: financeCategories,
      });
    } catch (error) {
      console.error("List income categories error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get expense categories
  async listExpense(req, res) {
    try {
      const financeCategories = await financeCategoriesRepository.findByFinanceTypeCode('EXPENSE');

      res.json({
        success: true,
        data: financeCategories,
      });
    } catch (error) {
      console.error("List expense categories error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get finance categories by finance type code
  async list(req, res) {
    try {
      const { finance_type_code } = req.query;

      if (!finance_type_code) {
        return res.status(400).json({
          success: false,
          message: "finance_type_code query parameter is required",
        });
      }

      const financeCategories = await financeCategoriesRepository.findByFinanceTypeCode(finance_type_code);

      res.json({
        success: true,
        data: financeCategories,
      });
    } catch (error) {
      console.error("List finance categories error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get all finance categories
  async listAll(req, res) {
    try {
      const financeCategories = await financeCategoriesRepository.findAll();

      res.json({
        success: true,
        data: financeCategories,
      });
    } catch (error) {
      console.error("List all finance categories error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new FinanceCategoriesController();
