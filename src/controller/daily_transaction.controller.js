const dailyTransactionRepository = require("../repository/daily_transaction.repository");

class DailyTransactionController {
  async getTransactionsByDate(req, res) {
    try {
      const date = req.params?.date || req.body?.date || req.query?.date;

      if (!date) {
        return res.status(400).json({
          success: false,
          message: "date is required",
        });
      }

      const parsed = new Date(date);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date",
        });
      }

      const data = await dailyTransactionRepository.getTransactionsByDate(date);

      return res.json({
        success: true,
        message: "Daily transactions fetched successfully",
        data,
      });
    } catch (error) {
      console.error("Get daily transactions by date error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new DailyTransactionController();
