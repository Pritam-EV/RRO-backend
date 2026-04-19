module.exports = {
  OTP_EXPIRY_MINUTES: 5,
  OTP_LENGTH: 6,
  JWT_EXPIRES_IN: "7d",
  REFERRAL_REWARD_AMOUNT: 0,              // No wallet — referral is tracking only

  // Zoho Payments
  ZOHO_PAYMENTS_BASE_URL: "https://payments.zoho.in/api/v1",
  ZOHO_OAUTH_BASE_URL: "https://accounts.zoho.in/oauth/v2/token",

  // RO Device
  VALVE_ON: "ON",
  VALVE_OFF: "OFF",
  MAX_DAILY_WATER_LIMIT_LITRES: 20,       // Fallback if plan has no dailyLimitLitres
};