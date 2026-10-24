const REQUIRED_VARS = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_VERIFY_TOKEN",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "CRON_SECRET",
  // Petpooja env vars - have production defaults in lib/petpooja.js
];

export function validateEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[ENV] Missing required environment variables: ${missing.join(", ")}`);
    console.error(`[ENV] The application may not function correctly.`);
    return false;
  }
  return true;
}
