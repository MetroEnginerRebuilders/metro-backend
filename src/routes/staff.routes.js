const express = require("express");
const router = express.Router();
const staffController = require("../controller/staff.controller");

// Staff routes
router.post("/staff", staffController.create);
router.get("/staff", staffController.list);
router.get("/staff/active", staffController.listActive);
router.put("/staff/:staffId", staffController.update);
router.delete("/staff/:staffId", staffController.delete);

module.exports = router;
