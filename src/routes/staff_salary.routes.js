const express = require("express");
const router = express.Router();
const staffSalaryController = require("../controller/staff_salary.controller");

// Staff salary routes
router.post("/staff-salary", staffSalaryController.create);
router.get("/staff-salary", staffSalaryController.list);
router.get("/staff-salary/:staffId/month-summary", staffSalaryController.getMonthlySummary);
router.put("/staff-salary/:staffSalaryId", staffSalaryController.update);
router.delete("/staff-salary/:staffSalaryId", staffSalaryController.delete);

module.exports = router;
