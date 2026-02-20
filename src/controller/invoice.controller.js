const invoiceRepository = require("../repository/invoice.repository");
const invoiceItemRepository = require("../repository/invoice_item.repository");
const pdfGenerator = require("../utils/pdfGenerator");
const pool = require("../config/database");

class InvoiceController {
  async getCustomerByInvoiceId(req, res) {
    try {
      const { invoiceId } = req.params;

      const customer = await invoiceRepository.findCustomerByInvoiceId(invoiceId);

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found for this invoice",
        });
      }

      res.json({
        success: true,
        data: customer,
      });
    } catch (error) {
      console.error("Get customer by invoice error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async getJobByInvoiceId(req, res) {
    try {
      const { invoiceId } = req.params;

      const job = await invoiceRepository.findJobByInvoiceId(invoiceId);

      if (!job) {
        return res.status(404).json({
          success: false,
          message: "Job not found for this invoice",
        });
      }

      res.json({
        success: true,
        data: job,
      });
    } catch (error) {
      console.error("Get job by invoice error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async getById(req, res) {
    try {
      const { invoiceId } = req.params;

      const invoice = await invoiceRepository.findById(invoiceId);

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: "Invoice not found",
        });
      }

      res.json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      console.error("Get invoice by id error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async getDetailsByInvoiceId(req, res) {
    try {
      const { invoiceId } = req.params;

      const details = await invoiceRepository.findDetailsByInvoiceId(invoiceId);

      if (!details) {
        return res.status(404).json({
          success: false,
          message: "Invoice details not found",
        });
      }

      const items = await invoiceRepository.findItemsByInvoiceId(invoiceId);

      res.json({
        success: true,
        data: {
          invoice: {
            invoice_id: details.invoice_id,
            invoice_number: details.invoice_number,
            job_id: details.invoice_job_id,
            customer_id: details.invoice_customer_id,
            invoice_date: details.invoice_date,
            total_amount: details.invoice_total_amount,
            invoice_status: details.invoice_status,
            payment_status: details.invoice_payment_status,
            created_at: details.invoice_created_at,
            updated_at: details.invoice_updated_at,
          },
          job: {
            job_id: details.job_id,
            job_number: details.job_number,
            customer_id: details.job_customer_id,
            description: details.job_description,
            advance_amount: details.job_advance_amount,
            bank_account_id: details.job_bank_account_id,
            received_items: details.job_received_items,
            start_date: details.job_start_date,
            status: details.job_status,
            created_at: details.job_created_at,
            updated_at: details.job_updated_at,
          },
          customer: {
            customer_id: details.customer_id,
            customer_number: details.customer_number,
            customer_name: details.customer_name,
            customer_address1: details.customer_address1,
            customer_address2: details.customer_address2,
            customer_phone_number: details.customer_phone_number,
            customer_type_id: details.customer_type_id,
            created_at: details.customer_created_at,
            updated_at: details.customer_updated_at,
          },
          items: items.map(item => ({
            invoice_item_id: item.invoice_item_id,
            invoice_id: item.invoice_id,
            item_type_id: item.item_type_id,
            item_type_name: item.item_type_name,
            item_type_code: item.item_type_code,
            work_id: item.work_id,
            spare_id: item.spare_id,
            spare_name: item.item_type_code === 'SPARE' ? item.spare_name : null,
            remarks: item.remarks,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            company_id: item.company_id,
            company_name: item.item_type_code === 'SPARE' ? item.company_name : null,
            model_id: item.model_id,
            model_name: item.item_type_code === 'SPARE' ? item.model_name : null,
            created_at: item.created_at,
            updated_at: item.updated_at,
          })),
        },
      });
    } catch (error) {
      console.error("Get invoice details error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async list(req, res) {
    try {
      const { search, page = 1 } = req.query;
      const limit = 10;
      const pageNum = parseInt(page);

      if (pageNum < 1) {
        return res.status(400).json({
          success: false,
          message: "Page number must be greater than 0",
        });
      }

      const result = await invoiceRepository.findAll(search, pageNum, limit);
      const totalPages = Math.ceil(result.total / limit);

      res.json({
        success: true,
        data: result.data,
        pagination: {
          currentPage: pageNum,
          totalPages: totalPages,
          totalItems: result.total,
          itemsPerPage: limit,
          hasNextPage: pageNum < totalPages,
          hasPreviousPage: pageNum > 1,
        },
      });
    } catch (error) {
      console.error("List invoices error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async addItems(req, res) {
    try {
      const { invoiceId } = req.params;
      const {
        items,
        shopId,
        shop_id,
        bankAccountId,
        bank_account_id,
        orderDate,
        order_date,
        description,
      } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Items array is required and must not be empty",
        });
      }

      for (const item of items) {
        if (!item.item_type_id || item.quantity === undefined || item.unit_price === undefined) {
          return res.status(400).json({
            success: false,
            message: "Each item must have item_type_id, quantity, and unit_price",
          });
        }
      }

      const result = await invoiceItemRepository.addItems(invoiceId, items, {
        shopId: shopId || shop_id,
        bankAccountId: bankAccountId || bank_account_id,
        orderDate: orderDate || order_date,
        description,
      });

      res.status(201).json({
        success: true,
        message: "Invoice items added successfully",
        data: result,
      });
    } catch (error) {
      console.error("Add invoice items error:", error);
      const message = error?.message || "Internal server error";
      const status = message === "Internal server error" ? 500 : 400;
      res.status(status).json({
        success: false,
        message,
      });
    }
  }

  async deleteItem(req, res) {
    try {
      const { invoiceId, invoiceItemId } = req.params;

      const result = await invoiceItemRepository.deleteItem(invoiceId, invoiceItemId);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: "Invoice item not found",
        });
      }

      res.json({
        success: true,
        message: "Invoice item deleted successfully",
        data: result,
      });
    } catch (error) {
      console.error("Delete invoice item error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async downloadPDF(req, res) {
    try {
      const { invoiceId } = req.params;

      const details = await invoiceRepository.findDetailsByInvoiceId(invoiceId);

      if (!details) {
        return res.status(404).json({
          success: false,
          message: "Invoice details not found",
        });
      }

      const items = await invoiceRepository.findItemsByInvoiceId(invoiceId);

      // Fetch company details
      const companyQuery = `
        SELECT company_name, executive_name, executive_phone_number
        FROM company
        LIMIT 1
      `;
      const companyResult = await pool.query(companyQuery);
      const company = companyResult.rows[0];

      const invoiceData = {
        invoice: {
          invoice_id: details.invoice_id,
          invoice_number: details.invoice_number,
          invoice_date: details.invoice_date,
          total_amount: details.invoice_total_amount,
          invoice_status: details.invoice_status,
          payment_status: details.invoice_payment_status,
        },
        job: {
          job_number: details.job_number,
          description: details.job_description,
        },
        customer: {
          customer_name: details.customer_name,
          customer_address1: details.customer_address1,
          customer_address2: details.customer_address2,
          customer_phone_number: details.customer_phone_number,
        },
        items,
        company,
      };

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Invoice_${details.invoice_number}.pdf"`
      );

      pdfGenerator.generateInvoicePDF(invoiceData, res);
    } catch (error) {
      console.error("Download PDF error:", error);
      
      // If headers already sent, just end the response
      if (res.headersSent) {
        res.end();
        return;
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
}

module.exports = new InvoiceController();
