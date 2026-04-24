/** @jest-environment node */
import { vi, describe, test, expect, beforeEach } from "vitest";
vi.mock(
  "../lib/whatsapp.js",
  async () => await import("./mocks/whatsapp.mock.js"),
);
vi.mock(
  "../bot/session.js",
  async () => await import("./mocks/session.mock.js"),
);
vi.mock(
  "@supabase/supabase-js",
  async () => await import("./mocks/supabase.mock.js"),
);
vi.mock(
  "../lib/petpooja.js",
  async () => await import("./mocks/petpooja.mock.js"),
);
vi.mock(
  "../lib/razorpay.js",
  async () => await import("./mocks/razorpay.mock.js"),
);
// Import mocks and handler after mocking
const { sentMessages, resetMocks } = await import("./mocks/whatsapp.mock.js");
const { resetSessions, peekSession } = await import("./mocks/session.mock.js");
const { resetDB, seedOrder, getOrder, getSubscription } = await import(
  "./mocks/supabase.mock.js"
);
const { createdLinks, resetRazorpay } = await import("./mocks/razorpay.mock.js");
const { handleIncoming } = await import("../bot/handler.js");
const { makeTextMessage, makeButtonReply, makeListReply, makeLocationMessage } =
  await import("./helpers/simulate.js");

const PHONE = "919876543210";

beforeEach(() => {
  resetMocks();
  resetSessions();
  resetDB();
  resetRazorpay();
});

// ─── Greeting ────────────────────────────────────────────────────────────────

describe("Greeting", () => {
  test("new user gets main menu", async () => {
    await handleIncoming(PHONE, makeTextMessage(PHONE, "hi"));

    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].type).toBe("buttons");
    expect(sentMessages[0].body).toContain("Welcome");
  });

  test("session state set to MAIN_MENU after greeting", async () => {
    await handleIncoming(PHONE, makeTextMessage(PHONE, "hi"));

    const session = peekSession(PHONE);
    expect(session.state).toBe("MAIN_MENU");
  });

  test("hello triggers greeting", async () => {
    await handleIncoming(PHONE, makeTextMessage(PHONE, "hello"));
    expect(sentMessages[0].type).toBe("buttons");
  });

  test("restart triggers greeting", async () => {
    await handleIncoming(PHONE, makeTextMessage(PHONE, "restart"));
    expect(sentMessages[0].type).toBe("buttons");
  });
});

// ─── Main Menu ───────────────────────────────────────────────────────────────

describe("Main Menu", () => {
  beforeEach(async () => {
    // Put session in MAIN_MENU state
    await handleIncoming(PHONE, makeTextMessage(PHONE, "hi"));
    resetMocks(); // clear greeting message
  });

  test("VIEW_PLANS sends plan info", async () => {
    await handleIncoming(
      PHONE,
      makeButtonReply(PHONE, "VIEW_PLANS", "View Plans"),
    );

    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].type).toBe("text");
    expect(sentMessages[0].text).toContain("Weekly");
    expect(sentMessages[0].text).toContain("Monthly");
  });

  test("ORDER_NOW starts subscription plan selection", async () => {
    await handleIncoming(
      PHONE,
      makeButtonReply(PHONE, "ORDER_NOW", "Order Now"),
    );

    expect(sentMessages[0].type).toBe("list");
    const session = peekSession(PHONE);
    expect(session.state).toBe("SELECTING_PLAN_CATEGORY");
  });

  test("CONTACT_US sends contact info", async () => {
    await handleIncoming(
      PHONE,
      makeButtonReply(PHONE, "CONTACT_US", "Contact Us"),
    );

    expect(sentMessages[0].text).toContain("fitfuelnutrition.com");
  });

  test("unknown button resets to greeting", async () => {
    await handleIncoming(
      PHONE,
      makeButtonReply(PHONE, "RANDOM_BUTTON", "Random"),
    );

    expect(sentMessages[0].type).toBe("buttons");
    expect(sentMessages[0].body).toContain("Welcome");
  });
});

// ─── Order Actions ───────────────────────────────────────────────────────────

describe("Order Actions", () => {
  let orderId;

  beforeEach(() => {
    orderId = seedOrder({
      phone: PHONE,
      slot: "lunch",
      delivery_date: new Date().toISOString().split("T")[0],
      item_id: "item001",
      item_name: "Paneer Butter Masala",
      status: "pending",
      is_default: true,
    });
  });

  test("CONFIRM updates order and sends confirmation", async () => {
    await handleIncoming(
      PHONE,
      makeButtonReply(PHONE, `CONFIRM_${orderId}`, "Confirm"),
    );

    expect(sentMessages[0].text).toContain("Confirmed");
    const order = getOrder(orderId);
    expect(order.status).toBe("confirmed");
  });

  test("SKIP updates order and sends skip message", async () => {
    await handleIncoming(
      PHONE,
      makeButtonReply(PHONE, `SKIP_${orderId}`, "Skip"),
    );

    expect(sentMessages[0].text).toContain("Skipped");
    const order = getOrder(orderId);
    expect(order.status).toBe("skipped");
  });

  test("CHANGE shows meal list and sets CHANGING_MEAL state", async () => {
    await handleIncoming(
      PHONE,
      makeButtonReply(PHONE, `CHANGE_${orderId}`, "Change"),
    );

    expect(sentMessages[0].type).toBe("list");
    const session = peekSession(PHONE);
    expect(session.state).toBe("CHANGING_MEAL");
    expect(session.data.orderId).toBe(orderId);
  });
});

