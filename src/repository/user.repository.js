const pool = require("../config/database");

class UserRepository {
  // Find user by username
  async findByUsername(username) {
    const query = "SELECT * FROM users WHERE username = $1";
    const result = await pool.query(query, [username]);
    return result.rows[0];
  }

  // Find user by ID
  async findById(id) {
    const query = "SELECT * FROM users WHERE id = $1";
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // Update user password
  async updatePassword(id, hashedPassword) {
    const query = "UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username";
    const result = await pool.query(query, [hashedPassword, id]);
    return result.rows[0];
  }

  // Create new user
  async createUser(username, hashedPassword) {
    const query = `INSERT INTO users (username, password, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id, username`;
    const result = await pool.query(query, [username, hashedPassword]);
    return result.rows[0];
  }

}

module.exports = new UserRepository();
