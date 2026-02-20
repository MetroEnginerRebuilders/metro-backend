const express = require("express");
const router = express.Router();
const invoiceController = require("../controller/invoice.controller");
const invoicePaymentController = require("../controller/invoice_payment.controller");

// Invoice routes
router.get("/invoice", invoiceController.list);
router.get("/invoice/:invoiceId", invoiceController.getById);
router.get("/invoice/:invoiceId/details", invoiceController.getDetailsByInvoiceId);
router.get("/invoice/:invoiceId/customer", invoiceController.getCustomerByInvoiceId);
router.get("/invoice/:invoiceId/job", invoiceController.getJobByInvoiceId);
router.get("/invoice/:invoiceId/download-pdf", invoiceController.downloadPDF);
router.get("/invoice/:invoiceId/payments", invoicePaymentController.listByInvoiceId);
router.post("/invoice/:invoiceId/items", invoiceController.addItems);
router.delete("/invoice/:invoiceId/items/:invoiceItemId", invoiceController.deleteItem);
router.post("/invoice/payment", invoicePaymentController.addPayment);

module.exports = router;
