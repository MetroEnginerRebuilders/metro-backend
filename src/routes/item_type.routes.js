const express = require("express");
const router = express.Router();
const itemTypeController = require("../controller/item_type.controller");

// Item Type routes
router.get("/item-type", itemTypeController.list);

module.exports = router;
