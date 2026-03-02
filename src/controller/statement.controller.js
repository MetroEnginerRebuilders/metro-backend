const statementRepository = require("../repository/statement.repository");

class StatementController {
  async getStatement(req, res) {
    try {
      const { type, shopId, customerId } = req.body || {};

      if (!type) {
        return res.status(400).json({
          success: false,
          message: "type is required",
        });
      }

      if (type === "shop") {
        if (!shopId) {
          return res.status(400).json({
            success: false,
            message: "shopId is required when type is shop",
          });
        }

        const data = await statementRepository.getShopStatement(shopId);
        return res.json({
          success: true,
          message: "Shop statement fetched successfully",
          data,
        });
      }

      if (type === "customer") {
        if (!customerId) {
          return res.status(400).json({
            success: false,
            message: "customerId is required when type is customer",
          });
        }

        const data = await statementRepository.getCustomerStatement(customerId);
        return res.json({
          success: true,
          message: "Customer statement fetched successfully",
          data,
        });
      }

      return res.status(400).json({
        success: false,
        message: "Invalid type. Expected 'shop' or 'customer'",
      });
    } catch (error) {
      console.error("Get statement error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new StatementController();
