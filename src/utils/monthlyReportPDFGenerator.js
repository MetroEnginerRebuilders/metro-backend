const PDFDocument = require("pdfkit");

class MonthlyReportPDFGenerator {
  generateMonthlyReportPDF(reportData, stream) {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4', landscape: true });

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

      // Header
      doc.fontSize(18).font("Helvetica-Bold").text("METRO Engine Rebuilders", { align: "center" });
      doc.fontSize(11).font("Helvetica").text("Monthly Financial Report", { align: "center" });
      doc.fontSize(10).text(`${reportData.month} ${reportData.year}`, { align: "center" });
      doc.moveDown(0.8);

      // Table headers
      const headers = [
        "Date", "Food", "Spare", "Stationary", "Petrol", "Field", "Parcel",
        "Salary", "Material", "Auto", "Commission", "Mobile", "Other", "Total", "Income"
      ];

      const colWidth = (doc.page.width - 80) / headers.length;
      const startX = 40;
      const startY = doc.y;
      const rowHeight = 20;
      const headerHeight = 25;

      // Draw header row
      doc.fontSize(8).font("Helvetica-Bold");
      let x = startX;
      
      headers.forEach((header, idx) => {
        doc.rect(x, startY, colWidth, headerHeight).stroke();
        doc.text(header, x + 2, startY + 5, {
          width: colWidth - 4,
          align: "center",
          fontSize: 7,
        });
        x += colWidth;
      });

      // Expense category mapping
      const expenseMap = {
        "Food": "food",
        "Spare": "spare",
        "Stationary": "stationary",
        "Petrol": "petrol",
        "Field": "field",
        "Parcel": "parcel",
        "Material": "material",
        "Auto": "auto",
        "Commission": "commission",
        "Mobile": "mobile",
        "Other": "other",
      };

      // Draw data rows
      let y = startY + headerHeight;
      doc.fontSize(8).font("Helvetica");

      reportData.daily_reports.forEach((day, idx) => {
        // Check if we need a new page
        if (y + rowHeight > doc.page.height - 40) {
          doc.addPage({ margin: 40, landscape: true });
          y = 40;
          
          // Redraw headers on new page
          doc.fontSize(8).font("Helvetica-Bold");
          x = startX;
          headers.forEach((header) => {
            doc.rect(x, y, colWidth, headerHeight).stroke();
            doc.text(header, x + 2, y + 5, {
              width: colWidth - 4,
              align: "center",
              fontSize: 7,
            });
            x += colWidth;
          });
          y += headerHeight;
          doc.fontSize(8).font("Helvetica");
        }

        // Build expense map for this day
        const dayExpenseMap = {};
        day.expenses.forEach(exp => {
          dayExpenseMap[exp.expense_type] = Number(exp.amount);
        });

        // Draw row
        x = startX;
        const rowY = y;

        // Date
        doc.rect(x, rowY, colWidth, rowHeight).stroke();
        doc.text(day.day.toString(), x + 2, rowY + 5, { width: colWidth - 4, align: "center" });
        x += colWidth;

        // Expense categories
        Object.keys(expenseMap).forEach(category => {
          doc.rect(x, rowY, colWidth, rowHeight).stroke();
          const amount = dayExpenseMap[category];
          const displayValue = amount ? this.formatCurrency(amount) : "-";
          doc.text(displayValue, x + 2, rowY + 5, { width: colWidth - 4, align: "center" });
          x += colWidth;
        });

        // Salary
        doc.rect(x, rowY, colWidth, rowHeight).stroke();
        const salaryValue = day.salary ? this.formatCurrency(day.salary) : "-";
        doc.text(salaryValue, x + 2, rowY + 5, { width: colWidth - 4, align: "center" });
        x += colWidth;

        // Total expenses
        doc.rect(x, rowY, colWidth, rowHeight).stroke();
        const totalExpenses = day.total_expenses + (day.salary || 0);
        const totalValue = totalExpenses > 0 ? this.formatCurrency(totalExpenses) : "-";
        doc.text(totalValue, x + 2, rowY + 5, { width: colWidth - 4, align: "center" });
        x += colWidth;

        // Income
        doc.rect(x, rowY, colWidth, rowHeight).stroke();
        const incomeValue = day.total_income > 0 ? this.formatCurrency(day.total_income) : "-";
        doc.text(incomeValue, x + 2, rowY + 5, { width: colWidth - 4, align: "center" });

        y += rowHeight;
      });

      doc.end();
    } catch (error) {
      console.error("Error generating monthly report PDF:", error);
      throw error;
    }
  }

  formatCurrency(amount) {
    if (!amount || amount === 0) return "0";
    const num = Number(amount);
    if (Number.isInteger(num)) {
      return num.toString();
    }
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }
}

module.exports = new MonthlyReportPDFGenerator();
