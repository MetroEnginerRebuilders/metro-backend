const pool = require("../config/database");
const dailyTransactionRepository = require("./daily_transaction.repository");

class StaffSalaryRepository {
  // Get current month salary summary by staff ID
  async getMonthlySalarySummaryByStaffId(staffId) {
    const query = `
      SELECT
        s.staff_id,
        s.staff_name,
        COALESCE(s.salary, 0) AS monthly_salary,
        COALESCE(
          SUM(
            CASE
              WHEN LOWER(st.salary_type) = 'advance' THEN ss.amount
              ELSE 0
            END
          ),
          0
        ) AS advance_paid_this_month,
        COALESCE(
          SUM(
            CASE
              WHEN LOWER(st.salary_type) = 'salary' THEN ss.amount
              ELSE 0
            END
          ),
          0
        ) AS salary_paid_this_month,
        COALESCE(SUM(ss.amount), 0) AS total_paid_this_month
      FROM staff s
      LEFT JOIN staff_salary ss
        ON s.staff_id = ss.staff_id
        AND DATE_TRUNC('month', ss.effective_date) = DATE_TRUNC('month', CURRENT_DATE)
      LEFT JOIN salary_type st ON ss.salary_type_id = st.salary_type_id
      WHERE s.staff_id = $1
      GROUP BY s.staff_id, s.staff_name, s.salary
    `;

    const result = await pool.query(query, [staffId]);
    const summary = result.rows[0];

    if (!summary) {
      return null;
    }

    const monthlySalary = parseFloat(summary.monthly_salary) || 0;
    const advancePaid = parseFloat(summary.advance_paid_this_month) || 0;
    const salaryPaid = parseFloat(summary.salary_paid_this_month) || 0;
    const totalPaid = parseFloat(summary.total_paid_this_month) || 0;
    const balanceAmount = monthlySalary - totalPaid;

    return {
      staff_id: summary.staff_id,
      staff_name: summary.staff_name,
      month: new Date().toLocaleString("default", { month: "long", year: "numeric" }),
      monthly_salary: monthlySalary,
      advance_paid_this_month: advancePaid,
      salary_paid_this_month: salaryPaid,
      total_paid_this_month: totalPaid,
      balance_amount: balanceAmount,
    };
  }

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

      const expenseTypeId = await dailyTransactionRepository.getFinanceTypeIdByCode("EXPENSE", client);
      await dailyTransactionRepository.create(
        {
          shop_id: null,
          finance_types_id: expenseTypeId,
          finance_categories_id: null,
          reference_type: "salary",
          reference_id: result.rows[0].staff_salary_id,
          bank_account_id: staffSalaryData.bankAccountId,
          amount: staffSalaryData.amount,
          transaction_date: staffSalaryData.effectiveDate,
          description: staffSalaryData.remarks || "Staff salary payment",
        },
        client
      );

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

      await dailyTransactionRepository.deleteByReference("salary", staffSalaryId, client);

      const updatedSalary = result.rows[0];
      if (updatedSalary) {
        const expenseTypeId = await dailyTransactionRepository.getFinanceTypeIdByCode("EXPENSE", client);
        await dailyTransactionRepository.create(
          {
            shop_id: null,
            finance_types_id: expenseTypeId,
            finance_categories_id: null,
            reference_type: "salary",
            reference_id: updatedSalary.staff_salary_id,
            bank_account_id: updatedSalary.bank_account_id,
            amount: updatedSalary.amount,
            transaction_date: updatedSalary.effective_date,
            description: updatedSalary.remarks || "Staff salary payment",
          },
          client
        );
      }

      await client.query('COMMIT');
      return updatedSalary;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Delete staff salary
  async delete(staffSalaryId) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const query = "DELETE FROM staff_salary WHERE staff_salary_id = $1 RETURNING *";
      const result = await client.query(query, [staffSalaryId]);

      await dailyTransactionRepository.deleteByReference("salary", staffSalaryId, client);

      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new StaffSalaryRepository();
