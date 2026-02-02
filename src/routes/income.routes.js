const express = require("express");
const router = express.Router();
const incomeController = require("../controller/income.controller");
const { verifyToken } = require("../middleware/auth.middleware");

// Income routes (all protected with authentication)
router.get("/income", verifyToken, incomeController.listIncome);
router.get("/income/date-range", verifyToken, incomeController.getIncomeByDateRange);
router.get("/income/:id", verifyToken, incomeController.getIncomeById);
router.post("/income", verifyToken, incomeController.createIncome);
router.put("/income/:id", verifyToken, incomeController.updateIncome);
router.delete("/income/:id", verifyToken, incomeController.deleteIncome);

module.exports = router;
