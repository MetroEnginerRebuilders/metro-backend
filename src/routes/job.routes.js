const express = require("express");
const router = express.Router();
const jobController = require("../controller/job.controller");

// Job routes
router.post("/job", jobController.create);
router.get("/job", jobController.list);
router.get("/job/:jobId", jobController.getById);
router.put("/job/:jobId", jobController.edit);
router.delete("/job/:jobId", jobController.delete);

module.exports = router;
