const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config(); // MUST be first

const pool = require("./config/database");
const userRoutes = require("./routes/user.routes");
const workRoutes = require("./routes/work.routes");
const shopRoutes = require("./routes/shop.routes");
const spareRoutes = require("./routes/spare.routes");
const customerRoutes = require("./routes/customer.routes");
const modelRoutes = require("./routes/model.routes");
const bankAccountRoutes = require("./routes/bank_account.routes");
const staffRoutes = require("./routes/staff.routes");
const staffSalaryRoutes = require("./routes/staff_salary.routes");
const salaryTypeRoutes = require("./routes/salary_type.routes");
const financeTypesRoutes = require("./routes/finance_types.routes");
const financeCategoriesRoutes = require("./routes/finance_categories.routes");
const companyRoutes = require("./routes/company.routes");
const financeRoutes = require("./routes/finance.routes");
const incomeRoutes = require("./routes/income.routes");
const expenseRoutes = require("./routes/expense.routes");
const stockTransactionRoutes = require("./routes/stock_transaction.routes");
const stockTransactionTypesRoutes = require("./routes/stock_transaction_types.routes");
const jobRoutes = require("./routes/job.routes");
const invoiceRoutes = require("./routes/invoice.routes");
const itemTypeRoutes = require("./routes/item_type.routes");
const dailyTransactionRoutes = require("./routes/daily_transaction.routes");
const statementRoutes = require("./routes/statement.routes");

const app = express();

// Read CORS env vars (used later in startup logging)
const rawOrigins = process.env.CORS_ORIGIN || "";
const allowedOrigins = rawOrigins.split(",").map((s) => s.trim()).filter(Boolean);
const allowAll = process.env.CORS_ALLOW_ALL === "true";
const allowCredentials = process.env.CORS_ALLOW_CREDENTIALS === "true";

// CORS middleware
app.use(cors(
  origin=true
));

app.use(express.json());

// Routes
app.use("/", userRoutes);
app.use("/", workRoutes);
app.use("/", shopRoutes);
app.use("/", spareRoutes);
app.use("/", customerRoutes);
app.use("/", modelRoutes);
app.use("/", bankAccountRoutes);
app.use("/", staffRoutes);
app.use("/", staffSalaryRoutes);
app.use("/", salaryTypeRoutes);
app.use("/", financeTypesRoutes);
app.use("/", financeCategoriesRoutes);
app.use("/", companyRoutes);
app.use("/", financeRoutes);
app.use("/", incomeRoutes);
app.use("/", expenseRoutes);
app.use("/", stockTransactionRoutes);
app.use("/", stockTransactionTypesRoutes);
app.use("/", jobRoutes);
app.use("/", invoiceRoutes);
app.use("/", itemTypeRoutes);
app.use("/", dailyTransactionRoutes);
app.use("/", statementRoutes);

app.get("/", async (req, res) => {
  const result = await pool.query("SELECT current_database()");
  res.json({
    message: "Metro Backend Running 🚀",
    database: result.rows[0].current_database,
  });
});

const PORT = process.env.PORT || 5000;
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_NAME = process.env.DB_NAME || "postgres";
const DB_USER = process.env.DB_USER || "postgres";
app.listen(PORT, async () => {
  // On startup, try a lightweight query to ensure DB is reachable and log the database name.
  try {
    const result = await pool.query("SELECT current_database()");
    const dbName = result.rows && result.rows[0] && result.rows[0].current_database;
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📦 Connected to database: ${dbName}`);
    // Log active CORS policy for clarity
    if (allowAll) {
      console.log("🌐 CORS: allowing all origins (CORS_ALLOW_ALL=true)");
    } else if (allowedOrigins.length > 0) {
      console.log(`🌐 CORS: allowed origins = ${allowedOrigins.join(",")}`);
    } else {
      console.log("🌐 CORS: allowing all origins (no CORS_ORIGIN set)");
    }
  } catch (err) {
      console.log(`✅ Server running on port ${PORT}`);
      console.log("dbname ",DB_NAME)
      console.log("DB_HOST ",DB_HOST)
      console.log("DB_USER ",DB_USER)

    console.error(`❌ Failed to verify database connection on startup:`, err.message || err);
    console.log(`✅ Server running on port ${PORT}`);
  }
});
