const express = require("express");
const router = express.Router();
const shopController = require("../controller/shop.controller");

// Shop routes
router.post("/shop", shopController.create);
router.get("/shop", shopController.list);
router.get("/shop/all", shopController.listAll);
router.put("/shop/:shopId", shopController.update);
router.delete("/shop/:shopId", shopController.delete);

module.exports = router;