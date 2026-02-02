const express = require("express");
const router = express.Router();
const financeTypesController = require("../controller/finance_types.controller");

// Finance types routes
router.get("/finance-types", financeTypesController.list);

module.exports = router;
