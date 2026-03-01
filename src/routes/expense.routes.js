const express = require("express");
const router = express.Router();
const expenseController = require("../controller/expense.controller");
const { verifyToken } = require("../middleware/auth.middleware");

// Expense routes (all protected with authentication)
router.get("/expense", verifyToken, expenseController.listExpense);
router.get("/expense/date-range", verifyToken, expenseController.getExpenseByDateRange);
router.post("/expense/date-range", verifyToken, expenseController.getExpenseByDateRange);
router.get("/expense/:id", verifyToken, expenseController.getExpenseById);
router.post("/expense", verifyToken, expenseController.createExpense);
router.put("/expense/:id", verifyToken, expenseController.updateExpense);
router.delete("/expense/:id", verifyToken, expenseController.deleteExpense);

module.exports = router;
