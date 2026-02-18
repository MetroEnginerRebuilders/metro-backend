const pool = require("../config/database");

class ItemTypeRepository {
  async findAll() {
    const query = "SELECT * FROM item_types ORDER BY item_type_name ASC";
    const result = await pool.query(query);
    return result.rows;
  }

  async findById(itemTypeId) {
    const query = "SELECT * FROM item_types WHERE item_type_id = $1";
    const result = await pool.query(query, [itemTypeId]);
    return result.rows[0];
  }
}

module.exports = new ItemTypeRepository();
