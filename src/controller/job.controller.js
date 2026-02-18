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
}

module.exports = new JobController();
