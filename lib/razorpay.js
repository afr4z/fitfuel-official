const BASE_URL = "https://api.razorpay.com/v1";

function authHeader() {
  const credentials = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");
  return `Basic ${credentials}`;
}

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
  // Razorpay's database uses utf8mb3 which cannot store 4-byte characters
  // (emoji). Strip surrogate pairs (code points > U+FFFF) before sending.
  const sanitizedDescription = description
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
    .trim();

  const res = await fetch(`${BASE_URL}/payment_links`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amount * 100, // paise
      currency: "INR",
      description: sanitizedDescription,
      customer: { contact: `+${phone}` },
      notify: { sms: false, email: false },
      reference_id: referenceId,
      callback_url: `${process.env.APP_URL}/payment-success`,
      callback_method: "get",
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Razorpay error: ${JSON.stringify(err)}`);
  }

  return res.json();
}

/**
 * Creates a Razorpay Invoice and returns the full API response.
 *
 * The invoice is created already `issued` (payable) unless `draft` is true.
 * Share `short_url` with the customer to collect payment.
 *
 * NOTE: Razorpay's Invoices API only supports non-GST invoices. Tax rates,
 * HSN/SAC codes and cess cannot be set via the API.
 *
 * @param {object} params
 * @param {number}  params.amount           – amount in ₹ (converted to paise internally)
 * @param {string}  params.description      – invoice + line-item description
 * @param {string}  params.phone            – customer phone (e.g. "919876543210")
 * @param {string}  params.name             – customer name (3–50 characters)
 * @param {string} [params.email]           – customer email
 * @param {string} [params.referenceId]     – internal ID stored in `notes`
 * @param {number} [params.expireInMinutes] – default 60; Razorpay requires ≥ 15
 * @param {boolean} [params.draft]          – create in draft state (must be issued later)
 * @param {object} [params.notes]           – extra notes (values must be strings)
 * @returns {Promise<{ id: string, short_url: string, status: string, amount: number }>}
 */
export async function createInvoice({
  amount,
  description,
  phone,
  name,
  email,
  referenceId,
  expireInMinutes = 60,
  draft = false,
  notes = {},
}) {
  if (!Number.isFinite(amount)) {
    throw new Error("createInvoice: amount must be a number");
  }
  if (amount < 1) {
    throw new Error("createInvoice: amount must be at least ₹1");
  }
  if (!name || name.trim().length < 3 || name.trim().length > 50) {
    throw new Error("createInvoice: name must be 3–50 characters");
  }
  if (!Number.isFinite(expireInMinutes) || expireInMinutes < 15) {
    throw new Error("createInvoice: expireInMinutes must be at least 15");
  }

  // Razorpay's database uses utf8mb3 which cannot store 4-byte characters
  // (emoji). Strip surrogate pairs (code points > U+FFFF) before sending.
  const sanitizedDescription = description
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
    .trim();

  const body = {
    type: "invoice",
    description: sanitizedDescription,
    currency: "INR",
    customer: {
      name: name.trim(),
      contact: `+${phone}`,
      ...(email ? { email } : {}),
    },
    line_items: [
      {
        name: sanitizedDescription,
        amount: Math.round(amount * 100), // paise, must be an integer
        currency: "INR",
        quantity: 1,
      },
    ],
    expire_by: Math.floor(Date.now() / 1000) + expireInMinutes * 60,
    sms_notify: false,
    email_notify: false,
    notes: {
      ...(referenceId ? { reference_id: String(referenceId) } : {}),
      phone: String(phone),
      ...notes,
    },
  };

  if (draft) body.draft = 1;

  const res = await fetch(`${BASE_URL}/invoices`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Razorpay invoice error: ${JSON.stringify(err)}`);
  }

  return res.json();
}

/**
 * Fetches a payment by id.
 *
 * @param {string} paymentId – e.g. "pay_xxx"
 * @returns {Promise<object>}
 */
export async function getPayment(paymentId) {
  const res = await fetch(`${BASE_URL}/payments/${paymentId}`, {
    headers: { Authorization: authHeader() },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Razorpay payment error: ${JSON.stringify(err)}`);
  }

  return res.json();
}
