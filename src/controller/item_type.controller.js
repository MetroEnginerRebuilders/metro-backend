const itemTypeRepository = require("../repository/item_type.repository");

class ItemTypeController {
  async list(req, res) {
    try {
      const itemTypes = await itemTypeRepository.findAll();

      res.json({
        success: true,
        data: itemTypes,
      });
    } catch (error) {
      console.error("List item types error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new ItemTypeController();
