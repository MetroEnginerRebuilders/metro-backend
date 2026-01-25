const staffRepository = require("../repository/staff.repository");

class StaffController {
  // Create new staff
  async create(req, res) {
    try {
      const { staffName, salary, activeDate } = req.body;

      // Validate input
      if (!staffName || staffName.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Staff name is required",
        });
      }

      if (salary !== undefined && salary !== null && isNaN(salary)) {
        return res.status(400).json({
          success: false,
          message: "Salary must be a valid number",
        });
      }

      if (!activeDate) {
        return res.status(400).json({
          success: false,
          message: "Active date is required",
        });
      }

      // Create staff
      const staff = await staffRepository.create({
        staffName: staffName.trim(),
        salary: salary ? parseFloat(salary) : null,
        activeDate
      });

      res.status(201).json({
        success: true,
        message: "Staff created successfully",
        data: staff,
      });
    } catch (error) {
      console.error("Create staff error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }

  // Get all staff with pagination and search
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
      
      const result = await staffRepository.findAll(search, pageNum, limit);
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
      console.error("List staff error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get all active staff with pagination and search
  async listActive(req, res) {
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
      
      const result = await staffRepository.findActive(search, pageNum, limit);
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
      console.error("List active staff error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Update staff
  async update(req, res) {
    try {
      const { staffId } = req.params;
      const { staffName, salary, activeDate, inactiveDate } = req.body;

      // Validate input
      if (!staffName || staffName.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Staff name is required",
        });
      }

      if (salary !== undefined && salary !== null && isNaN(salary)) {
        return res.status(400).json({
          success: false,
          message: "Salary must be a valid number",
        });
      }

      if (!activeDate) {
        return res.status(400).json({
          success: false,
          message: "Active date is required",
        });
      }

      // Check if staff exists
      const existingStaff = await staffRepository.findById(staffId);
      if (!existingStaff) {
        return res.status(404).json({
          success: false,
          message: "Staff not found",
        });
      }

      // Update staff
      const updatedStaff = await staffRepository.update(staffId, {
        staffName: staffName.trim(),
        salary: salary ? parseFloat(salary) : null,
        activeDate,
        inactiveDate: inactiveDate || null
      });

      res.json({
        success: true,
        message: "Staff updated successfully",
        data: updatedStaff,
      });
    } catch (error) {
      console.error("Update staff error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }

  // Delete staff
  async delete(req, res) {
    try {
      const { staffId } = req.params;

      // Check if staff exists
      const existingStaff = await staffRepository.findById(staffId);
      if (!existingStaff) {
        return res.status(404).json({
          success: false,
          message: "Staff not found",
        });
      }

      // Delete staff
      await staffRepository.delete(staffId);

      res.json({
        success: true,
        message: "Staff deleted successfully",
      });
    } catch (error) {
      console.error("Delete staff error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new StaffController();
