const pool = require("../config/database");

class InvoiceItemRepository {
  async addItems(invoiceId, items) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const insertedItems = [];

      for (const item of items) {
        const totalPrice = (item.quantity || 0) * (item.unit_price || 0);

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
          item.quantity || 0,
          item.unit_price || 0,
          totalPrice,
          item.company_id || null,
          item.model_id || null,
        ]);

        insertedItems.push(result.rows[0]);
      }

      const updateInvoiceQuery = `
        UPDATE invoice
        SET total_amount = (
          SELECT COALESCE(SUM(CASE 
            WHEN it.item_type_code = 'DISCOUNT' THEN -ii.total_price
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
}

module.exports = new InvoiceItemRepository();
