// Fixed menu items matching the fallback list in orders.js
const MOCK_ITEMS = [
  { itemid: "item001", itemname: "Paneer Butter Masala", item_type: "1", price: "180" },
  { itemid: "item002", itemname: "Chicken Biryani",      item_type: "2", price: "220" },
  { itemid: "item003", itemname: "Dal Tadka + Rice",     item_type: "1", price: "150" },
  { itemid: "item004", itemname: "Grilled Fish Thali",   item_type: "2", price: "250" },
];

const MOCK_CATEGORIES = [
  { categoryid: "cat001", categoryname: "Main Course" },
  { categoryid: "cat002", categoryname: "Starters"    },
];

export async function getMenuItems() {
  return MOCK_ITEMS;
}

export async function getCategories() {
  return MOCK_CATEGORIES;
}
