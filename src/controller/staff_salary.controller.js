const staffSalaryRepository = require("../repository/staff_salary.repository");

class StaffSalaryController {
  // Get current month salary summary for a staff
  async getMonthlySummary(req, res) {
    try {
      const { staffId } = req.params;

      if (!staffId) {
        return res.status(400).json({
          success: false,
          message: "Staff ID is required",
        });
      }

      const staff = await staffSalaryRepository.getStaffById(staffId);
      if (!staff) {
        return res.status(404).json({
          success: false,
          message: "Staff not found",
        });
      }

      const summary = await staffSalaryRepository.getMonthlySalarySummaryByStaffId(staffId);

      res.json({
        success: true,
        message: "Monthly salary summary fetched successfully",
        data: summary,
      });
    } catch (error) {
      console.error("Get monthly salary summary error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Create new staff salary
  async create(req, res) {
    try {
      const { staffId, bankAccountId, effectiveDate, amount, salaryTypeId, remarks } = req.body;

      // Validate input
      if (!staffId) {
        return res.status(400).json({
          success: false,
          message: "Staff ID is required",
        });
      }

      if (!bankAccountId) {
        return res.status(400).json({
          success: false,
          message: "Bank account ID is required",
        });
      }

      if (!effectiveDate) {
        return res.status(400).json({
          success: false,
          message: "Effective date is required",
        });
      }

      if (amount === undefined || amount === null) {
        return res.status(400).json({
          success: false,
          message: "Amount is required",
        });
      }

      if (isNaN(amount) || parseFloat(amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: "Amount must be a positive number",
        });
      }

      if (!salaryTypeId) {
        return res.status(400).json({
          success: false,
          message: "Salary type ID is required",
        });
      }

      // Get staff details to check salary
      const staff = await staffSalaryRepository.getStaffById(staffId);
      if (!staff) {
        return res.status(404).json({
          success: false,
          message: "Staff not found",
        });
      }

      // Check if amount is less than or equal to staff salary
      if (staff.salary && parseFloat(amount) > parseFloat(staff.salary)) {
        return res.status(400).json({
          success: false,
          message: `Amount cannot be greater than staff salary (${staff.salary})`,
        });
      }

      // Create staff salary
      const staffSalary = await staffSalaryRepository.create({
        staffId,
        bankAccountId,
        effectiveDate,
        amount: parseFloat(amount),
        salaryTypeId,
        remarks
      });

      res.status(201).json({
        success: true,
        message: "Staff salary created successfully",
        data: staffSalary,
      });
    } catch (error) {
      console.error("Create staff salary error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }

  // Get all staff salaries with pagination and search
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
      
      const result = await staffSalaryRepository.findAll(search, pageNum, limit);
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
      console.error("List staff salaries error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Update staff salary
  async update(req, res) {
    try {
      const { staffSalaryId } = req.params;
      const { staffId, bankAccountId, effectiveDate, amount, salaryTypeId, remarks } = req.body;

      // Validate input
      if (!staffId) {
        return res.status(400).json({
          success: false,
          message: "Staff ID is required",
        });
      }

      if (!bankAccountId) {
        return res.status(400).json({
          success: false,
          message: "Bank account ID is required",
        });
      }

      if (!effectiveDate) {
        return res.status(400).json({
          success: false,
          message: "Effective date is required",
        });
      }

      if (amount === undefined || amount === null) {
        return res.status(400).json({
          success: false,
          message: "Amount is required",
        });
      }

      if (isNaN(amount) || parseFloat(amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: "Amount must be a positive number",
        });
      }

      if (!salaryTypeId) {
        return res.status(400).json({
          success: false,
          message: "Salary type ID is required",
        });
      }

      // Check if staff salary exists
      const existingStaffSalary = await staffSalaryRepository.findById(staffSalaryId);
      if (!existingStaffSalary) {
        return res.status(404).json({
          success: false,
          message: "Staff salary record not found",
        });
      }

      // Get staff details to check salary
      const staff = await staffSalaryRepository.getStaffById(staffId);
      if (!staff) {
        return res.status(404).json({
          success: false,
          message: "Staff not found",
        });
      }

      // Check if amount is less than or equal to staff salary
      if (staff.salary && parseFloat(amount) > parseFloat(staff.salary)) {
        return res.status(400).json({
          success: false,
          message: `Amount cannot be greater than staff salary (${staff.salary})`,
        });
      }

      // Update staff salary
      const updatedStaffSalary = await staffSalaryRepository.update(staffSalaryId, {
        staffId,
        bankAccountId,
        effectiveDate,
        amount: parseFloat(amount),
        salaryTypeId,
        remarks
      });

      res.json({
        success: true,
        message: "Staff salary updated successfully",
        data: updatedStaffSalary,
      });
    } catch (error) {
      console.error("Update staff salary error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Delete staff salary
  async delete(req, res) {
    try {
      const { staffSalaryId } = req.params;

      // Check if staff salary exists
      const existingStaffSalary = await staffSalaryRepository.findById(staffSalaryId);
      if (!existingStaffSalary) {
        return res.status(404).json({
          success: false,
          message: "Staff salary record not found",
        });
      }

      // Delete staff salary
      await staffSalaryRepository.delete(staffSalaryId);

      res.json({
        success: true,
        message: "Staff salary deleted successfully",
      });
    } catch (error) {
      console.error("Delete staff salary error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new StaffSalaryController();
