# Petpooja Menu Setup Guide

## Naming Convention

Categories in Petpooja must follow this format:

```
{plan_tag}_{slot}
```

Where:
- `plan_tag` — one of the 6 meal plan tags (see table below)
- `slot` — `breakfast`, `lunch`, or `dinner`

### 18 Categories to Create

| Category Name in Petpooja | Plan | Slot |
|---|---|---|
| `healthy_nonveg_breakfast` | Healthy Diet Plan Non-Veg | Breakfast |
| `healthy_nonveg_lunch` | Healthy Diet Plan Non-Veg | Lunch |
| `healthy_nonveg_dinner` | Healthy Diet Plan Non-Veg | Dinner |
| `healthy_veg_breakfast` | Healthy Diet Plan Veg | Breakfast |
| `healthy_veg_lunch` | Healthy Diet Plan Veg | Lunch |
| `healthy_veg_dinner` | Healthy Diet Plan Veg | Dinner |
| `high_protein_nonveg_breakfast` | High Protein Meal Plan Non-Veg | Breakfast |
| `high_protein_nonveg_lunch` | High Protein Meal Plan Non-Veg | Lunch |
| `high_protein_nonveg_dinner` | High Protein Meal Plan Non-Veg | Dinner |
| `high_protein_veg_breakfast` | High Protein Meal Plan Veg | Breakfast |
| `high_protein_veg_lunch` | High Protein Meal Plan Veg | Lunch |
| `high_protein_veg_dinner` | High Protein Meal Plan Veg | Dinner |
| `weight_loss_nonveg_breakfast` | Weight Loss Meal Plan Non-Veg | Breakfast |
| `weight_loss_nonveg_lunch` | Weight Loss Meal Plan Non-Veg | Lunch |
| `weight_loss_nonveg_dinner` | Weight Loss Meal Plan Non-Veg | Dinner |
| `weight_loss_veg_breakfast` | Weight Loss Meal Plan Veg | Breakfast |
| `weight_loss_veg_lunch` | Weight Loss Meal Plan Veg | Lunch |
| `weight_loss_veg_dinner` | Weight Loss Meal Plan Veg | Dinner |

## Required Fields Per Item

Each item in Petpooja needs these fields populated:

| Field | Petpooja Field | Required | Description |
|---|---|---|---|
| **Name** | `itemname` | Yes | Display name of the dish (e.g. "Grilled Chicken Sandwich") |
| **Price** | `price` | Yes | Selling price (e.g. 230.00) |
| **Category** | `categoryid` | Yes | Must be assigned to one of the 18 categories above |
| **Veg/Non-Veg** | `item_attributeid` | Yes | `1` = Veg, `2` = Non-Veg |
| **Active** | `active` | Yes | `1` = available, `0` = disabled |
| **Item ID** | `itemid` | Auto | Petpooja's internal ID (auto-generated, stored for order dispatch) |

## How the Sync Works

1. Petpooja pushes menu data to `https://fitfuel-server:8080/menu` (or wherever the webhook is configured)
2. `sync.js` reads each item's category name (e.g. `healthy_nonveg_breakfast`)
3. It splits the category name by `_` — last part is the slot, rest is the plan tag
4. It upserts the item into the `dishes` table with the correct `meal_plan_id`, `slot`, and `petpooja_item_id`
5. When an order is dispatched to Petpooja, `dispatch-orders.js` uses `petpooja_item_id` to tell Petpooja which item to prepare

## Order Dispatch Schedule

| Meal | Customer Deadline | Dispatched to Petpooja (UTC) | Dispatched to Petpooja (IST) |
|---|---|---|---|
| Breakfast | 10:00pm IST (day before) | 16:30 UTC | 10:00pm IST |
| Lunch | 9:30am IST (same day) | 04:00 UTC | 9:30am IST |
| Dinner | 5:00pm IST (same day) | 11:30 UTC | 5:00pm IST |

After each deadline, `dispatch-orders.js` runs and sends all confirmed/pending orders to Petpooja's `save_order` API.

## Example Items (for reference)

Items currently seeded per plan — use these as a reference when setting up Petpooja:

