module.exports = {
  OTP_EXPIRY_MINUTES: 5,
  OTP_LENGTH: 6,
  JWT_EXPIRES_IN: "7d",
  REFERRAL_REWARD_AMOUNT: 50,
  MIN_TOPUP_AMOUNT: 10,
  MAX_TOPUP_AMOUNT: 10000,

  // Zoho Payments
  ZOHO_PAYMENTS_BASE_URL: "https://payments.zoho.in/api/v1",
  ZOHO_OAUTH_BASE_URL: "https://accounts.zoho.in/oauth/v2/token",

  // RO Device
  VALVE_ON: "ON",
  VALVE_OFF: "OFF",
  MAX_DAILY_WATER_LIMIT_LITRES: 20,       // Safety cap per device per day
};