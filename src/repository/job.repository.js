const pool = require("../config/database");
const dailyTransactionRepository = require("./daily_transaction.repository");

class JobRepository {
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

  async findById(jobId) {
    const query = `
      SELECT
        j.job_id,
        j.job_number,
        j.customer_id,
        j.description,
        j.advance_amount,
        j.bank_account_id,
        j.received_items,
        j.start_date,
        j.status,
        j.created_at,
        j.updated_at,
        c.customer_id,
        c.customer_number,
        c.customer_name,
        c.customer_address1,
        c.customer_address2,
        c.customer_phone_number,
        c.customer_type_id,
        c.created_at AS customer_created_at,
        c.updated_at AS customer_updated_at,
        ba.bank_account_id,
        ba.account_name,
        ba.account_number,
        ba.current_balance,
        ba.opening_balance,
        ba.activate_date,
        ba.inactivate_date,
        ba.last_transaction,
        ba.created_at AS bank_created_at,
        ba.updated_at AS bank_updated_at
      FROM job j
      LEFT JOIN customer c ON j.customer_id = c.customer_id
      LEFT JOIN bank_account ba ON j.bank_account_id = ba.bank_account_id
      WHERE j.job_id = $1
    `;
    const result = await pool.query(query, [jobId]);
    return result.rows[0];
  }

  async updateById(jobId, updateData) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const currentJobResult = await client.query(
        `
        SELECT job_id, job_number, advance_amount, bank_account_id
        FROM job
        WHERE job_id = $1
        FOR UPDATE
        `,
        [jobId]
      );

      const currentJob = currentJobResult.rows[0];
      if (!currentJob) {
        await client.query("ROLLBACK");
        return null;
      }

      const currentAdvance = Number(currentJob.advance_amount) || 0;
      const newAdvance = updateData.advance_amount !== null ? Number(updateData.advance_amount) : currentAdvance;
      const currentBankId = currentJob.bank_account_id;
      const newBankId = updateData.bank_account_id;

      // Scenario 1: Amount decreased (e.g., 1000 -> 750, subtract 250)
      if (newAdvance < currentAdvance && currentBankId) {
        const deductAmount = currentAdvance - newAdvance;
        await client.query(
          `
          UPDATE bank_account
          SET current_balance = current_balance - $1,
              last_transaction = NOW(),
              updated_at = NOW()
          WHERE bank_account_id = $2
          `,
          [deductAmount, currentBankId]
        );
      }
      // Scenario 2: Amount increased (e.g., 1000 -> 1500, add 500)
      else if (newAdvance > currentAdvance && newBankId) {
        const addAmount = newAdvance - currentAdvance;
        await client.query(
          `
          UPDATE bank_account
          SET current_balance = current_balance + $1,
              last_transaction = NOW(),
              updated_at = NOW()
          WHERE bank_account_id = $2
          `,
          [addAmount, newBankId]
        );
      }

      // Scenario 3: Amount unchanged but bank changed (subtract from old, add to new)
      if (newAdvance === currentAdvance && currentBankId !== newBankId && currentAdvance > 0) {
        if (currentBankId) {
          await client.query(
            `
            UPDATE bank_account
            SET current_balance = current_balance - $1,
                last_transaction = NOW(),
                updated_at = NOW()
            WHERE bank_account_id = $2
            `,
            [currentAdvance, currentBankId]
          );
        }
        if (newBankId) {
          await client.query(
            `
            UPDATE bank_account
            SET current_balance = current_balance + $1,
                last_transaction = NOW(),
                updated_at = NOW()
            WHERE bank_account_id = $2
            `,
            [newAdvance, newBankId]
          );
        }
      }

      // Scenario 4: Both amount and bank changed (subtract old from old bank, add new to new bank)
      if (newAdvance !== currentAdvance && currentBankId !== newBankId) {
        if (currentBankId && currentAdvance > 0) {
          await client.query(
            `
            UPDATE bank_account
            SET current_balance = current_balance - $1,
                last_transaction = NOW(),
                updated_at = NOW()
            WHERE bank_account_id = $2
            `,
            [currentAdvance, currentBankId]
          );
        }
        if (newBankId && newAdvance > 0) {
          await client.query(
            `
            UPDATE bank_account
            SET current_balance = current_balance + $1,
                last_transaction = NOW(),
                updated_at = NOW()
            WHERE bank_account_id = $2
            `,
            [newAdvance, newBankId]
          );
        }
      }

