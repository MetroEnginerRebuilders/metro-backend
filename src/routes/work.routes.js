const express = require("express");
const router = express.Router();
const workController = require("../controller/work.controller");

// Work routes
router.post("/work", workController.create);
router.get("/work", workController.list);
router.put("/work/:workId", workController.update);
router.delete("/work/:workId", workController.delete);

module.exports = router;
