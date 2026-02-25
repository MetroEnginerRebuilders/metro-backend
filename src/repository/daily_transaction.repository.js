const pool = require("../config/database");

class DailyTransactionRepository {
  async getFinanceTypeIdByCode(financeTypeCode, client = null) {
    const executor = client || pool;
    const query = `
      SELECT finance_type_id
      FROM finance_types
      WHERE finance_type_code = $1
      LIMIT 1
    `;
    const result = await executor.query(query, [financeTypeCode]);
    return result.rows[0]?.finance_type_id || null;
  }

  async create(entry, client = null) {
    const executor = client || pool;
    const query = `
      INSERT INTO daily_transaction (
        shop_id,
        finance_types_id,
        finance_categories_id,
        reference_type,
        reference_id,
        bank_account_id,
        amount,
        transaction_date,
        description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      entry.shop_id || null,
      entry.finance_types_id || null,
      entry.finance_categories_id || null,
      entry.reference_type || null,
      entry.reference_id || null,
      entry.bank_account_id || null,
      Number(entry.amount) || 0,
      entry.transaction_date,
      entry.description || null,
    ];

    const result = await executor.query(query, values);
    return result.rows[0];
  }

  async deleteByReference(referenceType, referenceId, client = null) {
    const executor = client || pool;
    const query = `
      DELETE FROM daily_transaction
      WHERE reference_type = $1
        AND reference_id = $2
    `;
    await executor.query(query, [referenceType, referenceId]);
  }
}

module.exports = new DailyTransactionRepository();