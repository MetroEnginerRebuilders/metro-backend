const customerRepository = require("../repository/customer.repository");

class CustomerController {
  // Create new customer
  async create(req, res) {
    try {
      const { 
        customerName, 
        customerAddress1, 
        customerAddress2, 
        customerPhoneNumber, 
        customerTypeId 
      } = req.body;

      // Validate input
      if (!customerName || customerName.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Customer name is required",
        });
      }

      if (!customerTypeId) {
        return res.status(400).json({
          success: false,
          message: "Customer type is required",
        });
      }

      // Create customer
      const customer = await customerRepository.create({
        customerName: customerName.trim(),
        customerAddress1: customerAddress1?.trim() || "",
        customerAddress2: customerAddress2?.trim() || "",
        customerPhoneNumber: customerPhoneNumber?.trim() || "",
        customerTypeId
      });

      res.status(201).json({
        success: true,
        message: "Customer created successfully",
        data: customer,
      });
    } catch (error) {
      console.error("Create customer error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }

  // Get all customers with pagination and search
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
      
      const result = await customerRepository.findAll(search, pageNum, limit);
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
      console.error("List customers error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Update customer
  async update(req, res) {
    try {
      const { customerId } = req.params;
      const { 
        customerName, 
        customerAddress1, 
        customerAddress2, 
        customerPhoneNumber, 
        customerTypeId 
      } = req.body;

      // Validate input
      if (!customerName || customerName.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Customer name is required",
        });
      }

      if (!customerTypeId) {
        return res.status(400).json({
          success: false,
          message: "Customer type is required",
        });
      }

      // Check if customer exists
      const existingCustomer = await customerRepository.findById(customerId);
      if (!existingCustomer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }

      // Update customer
      const updatedCustomer = await customerRepository.update(customerId, {
        customerName: customerName.trim(),
        customerAddress1: customerAddress1?.trim() || "",
        customerAddress2: customerAddress2?.trim() || "",
        customerPhoneNumber: customerPhoneNumber?.trim() || "",
        customerTypeId
      });

      res.json({
        success: true,
        message: "Customer updated successfully",
        data: updatedCustomer,
      });
    } catch (error) {
      console.error("Update customer error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Delete customer
  async delete(req, res) {
    try {
      const { customerId } = req.params;

      // Check if customer exists
      const existingCustomer = await customerRepository.findById(customerId);
      if (!existingCustomer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }

      // Delete customer
      await customerRepository.delete(customerId);

      res.json({
        success: true,
        message: "Customer deleted successfully",
      });
    } catch (error) {
      console.error("Delete customer error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get all customer types
  async getCustomerTypes(req, res) {
    try {
      const customerTypes = await customerRepository.getCustomerTypes();

      res.json({
        success: true,
        data: customerTypes,
      });
    } catch (error) {
      console.error("Get customer types error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new CustomerController();
