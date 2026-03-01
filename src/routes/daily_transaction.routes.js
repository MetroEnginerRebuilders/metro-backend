const express = require("express");
const router = express.Router();
const dailyTransactionController = require("../controller/daily_transaction.controller");
const { verifyToken } = require("../middleware/auth.middleware");

router.get(
  "/daily-transaction/:date",
  verifyToken,
  dailyTransactionController.getTransactionsByDate
);

module.exports = router;
