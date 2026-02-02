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

const app = express();

// CORS middleware
app.use(cors());

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

app.get("/", async (req, res) => {
  const result = await pool.query("SELECT current_database()");
  res.json({
    message: "Metro Backend Running 🚀",
    database: result.rows[0].current_database,
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