### Healthy Non-Veg
- **Breakfast**: Fresh Garden Omelette, High Protein Pancakes, Mixed Fruit Yogurt Bowl, Vegetable Sandwich, Protein Smoothie, Overnight Oat Meal, Fruit Salad
- **Lunch**: Paneer Millet Bowl, Egg Meal Box, Fish Meal Box, Roti with Shrimp, Veg Pasta, Protein Salad (Veg), Grilled Chicken Sandwich
- **Dinner**: Creamy Cucumber Salad, Shrimp Omelette, Paneer Sandwich, Mushroom Meal Box, Creamy Spinach Pasta, Chicken Wrap, Chicken Fajita

### Healthy Veg
- **Breakfast**: High Protein Pancakes, Mixed Fruit Yogurt Bowl, Vegetable Sandwich, Protein Smoothie, Overnight Oat Meal, Fruit Salad, Peanut Butter Banana Wrap
- **Lunch**: Paneer Millet Bowl, Veg Pasta, Protein Salad (Veg), Rajma Meal Box, Spinach & Paneer Bowl, Mushroom Meal Box, Roti with Paneer
- **Dinner**: Creamy Cucumber Salad, Paneer Sandwich, Creamy Spinach Pasta, Paneer Fajita, Creamy Mashed Potato, Peri-Peri Paneer, Sprouts Besan Chilla

### High Protein Non-Veg
- **Breakfast**: High Protein Oatmeal (Chocolate), High Protein Chocolate Yogurt Bowl, High Protein Chocolate Smoothie Bowl, Chicken & Avocado Toast, Chicken Omelette, High Protein Chocolate Smoothie, High Protein Avocado Smoothie
- **Lunch**: Chicken Meal Box, Roasted Chicken Breast, Chicken Lemon Strips (Grilled), Creamy Chicken Breast, Grilled Chicken Quinoa Bowl, Roasted Fish Meal Box, Chicken Pulao
- **Dinner**: Chicken Tikki, Fish Quinoa Bowl, Shrimp Omelette, Chicken Pasta, Creamy Chicken Salad, Spicy Chicken Sandwich, Air-fried Potatoes with Grilled Chicken

### High Protein Veg
- **Breakfast**: High Protein Chocolate Oatmeal, High Protein Chocolate Yogurt Bowl, High Protein Cookies & Cream Waffles, Paneer Sandwich, Creamy Spinach Pasta, Ragi Malt, Mixed Fruit Yogurt
- **Lunch**: Paneer Millet Bowl, High Protein Roties with Paneer Gravy, Roti with Chole, Rajma Meal Box, Vegetable Pulao (Paneer), Paneer Tikki, Rajma Quinoa Bowl
- **Dinner**: Mushroom Omelette, Paneer Fajita, Spinach Paneer Tikki, High Protein Chocolate Smoothie, Paneer Sandwich, Paneer Wrap, Veg Pasta

### Weight Loss Non-Veg
- **Breakfast**: Ragi Malt, Veg & Cheese Sandwich, Spicy Chicken Sandwich, Fruit Salad, Egg Whites Omelette, Spinach Papaya Juice, Beetroot Juice
- **Lunch**: Broccoli Meal Box, Mushroom Meal Box, Steamed Broccoli, Broccoli Wrap, Barbecue Wrap (Veg), Veg Semi Salad, Pineapple Juice
- **Dinner**: Roasted Broccoli, High Fiber Beetroot Smoothie, Veg & Cheese Sandwich, Creamy Avocado Salad, Fresh Garden Salad, Papaya Juice, Watermelon Juice

### Weight Loss Veg
- **Breakfast**: Green Smoothie Bowl, Oatmeal with Berry Compote, Tofu Scramble with Vegetables, Papaya Bowl with Lime, Coconut Water with Chia Seeds, Steamed Idli with Sambar, Vegetable Poha
- **Lunch**: Cauliflower Rice Bowl, Zucchini Noodles with Pesto, Cabbage and Lentil Soup, Cucumber Avocado Rolls, Steamed Vegetable Momos, Mixed Sprouts Salad, Lauki Soup with Quinoa
- **Dinner**: Clear Vegetable Soup, Tofu and Spinach Salad, Grilled Zucchini with Hummus, Cabbage Soup, Cucumber Raita with Roasted Papad, Bell Pepper and Tomato Salad, Herbal Tea with Rice Cakes

## Checklist

- [ ] Create 18 categories in Petpooja backend (6 plans × 3 slots)
- [ ] Add items to each category with correct names, prices, and veg/non-veg flags
- [ ] Configure Petpooja to push menu updates to the webhook URL
- [ ] Verify webhook is running: `curl http://localhost:8080/health`
- [ ] Run a test menu push and check `menu-pushes.log` for sync result
