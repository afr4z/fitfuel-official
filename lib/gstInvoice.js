import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

const A4 = [595.28, 841.89];
const MARGIN = 42;
const CONTENT_WIDTH = A4[0] - MARGIN * 2;

const ACCENT = rgb(0.12, 0.34, 0.22);
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.42, 0.42, 0.42);
const HAIRLINE = rgb(0.78, 0.78, 0.78);
const FILL = rgb(0.95, 0.96, 0.95);
const SAMPLE_RED = rgb(0.72, 0.12, 0.12);

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]}-${ONES[o]}` : TENS[t];
}

function threeDigits(n) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", rest ? twoDigits(rest) : ""]
    .filter(Boolean)
    .join(" ");
}

/** Indian numbering: crore / lakh / thousand. */
export function rupeesInWords(paise) {
  const rupees = Math.floor(paise / 100);
  const paisePart = paise % 100;

  if (rupees === 0 && paisePart === 0) return "Zero Rupees Only";

  const parts = [];
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const hundred = rupees % 1000;

  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));

  let words = parts.join(" ").replace(/\s+/g, " ").trim();
  words = words ? `${words} Rupees` : "";
  if (paisePart) {
    words = `${words}${words ? " and " : ""}${twoDigits(paisePart)} Paise`;
  }
  return `${words} Only`;
}

export function formatINR(paise) {
  return (paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Back-calculates taxable value and tax from a GST-inclusive amount.
 * All amounts are in paise.
 */
export function calculateGstBreakdown(
  amountPaise,
  gstRate = 5,
  interState = false,
) {
  const amount = Math.round(Number(amountPaise) || 0);
  const rate = Number(gstRate);
  const taxable = Math.round((amount * 100) / (100 + rate));
  const tax = amount - taxable;
  const cgst = interState ? 0 : Math.round(tax / 2);
  const sgst = interState ? 0 : tax - cgst;
  const igst = interState ? tax : 0;
  return { amount, rate, taxable, cgst, sgst, igst };
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

/**
 * pdf-lib's standard Helvetica fonts use WinAnsi encoding, which cannot
 * represent emoji. Plan titles and meal labels contain emoji, so strip
 * anything the font cannot encode before drawing. Keep the Latin-1 range and
 * the WinAnsi punctuation we intentionally use (dashes, quotes, bullets).
 */
function sanitizePdfText(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu,
      "",
    )
    .replace(
      /[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026]/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function fitText(text, font, size, maxWidth) {
  const value = sanitizePdfText(text);
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let out = value;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

function wrapLines(text, font, size, maxWidth, maxLines = 2) {
  const words = sanitizePdfText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(fitText(word, font, size, maxWidth));
      current = "";
    }
    if (lines.length === maxLines - 1) {
      const rest = [current, ...words.slice(i + 1)].filter(Boolean).join(" ");
      lines.push(fitText(rest, font, size, maxWidth));
      return lines;
    }
  }

  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

function right(page, text, xRight, y, font, size, color = INK) {
  const value = sanitizePdfText(text);
  const width = font.widthOfTextAtSize(value, size);
  page.drawText(value, { x: xRight - width, y, size, font, color });
}

function line(page, x1, y1, x2, y2, color = HAIRLINE, thickness = 0.7) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    color,
    thickness,
  });
}

/**
 * Builds a GST tax invoice PDF.
 *
 * Amounts are in paise. `unitAmount` is treated as GST-inclusive; the taxable
 * value and tax are back-calculated at `gstRate`.
 *
 * @param {object} params
 * @param {object} params.seller        – { legalName, addressLines, gstin, email, phone, pan, terms }
 * @param {object} params.buyer         – { name, phone, email, addressLines, gstin }
 * @param {object} params.invoice       – { number, date, placeOfSupply, orderRef, paymentRef, sample, paid }
 * @param {Array}  params.items         – [{ description, sac, quantity, unitAmount }]
 * @param {number} [params.gstRate]     – total GST %, default 5
 * @param {boolean}[params.interState]  – true → IGST, false → CGST + SGST
 * @returns {Promise<Uint8Array>}
 */
export async function buildGstInvoicePdf({
  seller,
  buyer,
  invoice,
  items,
  deliveryAmountPaise = 0,
  deliveryDescription = "Delivery charges",
  deliverySac = "",
  gstRate = 5,
  interState = false,
}) {
  if (!seller?.legalName || !seller?.gstin) {
    throw new Error(
      "buildGstInvoicePdf: seller.legalName and seller.gstin are required",
    );
  }
  if (!buyer?.name) {
    throw new Error("buildGstInvoicePdf: buyer.name is required");
  }
  if (!items?.length) {
    throw new Error("buildGstInvoicePdf: at least one line item is required");
  }

  seller = {
    ...seller,
    legalName: sanitizePdfText(seller.legalName),
    tradeName: sanitizePdfText(seller.tradeName),
    addressLines: (seller.addressLines || []).map(sanitizePdfText),
    gstin: sanitizePdfText(seller.gstin),
    email: sanitizePdfText(seller.email),
    phone: sanitizePdfText(seller.phone),
    pan: sanitizePdfText(seller.pan),
    terms: sanitizePdfText(seller.terms),
  };
  buyer = {
    ...buyer,
    name: sanitizePdfText(buyer.name),
    phone: sanitizePdfText(buyer.phone),
    email: sanitizePdfText(buyer.email),
    addressLines: (buyer.addressLines || []).map(sanitizePdfText),
    gstin: sanitizePdfText(buyer.gstin),
  };
  invoice = {
    ...invoice,
    number: sanitizePdfText(invoice.number),
    placeOfSupply: sanitizePdfText(invoice.placeOfSupply),
    orderRef: sanitizePdfText(invoice.orderRef),
    paymentRef: sanitizePdfText(invoice.paymentRef),
  };
  items = items.map((item) => ({
    ...item,
    description: sanitizePdfText(item.description),
    sac: sanitizePdfText(item.sac),
  }));
  deliveryDescription = sanitizePdfText(
    deliveryDescription || "Delivery charges",
  );
  deliverySac = sanitizePdfText(deliverySac);
  const deliveryPaise = Math.max(
    0,
    Math.round(Number(deliveryAmountPaise) || 0),
  );
  const delivery =
    deliveryPaise > 0
      ? {
          description: deliveryDescription,
          sac: deliverySac,
          quantity: 1,
          ...calculateGstBreakdown(deliveryPaise, gstRate, interState),
        }
      : null;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage(A4);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = A4[0];
  const x0 = MARGIN;
  const x1 = pageWidth - MARGIN;

  const gstLabel = `${Number(gstRate).toFixed(gstRate % 1 ? 2 : 0)}%`;
  const halfRate = (gstRate / 2).toFixed(2).replace(/\.?0+$/, "");

  // ── Header ──────────────────────────────────────────────────────────────
  page.drawText(seller.legalName, {
    x: x0,
    y: 795,
    size: 16,
    font: bold,
    color: ACCENT,
  });
  if (seller.tradeName && seller.tradeName !== seller.legalName) {
    page.drawText(seller.tradeName, {
      x: x0,
      y: 780,
      size: 8.5,
      font,
      color: MUTED,
    });
  }

  let sellerY =
    seller.tradeName && seller.tradeName !== seller.legalName ? 767 : 779;
  for (const addressLine of seller.addressLines || []) {
    page.drawText(addressLine, {
      x: x0,
      y: sellerY,
      size: 8.2,
      font,
      color: MUTED,
    });
    sellerY -= 11;
  }
  page.drawText(`GSTIN: ${seller.gstin}`, {
    x: x0,
    y: sellerY,
    size: 8.2,
    font: bold,
    color: INK,
  });
  sellerY -= 11;
  const contact = [seller.phone, seller.email].filter(Boolean).join("  ·  ");
  if (contact) {
    page.drawText(contact, {
      x: x0,
      y: sellerY,
      size: 8.2,
      font,
      color: MUTED,
    });
  }

  // The seller block grows with address lines. Keep the header rule below it
  // instead of using a fixed y that can cross the GSTIN/contact lines.
  const sellerBlockBottom = contact ? sellerY - 12 : sellerY + 3;

  right(page, "TAX INVOICE", x1, 795, bold, 18, ACCENT);
  right(page, "Original for Recipient", x1, 779, font, 8, MUTED);

  if (invoice.paid) {
    const badgeWidth = 54;
    const badgeHeight = 20;
    page.drawRectangle({
      x: x1 - badgeWidth,
      y: 746,
      width: badgeWidth,
      height: badgeHeight,
      color: ACCENT,
    });
    const badgeText = "PAID";
    const badgeTextWidth = bold.widthOfTextAtSize(badgeText, 10);
    page.drawText(badgeText, {
      x: x1 - badgeWidth + (badgeWidth - badgeTextWidth) / 2,
      y: 752,
      size: 10,
      font: bold,
      color: rgb(1, 1, 1),
    });
  }

  let y = Math.min(735, sellerBlockBottom);
  line(page, x0, y, x1, y, ACCENT, 1.2);

  // ── Invoice metadata ────────────────────────────────────────────────────
  y -= 16;
  const metaRows = [
    ["Invoice No.", invoice.number, "Order Ref.", invoice.orderRef || "—"],
    [
      "Invoice Date",
      formatDate(invoice.date),
      "Payment Ref.",
      invoice.paymentRef || "—",
    ],
    ["Place of Supply", invoice.placeOfSupply || "—", "Reverse Charge", "No"],
  ];
  for (const [labelL, valueL, labelR, valueR] of metaRows) {
    page.drawText(labelL, { x: x0, y, size: 7.5, font, color: MUTED });
    page.drawText(fitText(valueL, bold, 8.5, 190), {
      x: x0 + 74,
      y,
      size: 8.5,
      font: bold,
      color: INK,
    });
    page.drawText(labelR, { x: x0 + 285, y, size: 7.5, font, color: MUTED });
    page.drawText(fitText(valueR, font, 8.5, 150), {
      x: x0 + 360,
      y,
      size: 8.5,
      font,
      color: INK,
    });
    y -= 14;
  }

  // ── Bill to ─────────────────────────────────────────────────────────────
  y -= 6;
  const billToTop = y;
  page.drawText("BILL TO", { x: x0, y, size: 7.5, font: bold, color: MUTED });
  y -= 14;
  page.drawText(fitText(buyer.name, bold, 10, CONTENT_WIDTH), {
    x: x0,
    y,
    size: 10,
    font: bold,
    color: INK,
  });
  y -= 12;
  for (const addressLine of buyer.addressLines || []) {
    page.drawText(fitText(addressLine, font, 8.2, 300), {
      x: x0,
      y,
      size: 8.2,
      font,
      color: MUTED,
    });
    y -= 11;
  }
  const buyerContact = [buyer.phone, buyer.email].filter(Boolean).join("  ·  ");
  if (buyerContact) {
    page.drawText(fitText(buyerContact, font, 8.2, 300), {
      x: x0,
      y,
      size: 8.2,
      font,
      color: MUTED,
    });
    y -= 11;
  }
  if (buyer.gstin) {
    page.drawText(`GSTIN: ${buyer.gstin}`, {
      x: x0,
      y,
      size: 8.2,
      font: bold,
      color: INK,
    });
    y -= 11;
  }
  line(page, x0, billToTop + 8, x1, billToTop + 8, HAIRLINE, 0.5);

  // ── Line items ──────────────────────────────────────────────────────────
  const cols = [18, 160, 48, 28, 60, 68, 63, 64];
  const colX = [x0];
  for (let i = 0; i < cols.length; i++) colX.push(colX[i] + cols[i]);

  const computed = items.map((item) => {
    const quantity = Number(item.quantity) || 1;
    const lineTotal = Math.round(Number(item.unitAmount) * quantity);
    const tax = calculateGstBreakdown(lineTotal, gstRate, interState);
    return {
      ...item,
      quantity,
      lineTotal,
      taxable: tax.taxable,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
    };
  });

  const totals = computed.reduce(
    (acc, item) => ({
      quantity: acc.quantity + item.quantity,
      taxable: acc.taxable + item.taxable,
      cgst: acc.cgst + item.cgst,
      sgst: acc.sgst + item.sgst,
      igst: acc.igst + item.igst,
      total: acc.total + item.lineTotal,
    }),
    { quantity: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 },
  );

  if (delivery) {
    totals.quantity += delivery.quantity;
    totals.taxable += delivery.taxable;
    totals.cgst += delivery.cgst;
    totals.sgst += delivery.sgst;
    totals.igst += delivery.igst;
    totals.total += delivery.amount;
  }

  y -= 18;
  const tableTop = y;
  const headerHeight = 24;
  page.drawRectangle({
    x: x0,
    y: tableTop - headerHeight,
    width: CONTENT_WIDTH,
    height: headerHeight,
    color: FILL,
  });
  const headerY = tableTop - 15;
  const headers = [
    "#",
    "Description",
    "SAC",
    "Qty",
    "Rate",
    "Taxable",
    interState ? "IGST" : "CGST",
    interState ? "" : "SGST",
  ];
  headers.forEach((header, i) => {
    if (!header) return;
    const label =
      i === 6 || i === 7
        ? `${header} @ ${interState ? gstLabel : `${halfRate}%`}`
        : header;
    if (i === 0 || i === 1 || i === 2) {
      page.drawText(label, {
        x: colX[i] + 4,
        y: headerY,
        size: 7.2,
        font: bold,
        color: INK,
      });
    } else {
      right(page, label, colX[i + 1] - 4, headerY, bold, 7.2, INK);
    }
  });
  y = tableTop - headerHeight;

  computed.forEach((item, index) => {
    const descriptionLines = wrapLines(
      item.description,
      font,
      8.5,
      cols[1] - 8,
      2,
    );
    const rowHeight = descriptionLines.length > 1 ? 34 : 26;
    const rowBottom = y - rowHeight;
    page.drawRectangle({
      x: x0,
      y: rowBottom,
      width: CONTENT_WIDTH,
      height: rowHeight,
      borderColor: HAIRLINE,
      borderWidth: 0.5,
    });

    const textY = rowBottom + rowHeight / 2 - 3;
    page.drawText(String(index + 1), {
      x: colX[0] + 4,
      y: textY,
      size: 8,
      font,
      color: MUTED,
    });
    const descriptionTop = rowBottom + (descriptionLines.length > 1 ? 23 : 17);
    descriptionLines.forEach((descriptionLine, lineIndex) => {
      page.drawText(descriptionLine, {
        x: colX[1] + 4,
        y: descriptionTop - lineIndex * 10,
        size: 8.5,
        font,
        color: INK,
      });
    });
    page.drawText(item.sac || "—", {
      x: colX[2] + 4,
      y: textY,
      size: 8,
      font,
      color: MUTED,
    });
    right(page, String(item.quantity), colX[4] - 4, textY, font, 8, INK);
    right(
      page,
      formatINR(Math.round(item.taxable / item.quantity)),
      colX[5] - 4,
      textY,
      font,
      8,
      INK,
    );
    right(page, formatINR(item.taxable), colX[6] - 4, textY, font, 8, INK);
    right(
      page,
      formatINR(item.cgst || item.igst),
      colX[7] - 4,
      textY,
      font,
      8,
      INK,
    );
    if (!interState) {
      right(page, formatINR(item.sgst), colX[8] - 4, textY, font, 8, INK);
    }
    y = rowBottom;
  });

  // Delivery is shown below the numbered items, not as a numbered line item.
  // Render it identically to an item row (same Y metrics) so columns align.
  if (delivery) {
    const descriptionLines = wrapLines(
      delivery.description,
      font,
      8.5,
      cols[1] - 8,
      2,
    );
    const rowHeight = descriptionLines.length > 1 ? 34 : 26;
    const rowBottom = y - rowHeight;
    page.drawRectangle({
      x: x0,
      y: rowBottom,
      width: CONTENT_WIDTH,
      height: rowHeight,
      color: FILL,
      borderColor: HAIRLINE,
      borderWidth: 0.5,
    });

    const textY = rowBottom + rowHeight / 2 - 3;
    // Empty row-number cell (no index for delivery)
    // Center description vertically same as numeric columns (textY)
    const descriptionY = descriptionLines.length > 1
      ? rowBottom + (descriptionLines.length > 1 ? 23 : 17)
      : textY;
    descriptionLines.forEach((descriptionLine, lineIndex) => {
      page.drawText(descriptionLine, {
        x: colX[1] + 4,
        y: descriptionY - lineIndex * 10,
        size: 8.5,
        font: bold,
        color: INK,
      });
    });
    page.drawText(delivery.sac || "—", {
      x: colX[2] + 4,
      y: textY,
      size: 8,
      font,
      color: MUTED,
    });
    right(page, String(delivery.quantity), colX[4] - 4, textY, font, 8, INK);
    right(
      page,
      formatINR(Math.round(delivery.taxable / delivery.quantity)),
      colX[5] - 4,
      textY,
      font,
      8,
      INK,
    );
    right(page, formatINR(delivery.taxable), colX[6] - 4, textY, font, 8, INK);
    right(
      page,
      formatINR(delivery.cgst || delivery.igst),
      colX[7] - 4,
      textY,
      font,
      8,
      INK,
    );
    if (!interState) {
      right(page, formatINR(delivery.sgst), colX[8] - 4, textY, font, 8, INK);
    }
    y = rowBottom;
  }

  // ── Totals ──────────────────────────────────────────────────────────────
  y -= 14;
  const totalsWidth = 245;
  const totalsX = x1 - totalsWidth;
  const totalRows = [
    ["Taxable Value", formatINR(totals.taxable)],
    interState
      ? [`IGST @ ${gstLabel}`, formatINR(totals.igst)]
      : [`CGST @ ${halfRate}%`, formatINR(totals.cgst)],
    ...(interState ? [] : [[`SGST @ ${halfRate}%`, formatINR(totals.sgst)]]),
    ["Total", formatINR(totals.total)],
    ["Amount Paid", formatINR(totals.total)],
    ["Balance Due", formatINR(0)],
  ];

  totalRows.forEach(([label, value], index) => {
    if (index === 3) {
      page.drawRectangle({
        x: totalsX,
        y: y - 4,
        width: totalsWidth,
        height: 17,
        color: FILL,
      });
    }
    page.drawText(label, {
      x: totalsX + 8,
      y,
      size: index === 3 ? 9 : 8.2,
      font: index === 3 ? bold : font,
      color: index === 3 ? INK : MUTED,
    });
    right(
      page,
      value,
      x1 - 8,
      y,
      index === 3 ? bold : font,
      index === 3 ? 9 : 8.2,
      INK,
    );
    y -= 16;
  });

  // ── Amount in words ─────────────────────────────────────────────────────
  y -= 6;
  page.drawText("Amount in words", { x: x0, y, size: 7.5, font, color: MUTED });
  y -= 12;
  page.drawText(
    fitText(rupeesInWords(totals.total), bold, 8.5, CONTENT_WIDTH - 10),
    {
      x: x0,
      y,
      size: 8.5,
      font: bold,
      color: INK,
    },
  );

  // ── Footer ──────────────────────────────────────────────────────────────
  const footerY = 118;
  line(page, x0, footerY + 26, x1, footerY + 26, HAIRLINE, 0.5);
  page.drawText("Declaration", {
    x: x0,
    y: footerY + 14,
    size: 7.5,
    font: bold,
    color: MUTED,
  });
  page.drawText(
    fitText(
      seller.terms ||
        "We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.",
      font,
      7.2,
      CONTENT_WIDTH - 180,
    ),
    { x: x0, y: footerY + 4, size: 7.2, font, color: MUTED },
  );
  page.drawText("This is a computer-generated invoice.", {
    x: x0,
    y: footerY - 8,
    size: 7.2,
    font,
    color: MUTED,
  });

  right(page, `For ${seller.legalName}`, x1, footerY + 14, bold, 8.5, INK);
  line(page, x1 - 130, footerY - 4, x1, footerY - 4, HAIRLINE, 0.5);
  right(page, "Authorised Signatory", x1, footerY - 15, font, 7.5, MUTED);

  // ── Sample watermark ────────────────────────────────────────────────────
  if (invoice.sample) {
    page.drawText("SAMPLE", {
      x: 150,
      y: 360,
      size: 120,
      font: bold,
      color: SAMPLE_RED,
      opacity: 0.12,
      rotate: degrees(35),
    });
    page.drawText("NOT A VALID TAX INVOICE", {
      x: x0,
      y: footerY - 24,
      size: 8,
      font: bold,
      color: SAMPLE_RED,
    });
  }

  return pdf.save();
}
