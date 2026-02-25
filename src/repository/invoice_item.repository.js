const pool = require("../config/database");
const dailyTransactionRepository = require("./daily_transaction.repository");

class InvoiceItemRepository {
  async addItems(invoiceId, items, options = {}) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const insertedItems = [];
      const itemTypeIds = Array.from(
        new Set(items.map(item => item.item_type_id).filter(Boolean))
      );

      const itemTypeResult = itemTypeIds.length
        ? await client.query(
            "SELECT item_type_id, item_type_code FROM item_types WHERE item_type_id = ANY($1)",
            [itemTypeIds]
          )
        : { rows: [] };

      const itemTypeCodeById = new Map(
        itemTypeResult.rows.map(row => [row.item_type_id, row.item_type_code])
      );

      for (const item of items) {
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(item.unit_price) || 0;
        const totalPrice = quantity * unitPrice;

        const query = `
          INSERT INTO invoice_items (
            invoice_id,
            item_type_id,
            work_id,
            spare_id,
            remarks,
            quantity,
            unit_price,
            total_price,
            company_id,
            model_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `;

        const result = await client.query(query, [
          invoiceId,
          item.item_type_id || null,
          item.work_id || null,
          item.spare_id || null,
          item.remarks || item.type_of_work || null,
          quantity,
          unitPrice,
          totalPrice,
          item.company_id || null,
          item.model_id || null,
        ]);

        insertedItems.push(result.rows[0]);

        // Handle commission items - add to finance table
        const itemTypeCode = itemTypeCodeById.get(item.item_type_id);
        if (itemTypeCode === "COMMISSION") {
          const commissionBankAccountId = item.bank_account_id || options.bankAccountId;
          
          if (!commissionBankAccountId) {
            throw new Error("bank_account_id is required for commission items");
          }

          // Get finance_type_id for EXPENSE
          const financeTypeResult = await client.query(
            "SELECT finance_type_id FROM finance_types WHERE finance_type_code = 'EXPENSE'"
          );
          const financeTypeId = financeTypeResult.rows[0]?.finance_type_id;

          if (!financeTypeId) {
            throw new Error("EXPENSE finance type not found");
          }

          // Get finance_category_id for Commission
          const financeCategoryResult = await client.query(
            "SELECT finance_category_id FROM finance_categories WHERE finance_category_name = 'Commission' AND finance_type_id = $1",
            [financeTypeId]
          );
          const financeCategoryId = financeCategoryResult.rows[0]?.finance_category_id;

          if (!financeCategoryId) {
            throw new Error("Commission finance category not found");
          }

          // Get invoice number for description
          const invoiceResult = await client.query(
            "SELECT invoice_number FROM invoice WHERE invoice_id = $1",
            [invoiceId]
          );
          const invoiceNumber = invoiceResult.rows[0]?.invoice_number || invoiceId;

          // Insert into finance table
          const financeQuery = `
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
          `;

          const financeResult = await client.query(financeQuery, [
            commissionBankAccountId,
            financeCategoryId,
            financeTypeId,
            unitPrice,
            new Date().toISOString().split('T')[0],
            `Commission for invoice ${invoiceNumber}`,
            item.remarks || null
          ]);

          const financeRecord = financeResult.rows[0];

          await dailyTransactionRepository.create(
            {
              shop_id: null,
              finance_types_id: financeRecord.finance_type_id,
              finance_categories_id: financeRecord.finance_category_id,
              reference_type: "finance",
              reference_id: financeRecord.finance_id,
              bank_account_id: financeRecord.bank_account_id,
              amount: financeRecord.amount,
              transaction_date: financeRecord.transaction_date,
              description: financeRecord.description || financeRecord.remarks,
            },
            client
          );

          // Update invoice_items with finance_id
          await client.query(
            "UPDATE invoice_items SET finance_id = $1 WHERE invoice_item_id = $2",
            [financeRecord.finance_id, result.rows[0].invoice_item_id]
          );

          // Update bank account balance (deduct commission)
          await client.query(
            "UPDATE bank_account SET current_balance = current_balance - $1, updated_at = NOW() WHERE bank_account_id = $2",
            [unitPrice, commissionBankAccountId]
          );
        }
      }

      const spareItems = items.filter(
        item => itemTypeCodeById.get(item.item_type_id) === "SPARE"
      );

