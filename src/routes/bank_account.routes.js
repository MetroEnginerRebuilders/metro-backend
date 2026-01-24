const express = require("express");
const router = express.Router();
const bankAccountController = require("../controller/bank_account.controller");

// Bank account routes
router.post("/bank-account", bankAccountController.create);
router.get("/bank-account", bankAccountController.list);
router.put("/bank-account/:bankAccountId", bankAccountController.update);
router.delete("/bank-account/:bankAccountId", bankAccountController.delete);

// Account transfer route
router.post("/bank-account/transfer", bankAccountController.transfer);

module.exports = router;
