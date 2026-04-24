export const sentMessages = [];

export function resetMocks() {
  sentMessages.length = 0;
}

export async function sendText(to, text) {
  sentMessages.push({ type: "text", to, text });
}

export async function sendButtons(to, body, buttons) {
  sentMessages.push({ type: "buttons", to, body, buttons });
}

export async function sendList(to, body, buttonLabel, sections) {
  sentMessages.push({ type: "list", to, body, buttonLabel, sections });
}

export async function markAsRead(messageId) {
  sentMessages.push({ type: "read", messageId });
}