// ─── Meal Change ─────────────────────────────────────────────────────────────

describe("Meal Change", () => {
  let orderId;

  beforeEach(async () => {
    orderId = seedOrder({
      phone: PHONE,
      slot: "lunch",
      item_id: "item001",
      item_name: "Paneer Butter Masala",
      status: "pending",
    });
    // Put in CHANGING_MEAL state
    await handleIncoming(
      PHONE,
      makeButtonReply(PHONE, `CHANGE_${orderId}`, "Change"),
    );
    resetMocks();
  });

  test("selecting a meal updates order and confirms", async () => {
    await handleIncoming(
      PHONE,
      makeListReply(PHONE, `MEAL_${orderId}_item002`, "Chicken Biryani"),
    );

    expect(sentMessages[0].text).toContain("updated");
    expect(sentMessages[0].text).toContain("Chicken Biryani");

    const order = getOrder(orderId);
    expect(order.item_id).toBe("item002");
    expect(order.is_default).toBe(false);
    expect(order.status).toBe("confirmed");
  });

  test("session resets to GREETING after meal change", async () => {
    await handleIncoming(
      PHONE,
      makeListReply(PHONE, `MEAL_${orderId}_item003`, "Dal Tadka"),
    );

    const session = peekSession(PHONE);
    expect(session.state).toBe("GREETING");
  });
});

// ─── Subscription Flow ───────────────────────────────────────────────────────

