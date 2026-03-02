const pool = require("../config/database");

class BankAccountRepository {
  // Create new bank account
  async create(accountData) {
    const query = `
      INSERT INTO bank_account (
        account_name, account_number, opening_balance, activate_date, current_balance
      ) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *
    `;
    const result = await pool.query(query, [
      accountData.accountName,
      accountData.accountNumber || null,
      accountData.openingBalance,
      accountData.activateDate,
      accountData.openingBalance // current_balance initially equals opening_balance
    ]);
    return result.rows[0];
  }

  // Get all bank accounts with pagination and search
  async findAll(searchTerm = "", page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    let query = "SELECT * FROM bank_account";
    let countQuery = "SELECT COUNT(*) FROM bank_account";
    let params = [];
    let countParams = [];
    
    if (searchTerm && searchTerm.trim() !== "") {
      const searchCondition = " WHERE account_name ILIKE $1";
      query += searchCondition;
      countQuery += searchCondition;
      const searchParam = `%${searchTerm.trim()}%`;
      params.push(searchParam);
      countParams.push(searchParam);
    }
    
    query += " ORDER BY created_at DESC LIMIT $" + (params.length + 1) + " OFFSET $" + (params.length + 2);
    params.push(limit, offset);
    
    const [dataResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams)
    ]);
    
    return {
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  // Get active bank accounts
  async findActive() {
    const query = `
      SELECT *
      FROM bank_account
      WHERE activate_date <= CURRENT_DATE
        AND (inactivate_date IS NULL OR inactivate_date > CURRENT_DATE)
      ORDER BY account_name ASC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  // Get bank account by ID
  async findById(bankAccountId) {
    const query = "SELECT * FROM bank_account WHERE bank_account_id = $1";
    const result = await pool.query(query, [bankAccountId]);
    return result.rows[0];
  }

  // Check if account name already exists (for validation)
  async findByName(accountName) {
    const query = "SELECT * FROM bank_account WHERE account_name = $1";
    const result = await pool.query(query, [accountName]);
    return result.rows[0];
  }

  // Update bank account
  async update(bankAccountId, accountData) {
    const query = `
      UPDATE bank_account 
      SET account_name = $1, 
          account_number = $2,
          opening_balance = $3, 
          activate_date = $4, 
          inactivate_date = $5,
          updated_at = NOW() 
      WHERE bank_account_id = $6 
      RETURNING *
    `;
    const result = await pool.query(query, [
      accountData.accountName,
      accountData.accountNumber || null,
      accountData.openingBalance,
      accountData.activateDate,
      accountData.inactivateDate || null,
      bankAccountId
    ]);
    return result.rows[0];
  }

  // Delete bank account
  async delete(bankAccountId) {
    const query = "DELETE FROM bank_account WHERE bank_account_id = $1 RETURNING *";
    const result = await pool.query(query, [bankAccountId]);
    return result.rows[0];
  }

  // Account transfer
  async transfer(transferData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get from account
      const fromAccountQuery = "SELECT * FROM bank_account WHERE bank_account_id = $1 FOR UPDATE";
      const fromAccountResult = await client.query(fromAccountQuery, [transferData.fromAccountId]);
      const fromAccount = fromAccountResult.rows[0];

      if (!fromAccount) {
        throw new Error("From account not found");
      }

      // Check if from account has sufficient balance
      if (parseFloat(fromAccount.current_balance) < parseFloat(transferData.amount)) {
        throw new Error("Insufficient balance in from account");
      }

      // Get to account
      const toAccountQuery = "SELECT * FROM bank_account WHERE bank_account_id = $1 FOR UPDATE";
      const toAccountResult = await client.query(toAccountQuery, [transferData.toAccountId]);
      const toAccount = toAccountResult.rows[0];

      if (!toAccount) {
        throw new Error("To account not found");
      }

      // Update from account - subtract amount
      const updateFromQuery = `
        UPDATE bank_account 
        SET current_balance = current_balance - $1,
            last_transaction = $2,
            updated_at = NOW()
        WHERE bank_account_id = $3
        RETURNING *
      `;
      const updatedFromAccount = await client.query(updateFromQuery, [
        transferData.amount,
        transferData.transferDate,
        transferData.fromAccountId
      ]);

      // Update to account - add amount
      const updateToQuery = `
        UPDATE bank_account 
        SET current_balance = current_balance + $1,
            last_transaction = $2,
            updated_at = NOW()
        WHERE bank_account_id = $3
        RETURNING *
      `;
      const updatedToAccount = await client.query(updateToQuery, [
        transferData.amount,
        transferData.transferDate,
        transferData.toAccountId
      ]);

      await client.query('COMMIT');

      return {
        fromAccount: updatedFromAccount.rows[0],
        toAccount: updatedToAccount.rows[0]
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Add amount to bank account (for income)
  async addBalance(bankAccountId, amount, transactionDate) {
    const query = `
      UPDATE bank_account 
      SET current_balance = current_balance + $1,
          last_transaction = $2,
          updated_at = NOW()
      WHERE bank_account_id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [amount, transactionDate, bankAccountId]);
    return result.rows[0];
  }

  // Subtract amount from bank account (for expense)
  async subtractBalance(bankAccountId, amount, transactionDate) {
    const query = `
      UPDATE bank_account 
      SET current_balance = current_balance - $1,
          last_transaction = $2,
          updated_at = NOW()
      WHERE bank_account_id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [amount, transactionDate, bankAccountId]);
    return result.rows[0];
  }
}

module.exports = new BankAccountRepository();
