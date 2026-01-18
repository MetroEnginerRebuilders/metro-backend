const express = require("express");
const router = express.Router();
const customerController = require("../controller/customer.controller");

// Customer routes
router.post("/customer", customerController.create);
router.get("/customer", customerController.list);
router.put("/customer/:customerId", customerController.update);
router.delete("/customer/:customerId", customerController.delete);

// Get customer types
router.get("/customer-types", customerController.getCustomerTypes);

module.exports = router;
