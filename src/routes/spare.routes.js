const express = require("express");
const router = express.Router();
const spareController = require("../controller/spare.controller");

// Spare routes
router.post("/spare", spareController.create);
router.get("/spare", spareController.list);
router.put("/spare/:spareId", spareController.update);
router.delete("/spare/:spareId", spareController.delete);

module.exports = router;
