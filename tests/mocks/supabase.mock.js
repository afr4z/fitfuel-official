const stores = {
  orders: new Map(),
  subscriptions: new Map(),
};
let idCounter = 1;

function getStore(table) {
  return stores[table] || stores.orders;
}

export function resetDB() {
  for (const store of Object.values(stores)) store.clear();
  idCounter = 1;
}

export function seedOrder(order) {
  const id = order.id || `order-${idCounter++}`;
  stores.orders.set(id, { ...order, id });
  return id;
}

export function getOrder(id) {
  return stores.orders.get(id);
}

export function getSubscription(id) {
  return stores.subscriptions.get(id);
}

export function getAllSubscriptions() {
  return [...stores.subscriptions.values()];
}

export function createClient() {
  return {
    from: (table) => {
      const store = getStore(table);
      return {
        select: () => ({
          eq: (col, val) => ({
            single: async () => {
              for (const [, record] of store) {
                if (record[col] === val) return { data: record, error: null };
              }
              return { data: null, error: { message: "Not found" } };
            },
            eq: (col2, val2) => ({
              single: async () => {
                for (const [, record] of store) {
                  if (record[col] === val && record[col2] === val2)
                    return { data: record, error: null };
                }
                return { data: null, error: { message: "Not found" } };
              },
            }),
          }),
        }),
        insert: (row) => ({
          select: () => ({
            single: async () => {
              const prefix = table === "subscriptions" ? "sub" : "order";
              const id = `${prefix}-${idCounter++}`;
              const record = { ...(Array.isArray(row) ? row[0] : row), id };
              store.set(id, record);
              return { data: record, error: null };
            },
          }),
        }),
        update: (changes) => ({
          eq: async (col, val) => {
            for (const [id, record] of store) {
              if (record[col] === val) {
                store.set(id, { ...record, ...changes });
              }
            }
            return { error: null };
          },
        }),
      };
    },
  };
}
