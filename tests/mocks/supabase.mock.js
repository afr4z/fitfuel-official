const orders = new Map();
let idCounter = 1;

export function resetDB() {
  orders.clear();
  idCounter = 1;
}

export function seedOrder(order) {
  const id = order.id || `order-${idCounter++}`;
  orders.set(id, { ...order, id });
  return id;
}

export function getOrder(id) {
  return orders.get(id);
}

export function createClient() {
  return {
    from: (_table) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
          }),
        }),
      }),
      insert: (row) => ({
        select: () => ({
          single: async () => {
            const id = `order-${idCounter++}`;
            const record = { ...row, id };
            orders.set(id, record);
            return { data: record, error: null };
          },
        }),
      }),
      update: (changes) => ({
        eq: async (col, val) => {
          for (const [id, order] of orders) {
            if (order[col] === val) {
              orders.set(id, { ...order, ...changes });
            }
          }
          return { error: null };
        },
      }),
    }),
  };
}
