const express = require('express');
const router = express.Router();
const stockTransactionController = require('../controller/stock_transaction.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// All routes are protected with JWT authentication
router.post('/stock-transaction', verifyToken, stockTransactionController.create);
router.get('/stock-transaction/list', verifyToken, stockTransactionController.getStockList);
router.get('/stock-transaction/companies', verifyToken, stockTransactionController.getCompanies);
router.get('/stock-transaction/company/:companyId/models', verifyToken, stockTransactionController.getModelsByCompany);
router.get('/stock-transaction/model/:modelId/spares', verifyToken, stockTransactionController.getSparesByModel);
router.get('/stock-transaction', verifyToken, stockTransactionController.getAll);
router.get('/stock-transaction/:id', verifyToken, stockTransactionController.getById);
router.delete('/stock-transaction-item/:itemId', verifyToken, stockTransactionController.deleteItem);

module.exports = router;
