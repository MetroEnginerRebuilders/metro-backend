const express = require("express");
const router = express.Router();
const userController = require("../controller/user.controller");

// Admin login route
router.post("/admin/login", userController.login);

// Change password route
router.post("/admin/change-password", userController.changePassword);

module.exports = router;
