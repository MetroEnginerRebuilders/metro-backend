const pool = require("../config/database");
const dailyTransactionRepository = require("./daily_transaction.repository");

class InvoicePaymentRepository {
  async getLatheWorkIncomeMeta(client) {
    const result = await client.query(
      `
      SELECT ft.finance_type_id, fc.finance_category_id
      FROM finance_types ft
      INNER JOIN finance_categories fc ON fc.finance_type_id = ft.finance_type_id
      WHERE ft.finance_type_code = 'INCOME'
        AND LOWER(fc.finance_category_name) = LOWER('Lathe Work')
      LIMIT 1
      `
    );

    if (!result.rows[0]) {
      throw new Error("Lathe Work income category not found");
    }

    return result.rows[0];
  }

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
        SELECT invoice_id, invoice_number, total_amount, job_id
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

      const incomeMeta = await this.getLatheWorkIncomeMeta(client);

      const financeInsertResult = await client.query(
        `
        INSERT INTO finance (
          bank_account_id,
          finance_category_id,
          finance_type_id,
          amount,
          transaction_date,
          description,
          remarks
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          payment.bank_account_id,
          incomeMeta.finance_category_id,
          incomeMeta.finance_type_id,
          payment.amount_paid,
          payment.payment_date,
          `Payment of Invoice ${invoice.invoice_number}`,
          `INVOICE_PAYMENT:${payment.invoice_payment_id}`,
        ]
      );

      const createdFinance = financeInsertResult.rows[0];

      await dailyTransactionRepository.create(
        {
          finance_types_id: createdFinance.finance_type_id,
          finance_categories_id: createdFinance.finance_category_id,
          reference_type: "finance",
          reference_id: createdFinance.finance_id,
          bank_account_id: createdFinance.bank_account_id,
          amount: createdFinance.amount,
          transaction_date: createdFinance.transaction_date,
          description: createdFinance.description || createdFinance.remarks,
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

  async deletePaymentById(invoicePaymentId) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const paymentQuery = `
        SELECT
          ip.invoice_payment_id,
          ip.invoice_id,
          ip.bank_account_id,
          ip.amount_paid,
          ip.payment_date,
          ip.remarks,
          i.invoice_number,
          i.total_amount,
          i.job_id,
          COALESCE(j.advance_amount, 0) AS advance_amount
        FROM invoice_payment ip
        INNER JOIN invoice i ON ip.invoice_id = i.invoice_id
        LEFT JOIN job j ON i.job_id = j.job_id
        WHERE ip.invoice_payment_id = $1
        FOR UPDATE OF ip, i
      `;

      const paymentResult = await client.query(paymentQuery, [invoicePaymentId]);
      const payment = paymentResult.rows[0];

      if (!payment) {
        await client.query("ROLLBACK");
        return null;
      }

      const amountPaid = Number(payment.amount_paid) || 0;

      if (payment.bank_account_id && amountPaid > 0) {
        await client.query(
          `
          UPDATE bank_account
          SET
            current_balance = current_balance - $1,
            last_transaction = $2,
            updated_at = NOW()
          WHERE bank_account_id = $3
          `,
          [amountPaid, payment.payment_date, payment.bank_account_id]
        );
      }

      const newRemarkRef = `INVOICE_PAYMENT:${payment.invoice_payment_id}`;
      const oldRemarkRef = `INVOICE_PAYMENT:${payment.invoice_number}`;

      const linkedFinanceResult = await client.query(
        `
        SELECT finance_id
        FROM finance
        WHERE remarks = $1
        `,
        [newRemarkRef]
      );

      let financeRows = linkedFinanceResult.rows;

      if (financeRows.length === 0) {
        const legacyFinanceResult = await client.query(
          `
          SELECT finance_id
          FROM finance
          WHERE remarks = $1
            AND bank_account_id = $2
            AND amount = $3
            AND transaction_date = $4
          ORDER BY created_at ASC
          LIMIT 1
          `,
          [oldRemarkRef, payment.bank_account_id, amountPaid, payment.payment_date]
        );
        financeRows = legacyFinanceResult.rows;
      }

      for (const financeRow of financeRows) {
        await dailyTransactionRepository.deleteByReference("finance", financeRow.finance_id, client);
        await client.query("DELETE FROM finance WHERE finance_id = $1", [financeRow.finance_id]);
      }

      await client.query(
        `
        DELETE FROM invoice_payment
        WHERE invoice_payment_id = $1
        `,
        [invoicePaymentId]
      );

      const settlementResult = await client.query(
        `
        SELECT COALESCE(SUM(amount_paid), 0) AS total_paid
        FROM invoice_payment
        WHERE invoice_id = $1
        `,
        [payment.invoice_id]
      );

      const totalPaidWithoutAdvance = Number(settlementResult.rows[0]?.total_paid) || 0;
      const advanceAmount = Number(payment.advance_amount) || 0;
      const totalSettled = totalPaidWithoutAdvance + advanceAmount;
      const totalAmount = Number(payment.total_amount) || 0;

      let invoicePaymentStatus = "unpaid";
      let invoiceStatus = "open";

      if (totalSettled >= totalAmount && totalAmount > 0) {
        invoicePaymentStatus = "paid";
        invoiceStatus = "closed";
      } else if (totalSettled > 0) {
        invoicePaymentStatus = "partial";
        invoiceStatus = "open";
      }

      const invoiceUpdateResult = await client.query(
        `
        UPDATE invoice
        SET
          payment_status = $1,
          invoice_status = $2,
          updated_at = NOW()
        WHERE invoice_id = $3
        RETURNING *
        `,
        [invoicePaymentStatus, invoiceStatus, payment.invoice_id]
      );

      if (payment.job_id) {
        const jobStatus = invoicePaymentStatus === "paid" ? "completed" : "pending";
        await client.query(
          `
          UPDATE job
          SET
            status = $1,
            updated_at = NOW()
          WHERE job_id = $2
          `,
          [jobStatus, payment.job_id]
        );
      }

      await client.query("COMMIT");

      return {
        deleted_payment: payment,
        invoice: invoiceUpdateResult.rows[0],
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
