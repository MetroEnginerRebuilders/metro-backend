const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userRepository = require("../repository/user.repository");

class UserController {
  // Login user
  async login(req, res) {
    try {
      const { username, password } = req.body;

      // Validate input
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: "Username and password are required",
        });
      }

      // Find user by username
      const user = await userRepository.findByUsername(username);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid Username or Password",
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid Username or Password",
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
      );

      // Return success response
      res.json({
        success: true,
        message: "Login successful",
        data: {
          token,
          id: user.id,
          username: user.username,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Change password
  async changePassword(req, res) {
    try {
      const { username, oldPassword, newPassword } = req.body;

      // Validate input
      if (!username || !oldPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Username, old password and new password are required",
        });
      }

      // Validate new password length
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 6 characters long",
        });
      }

      // Find user by username
      const user = await userRepository.findByUsername(username);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Verify old password
      const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);

      if (!isOldPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Old password is incorrect",
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await userRepository.updatePassword(user.id, hashedPassword);

      // Return success response
      res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Register new admin/user
  async register(req, res) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ success: false, message: "Username and password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
      }
      // Check if user exists
      const existing = await userRepository.findByUsername(username);
      if (existing) {
        return res.status(409).json({ success: false, message: "Username already exists" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await userRepository.createUser(username, hashedPassword);
      return res.status(201).json({ success: true, message: "User created", data: user });
    } catch (err) {
      console.error("Register error:", err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

}

module.exports = new UserController();
