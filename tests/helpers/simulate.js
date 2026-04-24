export function makeTextMessage(phone, text, msgId = "msg001") {
  return {
    from: phone,
    id: msgId,
    type: "text",
    text: { body: text },
  };
}

export function makeButtonReply(phone, buttonId, title, msgId = "msg002") {
  return {
    from: phone,
    id: msgId,
    type: "interactive",
    interactive: {
      type: "button_reply",
      button_reply: { id: buttonId, title },
    },
  };
}

export function makeListReply(phone, listId, title, msgId = "msg003") {
  return {
    from: phone,
    id: msgId,
    type: "interactive",
    interactive: {
      type: "list_reply",
      list_reply: { id: listId, title },
    },
  };
}

export function makeLocationMessage(phone, latitude, longitude, msgId = "msg004") {
  return {
    from: phone,
    id: msgId,
    type: "location",
    location: { latitude, longitude },
  };
}