      const updateJobQuery = `
        UPDATE job
        SET 
          customer_id = COALESCE($1, customer_id),
          description = COALESCE($2, description),
          advance_amount = COALESCE($3, advance_amount),
          bank_account_id = COALESCE($4, bank_account_id),
          start_date = COALESCE($5, start_date),
          received_items = COALESCE($6, received_items),
          updated_at = NOW()
        WHERE job_id = $7
        RETURNING *
      `;

      const updateResult = await client.query(updateJobQuery, [
        updateData.customer_id || null,
        updateData.description || null,
        updateData.advance_amount !== null ? updateData.advance_amount : null,
        updateData.bank_account_id || null,
        updateData.start_date || null,
        updateData.received_items || null,
        jobId,
      ]);

      const updatedJob = updateResult.rows[0];
      const advanceRemarkRef = `JOB_ADVANCE:${updatedJob.job_number}`;
      const legacyAdvanceRemarkRef = `JOB_ADVANCE:${jobId}`;

      const existingAdvanceFinanceResult = await client.query(
        `
        SELECT finance_id
        FROM finance
        WHERE remarks = ANY($1::text[])
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
        `,
        [[advanceRemarkRef, legacyAdvanceRemarkRef]]
      );

      const existingAdvanceFinance = existingAdvanceFinanceResult.rows[0];
      const hasAdvance = Number(updatedJob?.advance_amount) > 0;
      const hasBankAccount = !!updatedJob?.bank_account_id;

      if (hasAdvance && hasBankAccount) {
        const incomeMeta = await this.getLatheWorkIncomeMeta(client);

        if (existingAdvanceFinance) {
          const financeUpdateResult = await client.query(
            `
            UPDATE finance
            SET
              bank_account_id = $1,
              finance_category_id = $2,
              finance_type_id = $3,
              amount = $4,
              transaction_date = $5,
              description = $6,
              remarks = $7
            WHERE finance_id = $8
            RETURNING *
            `,
            [
              updatedJob.bank_account_id,
              incomeMeta.finance_category_id,
              incomeMeta.finance_type_id,
              updatedJob.advance_amount,
              updatedJob.start_date,
              `Advance of Job ${updatedJob.job_number}`,
              advanceRemarkRef,
              existingAdvanceFinance.finance_id,
            ]
          );

          const updatedFinance = financeUpdateResult.rows[0];
          await dailyTransactionRepository.deleteByReference("finance", updatedFinance.finance_id, client);
          await dailyTransactionRepository.create(
            {
              finance_types_id: updatedFinance.finance_type_id,
              finance_categories_id: updatedFinance.finance_category_id,
              reference_type: "finance",
              reference_id: updatedFinance.finance_id,
              bank_account_id: updatedFinance.bank_account_id,
              amount: updatedFinance.amount,
              transaction_date: updatedFinance.transaction_date,
              description: updatedFinance.description || updatedFinance.remarks,
            },
            client
          );
        } else {
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
              updatedJob.bank_account_id,
              incomeMeta.finance_category_id,
              incomeMeta.finance_type_id,
              updatedJob.advance_amount,
              updatedJob.start_date,
              `Advance of Job ${updatedJob.job_number}`,
              advanceRemarkRef,
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
        }
      } else if (existingAdvanceFinance) {
        await dailyTransactionRepository.deleteByReference("finance", existingAdvanceFinance.finance_id, client);
        await client.query("DELETE FROM finance WHERE finance_id = $1", [existingAdvanceFinance.finance_id]);
      }

      await dailyTransactionRepository.deleteByReference("job", jobId, client);

      await client.query("COMMIT");

      return updatedJob;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteById(jobId) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const jobResult = await client.query(
        `
        SELECT job_id, job_number, advance_amount, bank_account_id
        FROM job
        WHERE job_id = $1
        FOR UPDATE
        `,
        [jobId]
      );

      const job = jobResult.rows[0];
      if (!job) {
        await client.query("ROLLBACK");
        return null;
      }

      const invoiceResult = await client.query(
        `
        SELECT invoice_id, invoice_number
        FROM invoice
        WHERE job_id = $1
        FOR UPDATE
        `,
        [jobId]
      );

