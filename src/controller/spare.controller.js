const spareRepository = require("../repository/spare.repository");

class SpareController {
  // Create new spare
  async create(req, res) {
    try {
      const { spareName } = req.body;

      // Validate input
      if (!spareName || spareName.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Spare name is required",
        });
      }

      const existingSpareByName = await spareRepository.findByName(spareName.trim());
      if (existingSpareByName) {
        return res.status(409).json({
          success: false,
          message: "Spare name already exists",
        });
      }

      // Create spare
      const spare = await spareRepository.create(spareName.trim());

      res.status(201).json({
        success: true,
        message: "Spare created successfully",
        data: spare,
      });
    } catch (error) {
      console.error("Create spare error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get all spares with pagination and search
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
      
      const result = await spareRepository.findAll(search, pageNum, limit);
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
      console.error("List spares error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Update spare
  async update(req, res) {
    try {
      const { spareId } = req.params;
      const { spareName } = req.body;

      // Validate input
      if (!spareName || spareName.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Spare name is required",
        });
      }

      // Check if spare exists
      const existingSpare = await spareRepository.findById(spareId);
      if (!existingSpare) {
        return res.status(404).json({
          success: false,
          message: "Spare not found",
        });
      }

      const duplicateSpare = await spareRepository.findByName(spareName.trim());
      if (duplicateSpare && duplicateSpare.spare_id !== spareId) {
        return res.status(409).json({
          success: false,
          message: "Spare name already exists",
        });
      }

      // Update spare
      const updatedSpare = await spareRepository.update(spareId, spareName.trim());

      res.json({
        success: true,
        message: "Spare updated successfully",
        data: updatedSpare,
      });
    } catch (error) {
      console.error("Update spare error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Delete spare
  async delete(req, res) {
    try {
      const { spareId } = req.params;

      // Check if spare exists
      const existingSpare = await spareRepository.findById(spareId);
      if (!existingSpare) {
        return res.status(404).json({
          success: false,
          message: "Spare not found",
        });
      }

      // Delete spare
      await spareRepository.delete(spareId);

      res.json({
        success: true,
        message: "Spare deleted successfully",
      });
    } catch (error) {
      console.error("Delete spare error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new SpareController();