describe("Subscription Flow", () => {
  // Helper: walk the user through all steps up to (but not including) the
  // specified step so each test starts at the right state.
  async function reach(upTo) {
    await handleIncoming(PHONE, makeTextMessage(PHONE, "hi")); // → MAIN_MENU
    if (upTo === "MAIN_MENU") return;

    await handleIncoming(PHONE, makeButtonReply(PHONE, "ORDER_NOW", "Order Now")); // → SELECTING_PLAN_CATEGORY
    if (upTo === "SELECTING_PLAN_CATEGORY") return;

    await handleIncoming(PHONE, makeListReply(PHONE, "PLAN_WEIGHT_LOSS", "Weight Loss")); // → SELECTING_DAYS
    if (upTo === "SELECTING_DAYS") return;

    await handleIncoming(PHONE, makeButtonReply(PHONE, "DAYS_7", "7 Days")); // → SELECTING_MEALS_PER_DAY
    if (upTo === "SELECTING_MEALS_PER_DAY") return;

    await handleIncoming(PHONE, makeButtonReply(PHONE, "MEALS_1", "Breakfast only")); // → AWAITING_LOCATION
    if (upTo === "AWAITING_LOCATION") return;

    await handleIncoming(PHONE, makeTextMessage(PHONE, "Koramangala, Bangalore")); // → AWAITING_ADDRESS
  }

  beforeEach(async () => {
    await handleIncoming(PHONE, makeTextMessage(PHONE, "hi"));
    resetMocks();
  });

  test("ORDER_NOW sends plan category list", async () => {
    await handleIncoming(PHONE, makeButtonReply(PHONE, "ORDER_NOW", "Order Now"));

    expect(sentMessages[0].type).toBe("list");
    expect(sentMessages[0].body).toContain("plan");
    expect(peekSession(PHONE).state).toBe("SELECTING_PLAN_CATEGORY");
  });

  test("PLAN_KETO stores planId and moves to SELECTING_DAYS", async () => {
    await reach("SELECTING_PLAN_CATEGORY");
    resetMocks();

    await handleIncoming(PHONE, makeListReply(PHONE, "PLAN_KETO", "Keto"));

    const session = peekSession(PHONE);
    expect(session.state).toBe("SELECTING_DAYS");
    expect(session.data.planId).toBe("PLAN_KETO");
  });

  test("PLAN_MUSCLE_GAIN stores planId and moves to SELECTING_DAYS", async () => {
    await reach("SELECTING_PLAN_CATEGORY");
    resetMocks();

    await handleIncoming(PHONE, makeListReply(PHONE, "PLAN_MUSCLE_GAIN", "Muscle Gain"));

    const session = peekSession(PHONE);
    expect(session.state).toBe("SELECTING_DAYS");
    expect(session.data.planId).toBe("PLAN_MUSCLE_GAIN");
  });

  test("unknown plan id resends plan list", async () => {
    await reach("SELECTING_PLAN_CATEGORY");
    resetMocks();

    await handleIncoming(PHONE, makeListReply(PHONE, "PLAN_INVALID", "???"));

    expect(sentMessages[0].type).toBe("list");
    expect(peekSession(PHONE).state).toBe("SELECTING_PLAN_CATEGORY");
  });

  test("DAYS_14 stores days and moves to SELECTING_MEALS_PER_DAY", async () => {
    await reach("SELECTING_DAYS");
    resetMocks();

    await handleIncoming(PHONE, makeButtonReply(PHONE, "DAYS_14", "14 Days"));

    const session = peekSession(PHONE);
    expect(session.state).toBe("SELECTING_MEALS_PER_DAY");
    expect(session.data.days).toBe(14);
  });

  test("day selection body shows price preview", async () => {
    await reach("SELECTING_DAYS");
    resetMocks();

    await handleIncoming(PHONE, makeButtonReply(PHONE, "DAYS_7", "7 Days"));

    // Should show at least one ₹ price
    expect(sentMessages[0].body).toContain("₹");
  });

  test("MEALS_3 stores mealsPerDay and moves to AWAITING_LOCATION", async () => {
    await reach("SELECTING_MEALS_PER_DAY");
    resetMocks();

    await handleIncoming(PHONE, makeButtonReply(PHONE, "MEALS_3", "All 3 Meals"));

    const session = peekSession(PHONE);
    expect(session.state).toBe("AWAITING_LOCATION");
    expect(session.data.mealsPerDay).toBe(3);
  });

  test("sharing GPS location moves to AWAITING_ADDRESS", async () => {
    await reach("AWAITING_LOCATION");
    resetMocks();

    await handleIncoming(PHONE, makeLocationMessage(PHONE, 12.9716, 77.5946));

    expect(sentMessages[0].type).toBe("text");
    expect(sentMessages[0].text).toContain("address");
    const session = peekSession(PHONE);
    expect(session.state).toBe("AWAITING_ADDRESS");
    expect(session.data.location.latitude).toBe(12.9716);
    expect(session.data.location.longitude).toBe(77.5946);
  });

  test("typing area name also moves to AWAITING_ADDRESS", async () => {
    await reach("AWAITING_LOCATION");
    resetMocks();

    await handleIncoming(PHONE, makeTextMessage(PHONE, "Indiranagar, Bengaluru"));

    expect(sentMessages[0].type).toBe("text");
    expect(sentMessages[0].text).toContain("address");
    const session = peekSession(PHONE);
    expect(session.state).toBe("AWAITING_ADDRESS");
    expect(session.data.location.areaName).toBe("Indiranagar, Bengaluru");
  });

  test("typing address creates subscription, sends payment link, sets AWAITING_PAYMENT", async () => {
    await reach("AWAITING_ADDRESS");
    resetMocks();

    await handleIncoming(PHONE, makeTextMessage(PHONE, "42, 3rd Cross, Koramangala"));

    expect(sentMessages[0].type).toBe("text");
    expect(sentMessages[0].text).toContain("₹");
    expect(sentMessages[0].text).toContain("rzp.io");
    expect(createdLinks).toHaveLength(1);

    const session = peekSession(PHONE);
    expect(session.state).toBe("AWAITING_PAYMENT");
    expect(session.data.subscriptionId).toBeTruthy();

    const sub = getSubscription(session.data.subscriptionId);
    expect(sub.phone).toBe(PHONE);
    expect(sub.status).toBe("pending_payment");
    expect(sub.address).toBe("42, 3rd Cross, Koramangala");
  });

  test("any button press while AWAITING_PAYMENT shows payment reminder", async () => {
    const { setSession } = await import("./mocks/session.mock.js");
    await setSession(PHONE, { state: "AWAITING_PAYMENT", data: {} });

    await handleIncoming(PHONE, makeButtonReply(PHONE, "SOME_BTN", "something"));

    expect(sentMessages[0].type).toBe("text");
    expect(sentMessages[0].text).toContain("Payment Pending");
  });
});

describe("Edge Cases", () => {
  test("status updates (no messages) are ignored gracefully", async () => {
    // Webhook body with no messages key — should not throw
    const emptyBody = { entry: [{ changes: [{ value: {} }] }] };
    const value = emptyBody?.entry?.[0]?.changes?.[0]?.value;
    expect(value?.messages).toBeUndefined();
    expect(sentMessages).toHaveLength(0);
  });

  test("unknown state resets to greeting", async () => {
    // Force an unknown state
    const { setSession } = await import("./mocks/session.mock.js");
    await setSession(PHONE, { state: "SOME_OLD_STATE", data: {} });

    await handleIncoming(PHONE, makeTextMessage(PHONE, "anything"));
    expect(sentMessages[0].type).toBe("buttons");
  });

  test("order action with no order ID sends error", async () => {
    await handleIncoming(PHONE, makeButtonReply(PHONE, "CONFIRM_", "Confirm"));
    expect(sentMessages[0].text).toContain("went wrong");
  });
});
