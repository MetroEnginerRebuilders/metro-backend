const express = require("express");
const router = express.Router();
const financeCategoriesController = require("../controller/finance_categories.controller");

// Finance categories routes
router.get("/finance-categories/income", financeCategoriesController.listIncome);
router.get("/finance-categories/expense", financeCategoriesController.listExpense);
router.get("/finance-categories", financeCategoriesController.list);
router.get("/finance-categories/all", financeCategoriesController.listAll);

module.exports = router;
