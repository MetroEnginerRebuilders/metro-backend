const workRepository = require("../repository/work.repository");

class WorkController {
  // Create new work
  async create(req, res) {
    try {
      const { workName } = req.body;

      // Validate input
      if (!workName || workName.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Work name is required",
        });
      }

      // Create work
      const work = await workRepository.create(workName.trim());

      res.status(201).json({
        success: true,
        message: "Work created successfully",
        data: work,
      });
    } catch (error) {
      console.error("Create work error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get all works with pagination and search
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
      
      const result = await workRepository.findAll(search, pageNum, limit);
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
      console.error("List works error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Update work
  async update(req, res) {
    try {
      const { workId } = req.params;
      const { workName } = req.body;

      // Validate input
      if (!workName || workName.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Work name is required",
        });
      }

      // Check if work exists
      const existingWork = await workRepository.findById(workId);
      if (!existingWork) {
        return res.status(404).json({
          success: false,
          message: "Work not found",
        });
      }

      // Update work
      const updatedWork = await workRepository.update(workId, workName.trim());

      res.json({
        success: true,
        message: "Work updated successfully",
        data: updatedWork,
      });
    } catch (error) {
      console.error("Update work error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Delete work
  async delete(req, res) {
    try {
      const { workId } = req.params;

      // Check if work exists
      const existingWork = await workRepository.findById(workId);
      if (!existingWork) {
        return res.status(404).json({
          success: false,
          message: "Work not found",
        });
      }

      // Delete work
      await workRepository.delete(workId);

      res.json({
        success: true,
        message: "Work deleted successfully",
      });
    } catch (error) {
      console.error("Delete work error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new WorkController();
