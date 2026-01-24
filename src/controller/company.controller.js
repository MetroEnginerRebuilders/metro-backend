const companyRepository = require("../repository/company.repository");

class CompanyController {
  // Create new company
  async create(req, res) {
    try {
      const { companyName, executiveName, executivePhoneNumber } = req.body;

      // Validate input
      if (!companyName || companyName.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Company name is required",
        });
      }

      // Check if company name already exists
      const existingCompany = await companyRepository.findByName(companyName.trim());
      if (existingCompany) {
        return res.status(409).json({
          success: false,
          message: "Company name already exists",
        });
      }

      // Create company
      const company = await companyRepository.create({
        companyName: companyName.trim(),
        executiveName: executiveName ? executiveName.trim() : null,
        executivePhoneNumber: executivePhoneNumber ? executivePhoneNumber.trim() : null
      });

      res.status(201).json({
        success: true,
        message: "Company created successfully",
        data: company,
      });
    } catch (error) {
      console.error("Create company error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }

  // Get all companies with pagination and search
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
      
      const result = await companyRepository.findAll(search, pageNum, limit);
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
      console.error("List companies error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Update company
  async update(req, res) {
    try {
      const { companyId } = req.params;
      const { companyName, executiveName, executivePhoneNumber } = req.body;

      // Validate input
      if (!companyName || companyName.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Company name is required",
        });
      }

      // Check if company exists
      const existingCompany = await companyRepository.findById(companyId);
      if (!existingCompany) {
        return res.status(404).json({
          success: false,
          message: "Company not found",
        });
      }

      // Check if new company name already exists (excluding current company)
      const duplicateCompany = await companyRepository.findByName(companyName.trim());
      if (duplicateCompany && duplicateCompany.company_id !== companyId) {
        return res.status(409).json({
          success: false,
          message: "Company name already exists",
        });
      }

      // Update company
      const updatedCompany = await companyRepository.update(companyId, {
        companyName: companyName.trim(),
        executiveName: executiveName ? executiveName.trim() : null,
        executivePhoneNumber: executivePhoneNumber ? executivePhoneNumber.trim() : null
      });

      res.json({
        success: true,
        message: "Company updated successfully",
        data: updatedCompany,
      });
    } catch (error) {
      console.error("Update company error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Delete company
  async delete(req, res) {
    try {
      const { companyId } = req.params;

      // Check if company exists
      const existingCompany = await companyRepository.findById(companyId);
      if (!existingCompany) {
        return res.status(404).json({
          success: false,
          message: "Company not found",
        });
      }

      // Delete company
      await companyRepository.delete(companyId);

      res.json({
        success: true,
        message: "Company deleted successfully",
      });
    } catch (error) {
      console.error("Delete company error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new CompanyController();
