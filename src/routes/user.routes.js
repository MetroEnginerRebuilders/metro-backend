const express = require("express");
const router = express.Router();
const userController = require("../controller/user.controller");

// Admin login route
router.post("/admin/login", userController.login);

// Admin register route
router.post("/admin/register", userController.register);

// Change password route
router.post("/admin/change-password", userController.changePassword);

module.exports = router;
