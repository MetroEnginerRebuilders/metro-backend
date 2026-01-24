const express = require("express");
const router = express.Router();
const companyController = require("../controller/company.controller");

// Company routes
router.post("/company", companyController.create);
router.get("/company", companyController.list);
router.put("/company/:companyId", companyController.update);
router.delete("/company/:companyId", companyController.delete);

module.exports = router;
