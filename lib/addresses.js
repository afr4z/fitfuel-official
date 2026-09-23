import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Fetch the customer row for a phone (international format 91XXXXXXXXXX).
 * Returns { id, name, email, phone } or null.
 */
export async function getCustomerByPhone(phone) {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, email, phone")
    .eq("phone", phone)
    .maybeSingle();
  if (error) {
    console.error("[ADDRESSES] getCustomerByPhone error:", error.message);
    return null;
  }
  return data || null;
}

/**
 * Fetch all saved addresses for a customer, default first then newest.
 */
export async function getCustomerAddresses(customerId) {
  const { data, error } = await supabase
    .from("customer_addresses")
    .select("*")
    .eq("customer_id", customerId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[ADDRESSES] getCustomerAddresses error:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Normalise a location value into the JSONB shape stored on addresses.
 * Strings (web checkout / bot text) become { areaName }.
 */
export function normalizeLocation(value) {
  if (!value) return null;
  if (typeof value === "string") return { areaName: value };
  return value;
}

/**
 * Resolve the delivery address for a completed order.
 *
 * `details` is session.data from a pending order and may carry either:
 *  - addressId  → a previously saved address book entry, or
 *  - address + location → a new/edited address.
 *
 * Rules (no backward-compat shims, dev phase):
 *  - If addressId is present and belongs to the customer, it is re-used.
 *  - Otherwise the new address is saved into the address book (upserted on
 *    customer_id + exact address text) and the row is returned.
 *  - The resolved address is always marked as the customer's default.
 *
 * Returns { id } row or null when nothing usable was supplied.
 */
export async function resolveDeliveryAddress(customerId, details = {}) {
  const { addressId, address, location } = details;

  if (addressId) {
    const { data: saved, error } = await supabase
      .from("customer_addresses")
      .select("id")
      .eq("id", addressId)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (!error && saved) {
      // Mark as default (only one default per customer).
      await setDefaultAddress(customerId, saved.id);
      return saved;
    }
  }

  if (!address || !String(address).trim()) return null;

  const locationValue = normalizeLocation(location);
  const addressText = String(address).trim();

  // Upsert on customer_id + normalized address to avoid duplicate rows when a
  // customer re-uses the same delivery address on a later order.
  const { data: upserted, error: upsertError } = await supabase
    .from("customer_addresses")
    .upsert(
      {
        customer_id: customerId,
        address: addressText,
        location: locationValue,
        label: details.addressLabel || "Home",
        is_default: true,
      },
      { onConflict: "customer_id,address" },
    )
    .select("id")
    .single();

  if (upsertError) {
    console.error(
      "[ADDRESSES] upsert address failed:",
      JSON.stringify(upsertError),
    );
    return null;
  }

  // Only one default per customer.
  await setDefaultAddress(customerId, upserted.id);
  return upserted;
}

/**
 * Set a single address as the customer's default (clears the others).
 */
export async function setDefaultAddress(customerId, addressId) {
  await supabase
    .from("customer_addresses")
    .update({ is_default: false })
    .eq("customer_id", customerId)
    .neq("id", addressId);
  await supabase
    .from("customer_addresses")
    .update({ is_default: true })
    .eq("id", addressId)
    .eq("customer_id", customerId);
}

/**
 * Build a short human-readable button label for a saved address.
 */
export function addressButtonLabel(addr) {
  if (addr.label && addr.label !== "Home") return addr.label;
  const area =
    addr.location?.areaName ||
    addr.location?.locationName ||
    addr.address ||
    "Address";
  return area.substring(0, 24);
}
