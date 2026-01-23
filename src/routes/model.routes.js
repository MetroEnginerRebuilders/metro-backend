const express = require("express");
const router = express.Router();
const modelController = require("../controller/model.controller");

// Model routes
router.post("/model", modelController.create);
router.get("/model", modelController.list);
router.put("/model/:modelId", modelController.update);
router.delete("/model/:modelId", modelController.delete);

module.exports = router;
