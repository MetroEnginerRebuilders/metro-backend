const express = require("express");
const router = express.Router();
const salaryTypeController = require("../controller/salary_type.controller");

// Salary type routes
router.get("/salary-types", salaryTypeController.list);

module.exports = router;