      const invoice = invoiceResult.rows[0];
      let deletedInvoiceItems = 0;
      let deletedInvoice = null;

      if (invoice) {
        const paymentSumsResult = await client.query(
          `
          SELECT bank_account_id, COALESCE(SUM(amount_paid), 0) AS total_paid
          FROM invoice_payment
          WHERE invoice_id = $1
          GROUP BY bank_account_id
          `,
          [invoice.invoice_id]
        );

        const paymentRowsResult = await client.query(
          `
          SELECT invoice_payment_id
          FROM invoice_payment
          WHERE invoice_id = $1
          `,
          [invoice.invoice_id]
        );

        const paymentIds = paymentRowsResult.rows.map((row) => row.invoice_payment_id);

        if (paymentIds.length > 0) {
          const invoiceRemarkRef = `INVOICE_PAYMENT:${invoice.invoice_number}`;

          const invoiceNumberLinkedFinanceResult = await client.query(
            `
            SELECT finance_id
            FROM finance
            WHERE remarks = $1
            `,
            [invoiceRemarkRef]
          );

          for (const linkedFinance of invoiceNumberLinkedFinanceResult.rows) {
            await dailyTransactionRepository.deleteByReference("finance", linkedFinance.finance_id, client);
            await client.query("DELETE FROM finance WHERE finance_id = $1", [linkedFinance.finance_id]);
          }

          for (const paymentId of paymentIds) {
            const remarkRef = `INVOICE_PAYMENT:${paymentId}`;
            const linkedFinanceResult = await client.query(
              `
              SELECT finance_id
              FROM finance
              WHERE remarks = $1
              `,
              [remarkRef]
            );

            for (const linkedFinance of linkedFinanceResult.rows) {
              await dailyTransactionRepository.deleteByReference("finance", linkedFinance.finance_id, client);
              await client.query("DELETE FROM finance WHERE finance_id = $1", [linkedFinance.finance_id]);
            }
          }
        }

        for (const row of paymentSumsResult.rows) {
          if (!row.bank_account_id) {
            continue;
          }

          const totalPaid = Number(row.total_paid) || 0;
          if (totalPaid <= 0) {
            continue;
          }

          await client.query(
            `
            UPDATE bank_account
            SET current_balance = current_balance - $1,
                last_transaction = NOW(),
                updated_at = NOW()
            WHERE bank_account_id = $2
            `,
            [totalPaid, row.bank_account_id]
          );
        }

        const deleteItemsResult = await client.query(
          `
          DELETE FROM invoice_items
          WHERE invoice_id = $1
          `,
          [invoice.invoice_id]
        );
        deletedInvoiceItems = deleteItemsResult.rowCount || 0;

        const deleteInvoiceResult = await client.query(
          `
          DELETE FROM invoice
          WHERE invoice_id = $1
          RETURNING *
          `,
          [invoice.invoice_id]
        );
        deletedInvoice = deleteInvoiceResult.rows[0] || null;
      }

      const advanceAmount = Number(job.advance_amount) || 0;
      if (job.bank_account_id && advanceAmount > 0) {
        await client.query(
          `
          UPDATE bank_account
          SET current_balance = current_balance - $1,
              last_transaction = NOW(),
              updated_at = NOW()
          WHERE bank_account_id = $2
          `,
          [advanceAmount, job.bank_account_id]
        );
      }

      const advanceFinanceResult = await client.query(
        `
        SELECT finance_id
        FROM finance
        WHERE remarks = ANY($1::text[])
        `,
        [[`JOB_ADVANCE:${job.job_number}`, `JOB_ADVANCE:${job.job_id}`]]
      );

      for (const row of advanceFinanceResult.rows) {
        await dailyTransactionRepository.deleteByReference("finance", row.finance_id, client);
        await client.query("DELETE FROM finance WHERE finance_id = $1", [row.finance_id]);
      }

      await dailyTransactionRepository.deleteByReference("job", jobId, client);

      const deleteJobResult = await client.query(
        `
        DELETE FROM job
        WHERE job_id = $1
        RETURNING *
        `,
        [jobId]
      );

      await client.query("COMMIT");