      if (spareItems.length > 0) {
        const resolvedShopId =
          options.shopId || spareItems[0].shop_id || spareItems[0].shopId || null;

        let bankAccountId = options.bankAccountId || null;
        if (!bankAccountId) {
          const bankResult = await client.query(
            `
            SELECT j.bank_account_id
            FROM invoice i
            INNER JOIN job j ON i.job_id = j.job_id
            WHERE i.invoice_id = $1
            `,
            [invoiceId]
          );
          bankAccountId = bankResult.rows[0]?.bank_account_id || null;
        }

        if (!bankAccountId) {
          throw new Error("bankAccountId is required for spare items");
        }

        const stockTypeResult = await client.query(
          "SELECT stock_type_id FROM stock_types WHERE stock_type_code = 'RETURN'"
        );
        const stockTypeId = stockTypeResult.rows[0]?.stock_type_id;

        if (!stockTypeId) {
          throw new Error("RETURN stock type not found");
        }

        for (const item of spareItems) {
          if (!item.company_id || !item.model_id || !item.spare_id) {
            throw new Error("company_id, model_id, and spare_id are required for spare items");
          }

          const availableQuery = `
            SELECT 
              COALESCE(
                SUM(
                  CASE 
                    WHEN stt.stock_type_code = 'PURCHASE' THEN sti.quantity
                    WHEN stt.stock_type_code = 'RETURN' THEN -sti.quantity
                    ELSE 0
                  END
                ), 
                0
              ) as available_quantity
            FROM stock_transaction_items sti
            JOIN stock_transaction st ON sti.stock_transaction_id = st.stock_transaction_id
            JOIN stock_types stt ON st.stock_type_id = stt.stock_type_id
            WHERE sti.company_id = $1 
              AND sti.model_id = $2 
              AND sti.spare_id = $3
          `;

          const availableResult = await client.query(availableQuery, [
            item.company_id,
            item.model_id,
            item.spare_id,
          ]);

          const availableStock =
            parseInt(availableResult.rows[0]?.available_quantity, 10) || 0;

          if ((Number(item.quantity) || 0) > availableStock) {
            throw new Error(
              `Insufficient stock for spare_id ${item.spare_id}. Available ${availableStock}`
            );
          }
        }

        const orderDate =
          options.orderDate || new Date().toISOString().split("T")[0];
        const totalAmount = spareItems.reduce((sum, item) => {
          return sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
        }, 0);

        const description =
          options.description || `Invoice ${invoiceId} returned stock`;

        const stockTransactionResult = await client.query(
          `
          INSERT INTO stock_transaction (
            shop_id,
            stock_type_id,
            order_date,
            description,
            bank_account_id,
            total_amount
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING stock_transaction_id
          `,
          [
            resolvedShopId,
            stockTypeId,
            orderDate,
            description,
            bankAccountId,
            totalAmount,
          ]
        );

        const stockTransactionId =
          stockTransactionResult.rows[0].stock_transaction_id;

        const stockItemQuery = `
          INSERT INTO stock_transaction_items (
            stock_transaction_id,
            company_id,
            model_id,
            spare_id,
            quantity,
            price
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `;

        for (const item of spareItems) {
          await client.query(stockItemQuery, [
            stockTransactionId,
            item.company_id,
            item.model_id,
            item.spare_id,
            Number(item.quantity) || 0,
            Number(item.unit_price) || 0,
          ]);
        }
      }

      const updateInvoiceQuery = `
        UPDATE invoice
        SET total_amount = (
          SELECT COALESCE(SUM(CASE 
            WHEN it.item_type_code = 'DISCOUNT' THEN -ii.total_price
            WHEN it.item_type_code = 'COMMISSION' THEN 0
            ELSE ii.total_price
          END), 0)
          FROM invoice_items ii
          LEFT JOIN item_types it ON ii.item_type_id = it.item_type_id
          WHERE ii.invoice_id = $1
        ),
        updated_at = NOW()
        WHERE invoice_id = $1
        RETURNING *
      `;

      const invoiceResult = await client.query(updateInvoiceQuery, [invoiceId]);

      await client.query("COMMIT");

      return {
        items: insertedItems,
        invoice: invoiceResult.rows[0],
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteItem(invoiceId, invoiceItemId) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const itemResult = await client.query(
        `
        SELECT ii.*, it.item_type_code
        FROM invoice_items ii
        LEFT JOIN item_types it ON ii.item_type_id = it.item_type_id
        WHERE ii.invoice_id = $1 AND ii.invoice_item_id = $2
        `,
        [invoiceId, invoiceItemId]
      );

      const deletedItem = itemResult.rows[0];

      if (!deletedItem) {
        await client.query("ROLLBACK");
        return null;
      }

      // If commission item, delete from finance table and restore bank balance
      if (deletedItem.item_type_code === 'COMMISSION' && deletedItem.finance_id) {
        // Get finance record to get amount and bank account id
        const financeRecord = await client.query(
          "SELECT amount, bank_account_id FROM finance WHERE finance_id = $1",
          [deletedItem.finance_id]
        );

        if (financeRecord.rows.length > 0) {
          const finance = financeRecord.rows[0];
          const financeAmount = finance.amount;
          const commissionBankAccountId = finance.bank_account_id;

          // Delete from finance table by finance_id
          await client.query(
            "DELETE FROM finance WHERE finance_id = $1",
            [deletedItem.finance_id]
          );

          await dailyTransactionRepository.deleteByReference(
            "finance",
            deletedItem.finance_id,
            client
          );

          // Restore bank account balance (add back the commission amount)
          await client.query(
            "UPDATE bank_account SET current_balance = current_balance + $1, updated_at = NOW() WHERE bank_account_id = $2",
            [financeAmount, commissionBankAccountId]
          );
        }
      }

      await client.query(
        "DELETE FROM invoice_items WHERE invoice_id = $1 AND invoice_item_id = $2",
        [invoiceId, invoiceItemId]
      );

      const updateInvoiceQuery = `
        UPDATE invoice
        SET total_amount = (
          SELECT COALESCE(SUM(CASE 
            WHEN it.item_type_code = 'DISCOUNT' THEN -ii.total_price
            WHEN it.item_type_code = 'COMMISSION' THEN 0
            ELSE ii.total_price
          END), 0)
          FROM invoice_items ii
          LEFT JOIN item_types it ON ii.item_type_id = it.item_type_id
          WHERE ii.invoice_id = $1
        ),
        updated_at = NOW()
        WHERE invoice_id = $1
        RETURNING *
      `;

      const invoiceResult = await client.query(updateInvoiceQuery, [invoiceId]);

      await client.query("COMMIT");

      return {
        deletedItem,
        invoice: invoiceResult.rows[0],
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new InvoiceItemRepository();
