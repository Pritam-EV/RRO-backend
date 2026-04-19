 
require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/config/db");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 RRO Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
  });
};

startServer();