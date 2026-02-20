const PDFDocument = require("pdfkit");

class PDFGenerator {
  generateInvoicePDF(invoiceData, stream) {
    try {
      const doc = new PDFDocument({ margin: 50 });
      
      // Handle stream errors
      doc.on("error", (err) => {
        console.error("PDF generation error:", err);
        if (!stream.headersSent) {
          stream.status(500).json({ error: "PDF generation failed" });
        }
      });

      stream.on("error", (err) => {
        console.error("Stream error:", err);
      });

      doc.pipe(stream);

      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke();

      const { invoice, job, customer, items, company } = invoiceData;

    // Company Header
    doc.fontSize(16).font("Helvetica-Bold").text( "METRO Engine Rebuilders", {
      align: "center",
    });
    doc.fontSize(10).font("Helvetica").text( "Muttar Kadave Road, Kunnumpuram Junction, North Edappally", {
      align: "center",
    });
    doc.fontSize(10).font("Helvetica").text( "Mobile : 9446118899", {
      align: "center",
    });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    // Invoice Title and Details
    doc.fontSize(14).font("Helvetica-Bold").text("INVOICE", { align: "center" });
    doc.moveDown(0.5);

    const detailsTop = doc.y;
    const invoiceX = 50;
    const invoiceWidth = 220;
    const billX = 290;
    const billWidth = 255;
    const billPadding = 10;

    // Invoice Information (left side)
    doc.fontSize(11).font("Helvetica-Bold").text("Invoice Details", invoiceX, detailsTop);
    let invoiceY = doc.y + 6;
    doc.fontSize(10).font("Helvetica");
    doc.text(`Invoice Number: ${invoice?.invoice_number || "N/A"}`, invoiceX, invoiceY, { width: invoiceWidth });
    invoiceY = doc.y + 2;
    doc.text(`Invoice Date: ${this.formatDate(invoice?.invoice_date)}`, invoiceX, invoiceY, { width: invoiceWidth });
    invoiceY = doc.y + 2;
    doc.text(`Job Number: ${job?.job_number || "N/A"}`, invoiceX, invoiceY, { width: invoiceWidth });
    invoiceY = doc.y + 2;
    doc.text(`Amount Paid: ${this.formatCurrency(invoice?.amount_paid || 0)}`, invoiceX, invoiceY, { width: invoiceWidth });
    invoiceY = doc.y + 2;
    doc.text(`Balance Amount: ${this.formatCurrency(invoice?.balance_amount || 0)}`, invoiceX, invoiceY, { width: invoiceWidth });
    const invoiceBottom = doc.y;

    // Bill To Information (right side)
    const billContentX = billX + billPadding;
    const billContentWidth = billWidth - billPadding * 2;
    doc.fontSize(11).font("Helvetica-Bold").text("Bill To", billContentX, detailsTop, {
      width: billContentWidth,
    });
    let billY = doc.y + 6;
    doc.fontSize(10).font("Helvetica");
    doc.text(`Name: ${customer?.customer_name || "N/A"}`, billContentX, billY, { width: billContentWidth });
    billY = doc.y + 2;
    doc.text(
      `Address: ${customer?.customer_address1 || ""}${customer?.customer_address2 ? ", " + customer.customer_address2 : ""}`,
      billContentX,
      billY,
      { width: billContentWidth }
    );
    billY = doc.y + 2;
    doc.text(`Phone: ${customer?.customer_phone_number || "N/A"}`, billContentX, billY, { width: billContentWidth });

    const billHeight = Math.max(80, doc.y - detailsTop + billPadding);

    doc.y = Math.max(invoiceBottom, detailsTop + billHeight) + 12;

    // Job Description and Received Items (side by side)
    if (job?.description || job?.received_items) {
      const sectionTop = doc.y;
      const leftX = 50;
      const leftWidth = 240;
      const rightX = 305;
      const rightWidth = 240;

      let leftY = sectionTop;
      let rightY = sectionTop;

      // Job Description (left side)
      if (job?.description) {
        doc.fontSize(11).font("Helvetica-Bold").text("Job Description", leftX, leftY, { width: leftWidth });
        leftY = doc.y + 4;
        doc.fontSize(10).font("Helvetica").text(job.description, leftX, leftY, { width: leftWidth });
        leftY = doc.y;
      }

      // Received Items (right side)
      if (job?.received_items) {
        doc.fontSize(11).font("Helvetica-Bold").text("Received Items", rightX, sectionTop, { width: rightWidth });
        rightY = doc.y + 4;
        doc.fontSize(10).font("Helvetica").text(job.received_items, rightX, rightY, { width: rightWidth });
        rightY = doc.y;
      }

      // Move doc.y to the bottom of the tallest section
      doc.y = Math.max(leftY, rightY) + 8;
    }

    // Items Table Header
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);

    const tableTop = doc.y;
    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("Description", 50, tableTop);
    doc.text("Qty", 250, tableTop);
    doc.text("Unit Price", 300, tableTop);
    doc.text("Total", 420, tableTop);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);

    // Items
    doc.font("Helvetica").fontSize(9);
    items?.forEach((item) => {
      const description = item.item_type_code === "SPARE" 
        ? `${item.spare_name || item.item_type_name}` 
        : item.item_type_name || "N/A";
      
      const qty = item.quantity || 0;
      const unitPrice = this.formatCurrency(item.unit_price || 0);
      const total = this.formatCurrency(item.total_price || 0);

      doc.text(description, 50, doc.y, { width: 180 });
      doc.text(qty.toString(), 250, doc.y - (doc.heightOfString(description, { width: 180 })));
      doc.text(unitPrice, 300, doc.y - (doc.heightOfString(description, { width: 180 })));
      doc.text(total, 420, doc.y - (doc.heightOfString(description, { width: 180 })));

      doc.moveDown(0.5);
    });

    // Total
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);
    doc.fontSize(11).font("Helvetica-Bold");
    doc.text(`Total Amount: ${this.formatCurrency(invoice?.total_amount || 0)}`, 350, doc.y, {
      align: "right",
      width: 145,
    });
    doc.moveDown(1);


    doc.end();
    } catch (error) {
      console.error("Error generating PDF:", error);
      throw error;
    }
  }

  formatDate(date) {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }
}

module.exports = new PDFGenerator();
