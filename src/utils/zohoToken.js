const axios = require("axios");
const { ZOHO_OAUTH_BASE_URL } = require("../config/constants");

let cachedToken = null;
let tokenExpiresAt = null;

/**
 * Returns a valid Zoho OAuth access token.
 * Automatically refreshes when expired.
 */
const getZohoAccessToken = async () => {
  const now = Date.now();

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && tokenExpiresAt && now < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  try {
    const params = new URLSearchParams({
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: "refresh_token",
    });

    const res = await axios.post(ZOHO_OAUTH_BASE_URL, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (!res.data.access_token) {
      throw new Error("Zoho token refresh failed: " + JSON.stringify(res.data));
    }

    cachedToken = res.data.access_token;
    // Zoho tokens expire in 3600s; store expiry time
    tokenExpiresAt = now + (res.data.expires_in || 3600) * 1000;

    console.log("✅ Zoho OAuth token refreshed");
    return cachedToken;
  } catch (err) {
    console.error("❌ Zoho token error:", err.message);
    throw new Error("Could not get Zoho access token");
  }
};

module.exports = { getZohoAccessToken };