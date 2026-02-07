const stockTransactionTypesRepository = require('../repository/stock_transaction_types.repository');

const stockTransactionTypesController = {
  // Get all stock transaction types
  getAll: async (req, res) => {
    try {
      const stockTypes = await stockTransactionTypesRepository.findAll();

      res.status(200).json({
        success: true,
        message: 'Stock transaction types retrieved successfully',
        data: stockTypes
      });
    } catch (error) {
      console.error('Error fetching stock transaction types:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch stock transaction types',
        error: error.message
      });
    }
  },

  // Get stock transaction type by ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const stockType = await stockTransactionTypesRepository.findById(id);

      if (!stockType) {
        return res.status(404).json({
          success: false,
          message: 'Stock transaction type not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Stock transaction type retrieved successfully',
        data: stockType
      });
    } catch (error) {
      console.error('Error fetching stock transaction type:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch stock transaction type',
        error: error.message
      });
    }
  }
};

module.exports = stockTransactionTypesController;
