const express = require("express");
const router = express.Router();
const statementController = require("../controller/statement.controller");
const { verifyToken } = require("../middleware/auth.middleware");

router.post("/statement", verifyToken, statementController.getStatement);

module.exports = router;
