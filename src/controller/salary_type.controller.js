const salaryTypeRepository = require("../repository/salary_type.repository");

class SalaryTypeController {
  // Get all salary types
  async list(req, res) {
    try {
      const salaryTypes = await salaryTypeRepository.findAll();

      res.json({
        success: true,
        data: salaryTypes,
      });
    } catch (error) {
      console.error("List salary types error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new SalaryTypeController();
