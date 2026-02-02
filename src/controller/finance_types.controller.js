const financeTypesRepository = require("../repository/finance_types.repository");

class FinanceTypesController {
  // Get all finance types
  async list(req, res) {
    try {
      const financeTypes = await financeTypesRepository.findAll();

      res.json({
        success: true,
        data: financeTypes,
      });
    } catch (error) {
      console.error("List finance types error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new FinanceTypesController();
