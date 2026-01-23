const modelRepository = require("../repository/model.repository");

class ModelController {
  // Create new model
  async create(req, res) {
    try {
      const { modelName } = req.body;

      // Validate input
      if (!modelName || modelName.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Model name is required",
        });
      }

      // Check if model name already exists
      const existingModel = await modelRepository.findByName(modelName.trim());
      if (existingModel) {
        return res.status(409).json({
          success: false,
          message: "Model name already exists",
        });
      }

      // Create model
      const model = await modelRepository.create({
        modelName: modelName.trim()
      });

      res.status(201).json({
        success: true,
        message: "Model created successfully",
        data: model,
      });
    } catch (error) {
      console.error("Create model error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }

  // Get all models with pagination and search
  async list(req, res) {
    try {
      const { search, page = 1 } = req.query;
      const limit = 10;
      const pageNum = parseInt(page);
      
      if (pageNum < 1) {
        return res.status(400).json({
          success: false,
          message: "Page number must be greater than 0",
        });
      }
      
      const result = await modelRepository.findAll(search, pageNum, limit);
      const totalPages = Math.ceil(result.total / limit);

      res.json({
        success: true,
        data: result.data,
        pagination: {
          currentPage: pageNum,
          totalPages: totalPages,
          totalItems: result.total,
          itemsPerPage: limit,
          hasNextPage: pageNum < totalPages,
          hasPreviousPage: pageNum > 1
        }
      });
    } catch (error) {
      console.error("List models error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Update model
  async update(req, res) {
    try {
      const { modelId } = req.params;
      const { modelName } = req.body;

      // Validate input
      if (!modelName || modelName.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Model name is required",
        });
      }

      // Check if model exists
      const existingModel = await modelRepository.findById(modelId);
      if (!existingModel) {
        return res.status(404).json({
          success: false,
          message: "Model not found",
        });
      }

      // Check if new model name already exists (excluding current model)
      const duplicateModel = await modelRepository.findByName(modelName.trim());
      if (duplicateModel && duplicateModel.model_id !== modelId) {
        return res.status(409).json({
          success: false,
          message: "Model name already exists",
        });
      }

      // Update model
      const updatedModel = await modelRepository.update(modelId, {
        modelName: modelName.trim()
      });

      res.json({
        success: true,
        message: "Model updated successfully",
        data: updatedModel,
      });
    } catch (error) {
      console.error("Update model error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Delete model
  async delete(req, res) {
    try {
      const { modelId } = req.params;

      // Check if model exists
      const existingModel = await modelRepository.findById(modelId);
      if (!existingModel) {
        return res.status(404).json({
          success: false,
          message: "Model not found",
        });
      }

      // Delete model
      await modelRepository.delete(modelId);

      res.json({
        success: true,
        message: "Model deleted successfully",
      });
    } catch (error) {
      console.error("Delete model error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new ModelController();
