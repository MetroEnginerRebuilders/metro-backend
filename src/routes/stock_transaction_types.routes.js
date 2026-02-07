const express = require('express');
const router = express.Router();
const stockTransactionTypesController = require('../controller/stock_transaction_types.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// All routes are protected with JWT authentication
router.get('/stock-transaction-types', verifyToken, stockTransactionTypesController.getAll);
router.get('/stock-transaction-types/:id', verifyToken, stockTransactionTypesController.getById);

module.exports = router;
