const express = require("express");
const router = express.Router();
const jobController = require("../controller/job.controller");

// Job routes
router.post("/job", jobController.create);
router.get("/job", jobController.list);

module.exports = router;
