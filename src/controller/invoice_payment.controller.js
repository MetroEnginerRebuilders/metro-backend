const invoicePaymentRepository = require("../repository/invoice_payment.repository");

class InvoicePaymentController {
  async addPayment(req, res) {
    try {
      const { amount_paid, bank_account_id, invoice_id, payment_date, remarks } = req.body;

      // Validation
      if (!invoice_id) {
        return res.status(400).json({ error: "invoice_id is required" });
      }

      if (!bank_account_id) {
        return res.status(400).json({ error: "bank_account_id is required" });
      }

      if (!amount_paid) {
        return res.status(400).json({ error: "amount_paid is required" });
      }

      if (!payment_date) {
        return res.status(400).json({ error: "payment_date is required" });
      }

      const amountNum = parseFloat(amount_paid);
      if (isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ error: "amount_paid must be a positive number" });
      }

      const paymentData = {
        invoice_id,
        bank_account_id,
        amount_paid: amountNum,
        payment_date,
        remarks: remarks || null,
      };

      const result = await invoicePaymentRepository.addPayment(paymentData);

      res.status(201).json({
        message: "Payment added successfully",
        data: {
          payment: result.payment,
          invoice: result.invoice,
        },
      });
    } catch (error) {
      console.error("Error adding payment:", error);

      if (error.message === "Invoice not found") {
        return res.status(404).json({ error: "Invoice not found" });
      }

      if (error.message === "amount_paid must be greater than 0") {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: "Internal server error" });
    }
  }
}

module.exports = new InvoicePaymentController();
