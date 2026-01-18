const shopRepository = require("../repository/shop.repository");

class ShopController {
  // Create new shop
  async create(req, res) {
    try {
      const { shopName, shopAddress, shopPhoneNumber } = req.body;

      // Validate input
      if (!shopName || shopName.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Shop name is required",
        });
      }

      // Create shop
      const shop = await shopRepository.create({
        shopName: shopName.trim(),
        shopAddress: shopAddress?.trim() || "",
        shopPhoneNumber: shopPhoneNumber?.trim() || ""
      });

      res.status(201).json({
        success: true,
        message: "Shop created successfully",
        data: shop,
      });
    } catch (error) {
      console.error("Create shop error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get all shops with pagination and search
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
      
      const result = await shopRepository.findAll(search, pageNum, limit);
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
      console.error("List shops error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Update shop
  async update(req, res) {
    try {
      const { shopId } = req.params;
      const { shopName, shopAddress, shopPhoneNumber } = req.body;

      // Validate input
      if (!shopName || shopName.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Shop name is required",
        });
      }

      // Check if shop exists
      const existingShop = await shopRepository.findById(shopId);
      if (!existingShop) {
        return res.status(404).json({
          success: false,
          message: "Shop not found",
        });
      }

      // Update shop
      const updatedShop = await shopRepository.update(shopId, {
        shopName: shopName.trim(),
        shopAddress: shopAddress?.trim() || "",
        shopPhoneNumber: shopPhoneNumber?.trim() || ""
      });

      res.json({
        success: true,
        message: "Shop updated successfully",
        data: updatedShop,
      });
    } catch (error) {
      console.error("Update shop error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Delete shop
  async delete(req, res) {
    try {
      const { shopId } = req.params;

      // Check if shop exists
      const existingShop = await shopRepository.findById(shopId);
      if (!existingShop) {
        return res.status(404).json({
          success: false,
          message: "Shop not found",
        });
      }

      // Delete shop
      await shopRepository.delete(shopId);

      res.json({
        success: true,
        message: "Shop deleted successfully",
      });
    } catch (error) {
      console.error("Delete shop error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new ShopController();
