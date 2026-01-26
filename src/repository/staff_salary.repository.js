const pool = require("../config/database");

class StaffSalaryRepository {
  // Create new staff salary
  async create(staffSalaryData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check bank account has sufficient balance
      const bankQuery = "SELECT * FROM bank_account WHERE bank_account_id = $1 FOR UPDATE";
      const bankResult = await client.query(bankQuery, [staffSalaryData.bankAccountId]);
      const bankAccount = bankResult.rows[0];

      if (!bankAccount) {
        throw new Error("Bank account not found");
      }

      if (parseFloat(bankAccount.current_balance) < parseFloat(staffSalaryData.amount)) {
        throw new Error("Insufficient balance in bank account");
      }

      // Insert staff salary
      const insertQuery = `
        INSERT INTO staff_salary (
          staff_id, bank_account_id, effective_date, amount, salary_type_id, remarks
        ) 
        VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING *
      `;
      const result = await client.query(insertQuery, [
        staffSalaryData.staffId,
        staffSalaryData.bankAccountId,
        staffSalaryData.effectiveDate,
        staffSalaryData.amount,
        staffSalaryData.salaryTypeId,
        staffSalaryData.remarks || null
      ]);

      // Update bank account - subtract amount and update last_transaction
      const updateBankQuery = `
        UPDATE bank_account 
        SET current_balance = current_balance - $1,
            last_transaction = CURRENT_TIMESTAMP, 
            updated_at = NOW()
        WHERE bank_account_id = $2
      `;
      await client.query(updateBankQuery, [staffSalaryData.amount, staffSalaryData.bankAccountId]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get all staff salaries with pagination and search
  async findAll(searchTerm = "", page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT ss.*, 
             s.staff_name, 
             ba.account_name, 
             st.salary_type
      FROM staff_salary ss
      LEFT JOIN staff s ON ss.staff_id = s.staff_id
      LEFT JOIN bank_account ba ON ss.bank_account_id = ba.bank_account_id
      LEFT JOIN salary_type st ON ss.salary_type_id = st.salary_type_id
    `;
    let countQuery = `
      SELECT COUNT(*) 
      FROM staff_salary ss
      LEFT JOIN staff s ON ss.staff_id = s.staff_id
    `;
    let params = [];
    let countParams = [];
    
    if (searchTerm && searchTerm.trim() !== "") {
      const searchCondition = " WHERE s.staff_name ILIKE $1";
      query += searchCondition;
      countQuery += searchCondition;
      const searchParam = `%${searchTerm.trim()}%`;
      params.push(searchParam);
      countParams.push(searchParam);
    }
    
    query += " ORDER BY ss.effective_date DESC LIMIT $" + (params.length + 1) + " OFFSET $" + (params.length + 2);
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

  // Get staff salary by ID
  async findById(staffSalaryId) {
    const query = `
      SELECT ss.*, 
             s.staff_name, 
             ba.account_name, 
             st.salary_type
      FROM staff_salary ss
      LEFT JOIN staff s ON ss.staff_id = s.staff_id
      LEFT JOIN bank_account ba ON ss.bank_account_id = ba.bank_account_id
      LEFT JOIN salary_type st ON ss.salary_type_id = st.salary_type_id
      WHERE ss.staff_salary_id = $1
    `;
    const result = await pool.query(query, [staffSalaryId]);
    return result.rows[0];
  }

  // Get staff by ID to check salary
  async getStaffById(staffId) {
    const query = "SELECT * FROM staff WHERE staff_id = $1";
    const result = await pool.query(query, [staffId]);
    return result.rows[0];
  }

  // Update staff salary
  async update(staffSalaryId, staffSalaryData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get old staff salary record
      const oldSalaryQuery = "SELECT * FROM staff_salary WHERE staff_salary_id = $1";
      const oldSalaryResult = await client.query(oldSalaryQuery, [staffSalaryId]);
      const oldSalary = oldSalaryResult.rows[0];

      if (!oldSalary) {
        throw new Error("Staff salary record not found");
      }

      const oldAmount = parseFloat(oldSalary.amount);
      const newAmount = parseFloat(staffSalaryData.amount);
      const amountDifference = newAmount - oldAmount;

      // If bank account is being changed, we need to handle both accounts
      if (oldSalary.bank_account_id !== staffSalaryData.bankAccountId) {
        // Add back the old amount to the old bank account
        const updateOldBankQuery = `
          UPDATE bank_account 
          SET current_balance = current_balance + $1,
              last_transaction = CURRENT_TIMESTAMP, 
              updated_at = NOW()
          WHERE bank_account_id = $2
        `;
        await client.query(updateOldBankQuery, [oldAmount, oldSalary.bank_account_id]);

        // Check new bank account has sufficient balance
        const newBankQuery = "SELECT * FROM bank_account WHERE bank_account_id = $1 FOR UPDATE";
        const newBankResult = await client.query(newBankQuery, [staffSalaryData.bankAccountId]);
        const newBankAccount = newBankResult.rows[0];

        if (!newBankAccount) {
          throw new Error("New bank account not found");
        }

        if (parseFloat(newBankAccount.current_balance) < newAmount) {
          throw new Error("Insufficient balance in new bank account");
        }

        // Subtract new amount from new bank account
        const updateNewBankQuery = `
          UPDATE bank_account 
          SET current_balance = current_balance - $1,
              last_transaction = CURRENT_TIMESTAMP, 
              updated_at = NOW()
          WHERE bank_account_id = $2
        `;
        await client.query(updateNewBankQuery, [newAmount, staffSalaryData.bankAccountId]);
      } else {
        // Same bank account - adjust by difference
        if (amountDifference !== 0) {
          // Check bank account has sufficient balance if amount increased
          if (amountDifference > 0) {
            const bankQuery = "SELECT * FROM bank_account WHERE bank_account_id = $1 FOR UPDATE";
            const bankResult = await client.query(bankQuery, [staffSalaryData.bankAccountId]);
            const bankAccount = bankResult.rows[0];

            if (!bankAccount) {
              throw new Error("Bank account not found");
            }

            if (parseFloat(bankAccount.current_balance) < amountDifference) {
              throw new Error("Insufficient balance in bank account for the additional amount");
            }
          }

          // If amount increased, subtract difference; if decreased, add difference back
          const updateBankQuery = `
            UPDATE bank_account 
            SET current_balance = current_balance - $1,
                last_transaction = CURRENT_TIMESTAMP, 
                updated_at = NOW()
            WHERE bank_account_id = $2
          `;
          await client.query(updateBankQuery, [amountDifference, staffSalaryData.bankAccountId]);
        }
      }

      // Update staff salary record
      const updateQuery = `
        UPDATE staff_salary 
        SET staff_id = $1, 
            bank_account_id = $2, 
            effective_date = $3, 
            amount = $4, 
            salary_type_id = $5, 
            remarks = $6,
            updated_at = NOW() 
        WHERE staff_salary_id = $7 
        RETURNING *
      `;
      const result = await client.query(updateQuery, [
        staffSalaryData.staffId,
        staffSalaryData.bankAccountId,
        staffSalaryData.effectiveDate,
        staffSalaryData.amount,
        staffSalaryData.salaryTypeId,
        staffSalaryData.remarks || null,
        staffSalaryId
      ]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Delete staff salary
  async delete(staffSalaryId) {
    const query = "DELETE FROM staff_salary WHERE staff_salary_id = $1 RETURNING *";
    const result = await pool.query(query, [staffSalaryId]);
    return result.rows[0];
  }
}

module.exports = new StaffSalaryRepository();
