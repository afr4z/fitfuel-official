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
// Import mocks and handler after mocking
const { sentMessages, resetMocks } = await import("./mocks/whatsapp.mock.js");
const { resetSessions, peekSession } = await import("./mocks/session.mock.js");
const { resetDB, seedOrder, getOrder } = await import(
  "./mocks/supabase.mock.js"
);
const { handleIncoming } = await import("../bot/handler.js");
const { makeTextMessage, makeButtonReply, makeListReply } = await import(
  "./helpers/simulate.js"
);

const PHONE = "919876543210";

beforeEach(() => {
  resetMocks();
  resetSessions();
  resetDB();
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

  test("ORDER_NOW sends order instructions", async () => {
    await handleIncoming(
      PHONE,
      makeButtonReply(PHONE, "ORDER_NOW", "Order Now"),
    );

    expect(sentMessages[0].text).toContain("preferred plan");
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

// ─── Edge Cases ──────────────────────────────────────────────────────────────

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
