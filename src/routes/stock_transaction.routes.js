const express = require('express');
const router = express.Router();
const stockTransactionController = require('../controller/stock_transaction.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// All routes are protected with JWT authentication
router.post('/stock-transaction', verifyToken, stockTransactionController.create);
router.post('/stock-transaction/payment', verifyToken, stockTransactionController.payStockTransaction);
router.delete('/stock-transaction/payment/:stockPaymentId', verifyToken, stockTransactionController.deleteStockPayment);
router.get('/stock-transaction/payment/:stockTransactionId', verifyToken, stockTransactionController.listPaymentsByStockTransactionId);
router.post('/stock-transaction/credit-balance', verifyToken, stockTransactionController.getShopCreditBalance);
router.put('/stock-transaction/:stockTransactionId', verifyToken, stockTransactionController.update);
router.get('/stock-transaction/list', verifyToken, stockTransactionController.getStockList);
router.get('/stock-transaction/purchase-list', verifyToken, stockTransactionController.getPurchaseStockList);
router.get('/stock-transaction/return-list', verifyToken, stockTransactionController.getReturnStockList);
router.get('/stock-transaction/companies', verifyToken, stockTransactionController.getCompanies);
router.post('/stock-transaction/availability', verifyToken, stockTransactionController.getStockAvailabilityDetails);
router.get('/stock-transaction/details/:stockTransactionId', verifyToken, stockTransactionController.getDetailsByTransactionId);
router.get('/stock-transaction/return-details/:stockTransactionId', verifyToken, stockTransactionController.getReturnDetailsByTransactionId);
router.get('/stock-transaction/company/:companyId/models', verifyToken, stockTransactionController.getModelsByCompany);
router.get('/stock-transaction/model/:modelId/spares', verifyToken, stockTransactionController.getSparesByModel);
router.get('/stock-transaction', verifyToken, stockTransactionController.getAll);
router.get('/stock-transaction/:id', verifyToken, stockTransactionController.getById);
router.delete('/stock-transaction-item/:itemId', verifyToken, stockTransactionController.deleteItem);

module.exports = router;
