const express = require("express");
const router = express.Router();
const invoiceController = require("../controller/invoice.controller");

// Invoice routes
router.get("/invoice", invoiceController.list);
router.get("/invoice/:invoiceId", invoiceController.getById);
router.get("/invoice/:invoiceId/details", invoiceController.getDetailsByInvoiceId);
router.get("/invoice/:invoiceId/customer", invoiceController.getCustomerByInvoiceId);
router.get("/invoice/:invoiceId/job", invoiceController.getJobByInvoiceId);
router.post("/invoice/:invoiceId/items", invoiceController.addItems);

module.exports = router;
