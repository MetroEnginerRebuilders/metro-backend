const jobRepository = require("../repository/job.repository");

class JobController {
  async create(req, res) {
    try {
      const {
        customerId,
        description,
        advanceAmount,
        bankAccountId,
        bankaccountId,
        startDate,
        received_items,
        receivedItems,
      } = req.body;

      if (!customerId || !startDate) {
        return res.status(400).json({
          success: false,
          message: "customerId and startDate are required",
        });
      }

      const advanceAmountNumber =
        advanceAmount === undefined || advanceAmount === null
          ? 0
          : Number(advanceAmount);

      if (Number.isNaN(advanceAmountNumber) || advanceAmountNumber < 0) {
        return res.status(400).json({
          success: false,
          message: "advanceAmount must be a non-negative number",
        });
      }

      const result = await jobRepository.createWithInvoice({
        customer_id: customerId,
        description,
        advance_amount: advanceAmountNumber,
        bank_account_id: bankAccountId || bankaccountId || null,
        start_date: startDate,
        received_items: received_items || receivedItems || null,
      });

      res.status(201).json({
        success: true,
        message: "Job and invoice created successfully",
        data: result,
      });
    } catch (error) {
      console.error("Create job error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

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

      const result = await jobRepository.findAll(search, pageNum, limit);
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
          hasPreviousPage: pageNum > 1,
        },
      });
    } catch (error) {
      console.error("List jobs error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async getById(req, res) {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        return res.status(400).json({
          success: false,
          message: "jobId is required",
        });
      }

      const result = await jobRepository.findById(jobId);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: "Job not found",
        });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Get job by id error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async edit(req, res) {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        return res.status(400).json({
          success: false,
          message: "jobId is required",
        });
      }

      const {
        customerId,
        description,
        advanceAmount,
        bankAccountId,
        bankaccountId,
        startDate,
        received_items,
        receivedItems,
      } = req.body;

      const advanceAmountNumber =
        advanceAmount === undefined || advanceAmount === null
          ? null
          : Number(advanceAmount);

      if (advanceAmountNumber !== null && (Number.isNaN(advanceAmountNumber) || advanceAmountNumber < 0)) {
        return res.status(400).json({
          success: false,
          message: "advanceAmount must be a non-negative number",
        });
      }

      const result = await jobRepository.updateById(jobId, {
        customer_id: customerId || null,
        description,
        advance_amount: advanceAmountNumber,
        bank_account_id: bankAccountId || bankaccountId || null,
        start_date: startDate,
        received_items: received_items || receivedItems || null,
      });

      if (!result) {
        return res.status(404).json({
          success: false,
          message: "Job not found",
        });
      }

      res.json({
        success: true,
        message: "Job updated successfully",
        data: result,
      });
    } catch (error) {
      console.error("Edit job error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async delete(req, res) {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        return res.status(400).json({
          success: false,
          message: "jobId is required",
        });
      }

      const result = await jobRepository.deleteById(jobId);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: "Job not found",
        });
      }

      res.json({
        success: true,
        message: "Job deleted successfully",
        data: result,
      });
    } catch (error) {
      console.error("Delete job error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new JobController();
