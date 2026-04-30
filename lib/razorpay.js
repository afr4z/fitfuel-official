const BASE_URL = "https://api.razorpay.com/v1";

/**
 * Creates a Razorpay Payment Link and returns the full API response.
 *
 * @param {object} params
 * @param {number}  params.amount       – amount in ₹ (converted to paise internally)
 * @param {string}  params.description  – shown on the payment page
 * @param {string}  params.phone        – customer's phone number (e.g. "919876543210")
 * @param {string}  params.referenceId  – your internal ID stored on the link for webhook lookup
 * @returns {Promise<{ id: string, short_url: string }>}
 */
export async function createPaymentLink({
  amount,
  description,
  phone,
  referenceId,
}) {
  const credentials = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");

  // Razorpay's database uses utf8mb3 which cannot store 4-byte characters
  // (emoji). Strip surrogate pairs (code points > U+FFFF) before sending.
  const sanitizedDescription = description
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
    .trim();

  const res = await fetch(`${BASE_URL}/payment_links`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amount * 100, // paise
      currency: "INR",
      description: sanitizedDescription,
      customer: { contact: `+${phone}` },
      notify: { sms: false, email: false },
      reference_id: referenceId,
      callback_url: `${process.env.APP_URL}/payment-success.html`,
      callback_method: "get",
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Razorpay error: ${JSON.stringify(err)}`);
  }

  return res.json();
}
