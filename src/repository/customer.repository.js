const pool = require("../config/database");

class CustomerRepository {
  // Generate next customer number based on customer type
  async generateCustomerNumber(customerTypeId) {
    // Get customer type name to determine prefix
    const typeQuery = "SELECT customer_type_name FROM customer_type WHERE customer_type_id = $1";
    const typeResult = await pool.query(typeQuery, [customerTypeId]);
    
    if (!typeResult.rows[0]) {
      throw new Error("Invalid customer type");
    }
    
    const typeName = typeResult.rows[0].customer_type_name;
    let prefix;
    
    // Determine prefix based on customer type
    switch (typeName.toLowerCase()) {
      case 'mechanic':
        prefix = 'M';
        break;
      case 'workshop':
        prefix = 'W';
        break;
      case 'customer':
        prefix = 'C';
        break;
      default:
        prefix = 'C';
    }
    
    // Get the last customer number with this prefix
    const lastNumberQuery = `
      SELECT customer_number 
      FROM customer 
      WHERE customer_number LIKE $1 
      ORDER BY customer_number DESC 
      LIMIT 1
    `;
    const lastNumberResult = await pool.query(lastNumberQuery, [`${prefix}%`]);
    
    let nextNumber = 1;
    if (lastNumberResult.rows[0]) {
      const lastNumber = lastNumberResult.rows[0].customer_number;
      const numericPart = parseInt(lastNumber.substring(1));
      nextNumber = numericPart + 1;
    }
    
    // Format with leading zeros (e.g., M001, W002, C010)
    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
  }

  // Create new customer
  async create(customerData) {
    // Generate customer number
    const customerNumber = await this.generateCustomerNumber(customerData.customerTypeId);
    
    const query = `
      INSERT INTO customer (
        customer_number, customer_name, customer_address1, 
        customer_address2, customer_phone_number, customer_type_id
      ) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *
    `;
    const result = await pool.query(query, [
      customerNumber,
      customerData.customerName,
      customerData.customerAddress1,
      customerData.customerAddress2,
      customerData.customerPhoneNumber,
      customerData.customerTypeId
    ]);
    return result.rows[0];
  }

  // Get all customers with pagination and search
  async findAll(searchTerm = "", page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT c.*, ct.customer_type_name 
      FROM customer c
      LEFT JOIN customer_type ct ON c.customer_type_id = ct.customer_type_id
    `;
    let countQuery = "SELECT COUNT(*) FROM customer c";
    let params = [];
    let countParams = [];
    
    if (searchTerm && searchTerm.trim() !== "") {
      const searchCondition = ` WHERE c.customer_name ILIKE $1 
        OR c.customer_number ILIKE $1 
        OR c.customer_phone_number ILIKE $1
        OR c.customer_address1 ILIKE $1`;
      query += searchCondition;
      countQuery += searchCondition;
      const searchParam = `%${searchTerm.trim()}%`;
      params.push(searchParam);
      countParams.push(searchParam);
    }
    
    query += " ORDER BY c.created_at DESC LIMIT $" + (params.length + 1) + " OFFSET $" + (params.length + 2);
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

  // Get customer by ID
  async findById(customerId) {
    const query = `
      SELECT c.*, ct.customer_type_name 
      FROM customer c
      LEFT JOIN customer_type ct ON c.customer_type_id = ct.customer_type_id
      WHERE c.customer_id = $1
    `;
    const result = await pool.query(query, [customerId]);
    return result.rows[0];
  }

  // Update customer
  async update(customerId, customerData) {
    const query = `
      UPDATE customer 
      SET customer_name = $1, customer_address1 = $2, 
          customer_address2 = $3, customer_phone_number = $4, 
          customer_type_id = $5, updated_at = NOW() 
      WHERE customer_id = $6 
      RETURNING *
    `;
    const result = await pool.query(query, [
      customerData.customerName,
      customerData.customerAddress1,
      customerData.customerAddress2,
      customerData.customerPhoneNumber,
      customerData.customerTypeId,
      customerId
    ]);
    return result.rows[0];
  }

  // Delete customer
  async delete(customerId) {
    const query = "DELETE FROM customer WHERE customer_id = $1 RETURNING *";
    const result = await pool.query(query, [customerId]);
    return result.rows[0];
  }

  // Get all customer types (helper method)
  async getCustomerTypes() {
    const query = "SELECT * FROM customer_type ORDER BY customer_type_name";
    const result = await pool.query(query);
    return result.rows;
  }
}

module.exports = new CustomerRepository();
