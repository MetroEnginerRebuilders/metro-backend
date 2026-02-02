const express = require("express");
const router = express.Router();
const financeController = require("../controller/finance.controller");
const { verifyToken } = require("../middleware/auth.middleware");

// Finance routes (all protected with authentication)
router.get("/finance", verifyToken, financeController.list);
router.get("/finance/date-range", verifyToken, financeController.getByDateRange);
router.get("/finance/bank-account/:bankAccountId", verifyToken, financeController.getByBankAccount);
router.get("/finance/:id", verifyToken, financeController.getById);
router.post("/finance", verifyToken, financeController.create);
router.put("/finance/:id", verifyToken, financeController.update);
router.delete("/finance/:id", verifyToken, financeController.delete);

module.exports = router;
