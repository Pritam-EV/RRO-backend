require("dotenv").config();
const app = require("./src/app");             // ✅ correct — server.js is at root
const connectDB = require("./src/config/db");

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 RRO Backend running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
};

start();