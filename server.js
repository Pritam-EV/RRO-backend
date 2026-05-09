// server.js
require("dotenv").config();
const app       = require("./src/app");
const connectDB = require("./src/config/db");
const { connectMQTT, checkDeviceHeartbeats } = require("./src/mqtt/mqttClient"); // ✅ correct path

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`🚀 RRO Backend running on port ${PORT} [${process.env.NODE_ENV}]`);
  });

  connectMQTT();
  setInterval(checkDeviceHeartbeats, 60 * 1000);
};

start();