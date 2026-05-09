// src/mqtt/mqttClient.js
const mqtt   = require("mqtt");
const WaterLog = require("../models/WaterLog.model");
const Device   = require("../models/Device.model");

const BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://broker.hivemq.com";
const TOPIC_TELEMETRY = "rro/device/+/telemetry";  // + = any deviceId

let client;

function connectMQTT() {
  client = mqtt.connect(BROKER_URL, {
    clientId: `rro-backend-${Date.now()}`,
    username: process.env.MQTT_USERNAME || "",
    password: process.env.MQTT_PASSWORD || "",
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  });

  client.on("connect", () => {
    console.log("✅ MQTT connected to", BROKER_URL);
    client.subscribe(TOPIC_TELEMETRY, { qos: 1 }, (err) => {
      if (err) console.error("MQTT subscribe error:", err.message);
      else console.log("📡 Subscribed to:", TOPIC_TELEMETRY);
    });
  });

  client.on("message", async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      await handleTelemetry(payload);
    } catch (e) {
      console.error("MQTT message parse error:", e.message, "| raw:", message.toString());
    }
  });

  client.on("error",       (e) => console.error("MQTT error:", e.message));
  client.on("reconnect",   ()  => console.log("🔄 MQTT reconnecting..."));
  client.on("offline",     ()  => console.warn("⚠️  MQTT offline"));
}

// ── Core handler — called for every device telemetry message ──
async function handleTelemetry(payload) {
  const {
    deviceId,         // "RRO001"
    totalMlToday,     // number (ml)
    valveStatus,      // "ON" | "OFF"
    status,           // "active" | "inactive"
    lastActive,       // ISO string
  } = payload;

  if (!deviceId || totalMlToday === undefined) {
    console.warn("MQTT: incomplete payload", payload);
    return;
  }

  const devIdUpper = deviceId.toUpperCase();

  // ── 1. Find the device document ──────────────────────
  const device = await Device.findOne({ deviceId: devIdUpper });
  if (!device) {
    console.warn(`MQTT: unknown device ${devIdUpper} — ignoring`);
    return;
  }

  const now       = new Date();
  const dateStr   = now.toISOString().split("T")[0]; // "2026-05-10"
  const litres    = parseFloat((totalMlToday / 1000).toFixed(3));
  const valveSafe = ["ON", "OFF"].includes(valveStatus) ? valveStatus : "ON";
  const statSafe  = ["active", "inactive"].includes(status) ? status : "active";

  // ── 2. Upsert daily WaterLog (one row per device per day) ──
  // findOneAndUpdate + upsert = safe for concurrent MQTT pushes
  const userId = device.userIds?.[0] || null;  // primary user

  await WaterLog.findOneAndUpdate(
    { deviceStringId: devIdUpper, date: dateStr },
    {
      $set: {
        deviceId:         device._id,
        deviceStringId:   devIdUpper,
        userId,
        date:             dateStr,
        totalMlToday,
        totalLitresToday: litres,
        valveStatus:      valveSafe,
        deviceStatus:     statSafe,
        lastActiveAt:     lastActive ? new Date(lastActive) : now,
        source:           "mqtt",
      },
    },
    { upsert: true, new: true }
  );

  // ── 3. Update Device live state ───────────────────────
  await Device.findByIdAndUpdate(device._id, {
    $set: {
      isOnline:     true,
      lastSeenAt:   now,
      lastMqttAt:   now,
      valveStatus:  valveSafe,
      totalMlToday,
      status:       statSafe === "active" ? "active" : "inactive",
    },
  });

  console.log(`📊 [${devIdUpper}] ${dateStr} → ${litres}L | valve: ${valveSafe} | status: ${statSafe}`);
}

// ── Publish valve command to device ────────────────────────
// Called from waterLog.controller.js → controlValve()
function publishValveCommand(deviceId, value) {
  if (!client || !client.connected) {
    console.error("MQTT not connected — cannot send valve command");
    return false;
  }
  const topic   = `rro/device/${deviceId.toUpperCase()}/command`;
  const payload = JSON.stringify({ valve: value, ts: Date.now() });
  client.publish(topic, payload, { qos: 1 });
  console.log(`🚿 Valve command sent → ${topic}:`, payload);
  return true;
}

// ── Mark devices offline if no MQTT in 5 min ───────────────
async function checkDeviceHeartbeats() {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
  const result = await Device.updateMany(
    { isOnline: true, lastMqttAt: { $lt: cutoff } },
    { $set: { isOnline: false } }
  );
  if (result.modifiedCount > 0) {
    console.log(`💤 Marked ${result.modifiedCount} device(s) offline`);
  }
}

module.exports = { connectMQTT, publishValveCommand, checkDeviceHeartbeats };