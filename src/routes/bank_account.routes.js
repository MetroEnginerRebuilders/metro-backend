const express = require("express");
const router = express.Router();
const bankAccountController = require("../controller/bank_account.controller");

// Bank account routes
router.post("/bank-account", bankAccountController.create);
router.get("/bank-account", bankAccountController.list);
router.get("/bank-account/active", bankAccountController.listActive);
router.get("/bank-account/transactions", bankAccountController.listTransactions);
router.post("/bank-account/transactions", bankAccountController.listTransactions);
router.put("/bank-account/:bankAccountId", bankAccountController.update);
router.delete("/bank-account/:bankAccountId", bankAccountController.delete);

// Account transfer route
router.post("/bank-account/transfer", bankAccountController.transfer);

module.exports = router;
