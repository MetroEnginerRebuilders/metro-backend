const pool = require("../config/database");
const dailyTransactionRepository = require("./daily_transaction.repository");

class InvoicePaymentRepository {
  async findByInvoiceId(invoiceId) {
    const invoiceQuery = `
      SELECT invoice_id, total_amount
      FROM invoice
      WHERE invoice_id = $1
    `;
    const invoiceResult = await pool.query(invoiceQuery, [invoiceId]);

    if (!invoiceResult.rows[0]) {
      throw new Error("Invoice not found");
    }

    const totalAmount = Number(invoiceResult.rows[0].total_amount) || 0;

    // Get advance payment from job
    const advanceQuery = `
      SELECT
        j.advance_amount,
        j.bank_account_id,
        j.start_date,
        ba.account_name,
        ba.account_number
      FROM invoice i
      INNER JOIN job j ON i.job_id = j.job_id
      LEFT JOIN bank_account ba ON j.bank_account_id = ba.bank_account_id
      WHERE i.invoice_id = $1
        AND j.advance_amount > 0
    `;

    const paymentsQuery = `
      SELECT
        ip.invoice_payment_id,
        ip.invoice_id,
        ip.bank_account_id,
        ip.amount_paid,
        ip.remarks,
        ip.payment_date,
        ip.status,
        ip.created_at,
        ip.updated_at,
        ba.account_name,
        ba.account_number
      FROM invoice_payment ip
      LEFT JOIN bank_account ba ON ip.bank_account_id = ba.bank_account_id
      WHERE ip.invoice_id = $1
      ORDER BY ip.payment_date ASC, ip.created_at ASC
    `;

    const summaryQuery = `
      SELECT
        COUNT(*)::INT AS payment_count,
        COALESCE(SUM(amount_paid), 0) AS total_paid
      FROM invoice_payment
      WHERE invoice_id = $1
    `;

    const [advanceResult, paymentsResult, summaryResult] = await Promise.all([
      pool.query(advanceQuery, [invoiceId]),
      pool.query(paymentsQuery, [invoiceId]),
      pool.query(summaryQuery, [invoiceId]),
    ]);

    // Build payments array including advance if exists
    const allPayments = [];
    
    // Add advance payment first if exists
    if (advanceResult.rows.length > 0 && advanceResult.rows[0].advance_amount > 0) {
      const advance = advanceResult.rows[0];
      allPayments.push({
        invoice_payment_id: null,
        invoice_id: invoiceId,
        bank_account_id: advance.bank_account_id,
        amount_paid: advance.advance_amount,
        remarks: 'Advance',
        payment_date: advance.start_date,
        status: 'completed',
        created_at: advance.start_date,
        updated_at: advance.start_date,
        account_name: advance.account_name,
        account_number: advance.account_number,
      });
    }

    // Add regular payments
    allPayments.push(...paymentsResult.rows);

    // Calculate total including advance
    const advanceAmount = advanceResult.rows.length > 0 ? Number(advanceResult.rows[0].advance_amount) || 0 : 0;
    const totalPaid = Number(summaryResult.rows[0].total_paid) + advanceAmount;
    const balanceAmount = totalAmount - totalPaid;

    return {
      payments: allPayments,
      summary: {
        payment_count: allPayments.length,
        total_amount: totalAmount.toString(),
        total_paid: totalPaid.toString(),
        balance_amount: balanceAmount.toString(),
      },
    };
  }

  async addPayment(paymentData) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const invoiceQuery = `
        SELECT invoice_id, total_amount, job_id
        FROM invoice
        WHERE invoice_id = $1
      `;
      const invoiceResult = await client.query(invoiceQuery, [paymentData.invoice_id]);

      if (!invoiceResult.rows[0]) {
        throw new Error("Invoice not found");
      }

      const invoice = invoiceResult.rows[0];
      const amountPaid = Number(paymentData.amount_paid) || 0;
      const paymentStatus = paymentData.status === true;

      if (amountPaid <= 0) {
        throw new Error("amount_paid must be greater than 0");
      }

      // Validate bank account exists
      const bankAccountQuery = `
        SELECT bank_account_id, current_balance
        FROM bank_account
        WHERE bank_account_id = $1
      `;
      const bankAccountResult = await client.query(bankAccountQuery, [paymentData.bank_account_id]);

      if (!bankAccountResult.rows[0]) {
        throw new Error("Bank account not found");
      }

      const bankAccount = bankAccountResult.rows[0];

      // Insert payment record
      const paymentInsertQuery = `
        INSERT INTO invoice_payment (
          invoice_id,
          bank_account_id,
          amount_paid,
          remarks,
          payment_date,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const paymentResult = await client.query(paymentInsertQuery, [
        paymentData.invoice_id,
        paymentData.bank_account_id,
        amountPaid,
        paymentData.remarks || null,
        paymentData.payment_date,
        paymentStatus ? "true" : "false",
      ]);

      const payment = paymentResult.rows[0];

      const incomeTypeId = await dailyTransactionRepository.getFinanceTypeIdByCode("INCOME", client);

      await dailyTransactionRepository.create(
        {
          shop_id: null,
          finance_types_id: incomeTypeId,
          finance_categories_id: null,
          reference_type: "invoice_payment",
          reference_id: payment.invoice_payment_id,
          bank_account_id: payment.bank_account_id,
          amount: payment.amount_paid,
          transaction_date: payment.payment_date,
          description: payment.remarks || `Invoice payment - ${payment.invoice_id}`,
        },
        client
      );

      // Update bank account balance and last transaction
      const bankAccountUpdateQuery = `
        UPDATE bank_account
        SET 
          current_balance = current_balance + $1,
          last_transaction = $2,
          updated_at = NOW()
        WHERE bank_account_id = $3
        RETURNING *
      `;

      await client.query(bankAccountUpdateQuery, [
        amountPaid,
        paymentData.payment_date,
        paymentData.bank_account_id,
      ]);

      let updatedInvoice;

      if (paymentStatus) {
        const invoiceUpdateQuery = `
          UPDATE invoice
          SET 
            payment_status = 'paid',
            invoice_status = 'closed',
            updated_at = NOW()
          WHERE invoice_id = $1
          RETURNING *
        `;

        const updatedInvoiceResult = await client.query(invoiceUpdateQuery, [
          paymentData.invoice_id,
        ]);

        updatedInvoice = updatedInvoiceResult.rows[0];

        if (invoice.job_id) {
          const jobUpdateQuery = `
            UPDATE job
            SET 
              status = 'completed',
              updated_at = NOW()
            WHERE job_id = $1
            RETURNING *
          `;

          await client.query(jobUpdateQuery, [invoice.job_id]);
        }
      } else {
        const currentInvoiceQuery = `
          SELECT *
          FROM invoice
          WHERE invoice_id = $1
        `;
        const currentInvoiceResult = await client.query(currentInvoiceQuery, [
          paymentData.invoice_id,
        ]);
        updatedInvoice = currentInvoiceResult.rows[0];
      }

      await client.query("COMMIT");

      return {
        payment,
        invoice: updatedInvoice,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new InvoicePaymentRepository();