      return {
        job: deleteJobResult.rows[0],
        invoice: deletedInvoice,
        deleted_invoice_items_count: deletedInvoiceItems,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findAll(searchTerm = "", page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        j.*, 
        c.customer_name,
        c.customer_number,
        ba.account_name
      FROM job j
      LEFT JOIN customer c ON j.customer_id = c.customer_id
      LEFT JOIN bank_account ba ON j.bank_account_id = ba.bank_account_id
    `;
    let countQuery = "SELECT COUNT(*) FROM job j";
    let params = [];
    let countParams = [];

    if (searchTerm && searchTerm.trim() !== "") {
      const searchCondition = `
        WHERE j.job_number ILIKE $1
          OR c.customer_name ILIKE $1
          OR c.customer_number ILIKE $1
          OR j.description ILIKE $1
          OR j.status ILIKE $1
          OR j.received_items ILIKE $1
      `;
      query += searchCondition;
      countQuery += `
        LEFT JOIN customer c ON j.customer_id = c.customer_id
        ${searchCondition}
      `;
      const searchParam = `%${searchTerm.trim()}%`;
      params.push(searchParam);
      countParams.push(searchParam);
    }

    query += " ORDER BY j.created_at DESC LIMIT $" + (params.length + 1) + " OFFSET $" + (params.length + 2);
    params.push(limit, offset);

    const [dataResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams),
    ]);

    return {
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].count),
    };
  }

  async createWithInvoice(jobData) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const year = new Date().getFullYear();
      const jobNumberResult = await client.query(
        `
        SELECT job_number
        FROM job
        WHERE job_number LIKE $1
        ORDER BY job_number DESC
        LIMIT 1
        FOR UPDATE
        `,
        [`${year}/J%`]
      );

      let nextJobSequence = 1;
      if (jobNumberResult.rows.length > 0) {
        const lastJobNumber = jobNumberResult.rows[0].job_number;
        const match = lastJobNumber.match(/\/J(\d+)$/);
        if (match) {
          nextJobSequence = parseInt(match[1], 10) + 1;
        }
      }

      const jobNumber = `${year}/J${String(nextJobSequence).padStart(4, "0")}`;

      const jobInsertResult = await client.query(
        `
        INSERT INTO job (
          job_number,
          customer_id,
          description,
          advance_amount,
          bank_account_id,
          received_items,
          start_date,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [
          jobNumber,
          jobData.customer_id,
          jobData.description || null,
          jobData.advance_amount || 0,
          jobData.bank_account_id || null,
          jobData.received_items || null,
          jobData.start_date,
          "pending",
        ]
      );

      const job = jobInsertResult.rows[0];

      if (jobData.bank_account_id && Number(jobData.advance_amount) > 0) {
        await client.query(
          `
          UPDATE bank_account
          SET current_balance = current_balance + $1,
              last_transaction = $2,
              updated_at = NOW()
          WHERE bank_account_id = $3
          `,
          [jobData.advance_amount, jobData.start_date, jobData.bank_account_id]
        );

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
            jobData.bank_account_id,
            incomeMeta.finance_category_id,
            incomeMeta.finance_type_id,
            jobData.advance_amount,
            jobData.start_date,
            `Advance of Job ${job.job_number}`,
            `JOB_ADVANCE:${job.job_number}`,
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
      }

      const invoiceNumberResult = await client.query(
        `
        SELECT invoice_number
        FROM invoice
        ORDER BY invoice_number DESC
        LIMIT 1
        FOR UPDATE
        `
      );

      let nextInvoiceSequence = 1;
      if (invoiceNumberResult.rows.length > 0) {
        const lastInvoiceNumber = invoiceNumberResult.rows[0].invoice_number;
        const match = lastInvoiceNumber.match(/^INV(\d+)$/);
        if (match) {
          nextInvoiceSequence = parseInt(match[1], 10) + 1;
        }
      }

      const invoiceNumber = `INV${String(nextInvoiceSequence).padStart(4, "0")}`;

      const invoiceInsertResult = await client.query(
        `
        INSERT INTO invoice (
          invoice_number,
          job_id,
          customer_id,
          invoice_date,
          total_amount,
          invoice_status,
          payment_status
        ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6)
        RETURNING *
        `,
        [invoiceNumber, job.job_id, job.customer_id, 0, "open", "unpaid"]
      );

      const invoice = invoiceInsertResult.rows[0];

      await client.query("COMMIT");

      return { job, invoice };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new JobRepository();
