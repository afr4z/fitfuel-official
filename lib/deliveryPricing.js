/**
 * Distance-based delivery pricing.
 *
 * The kitchen address is the origin. A customer within `freeKm` straight-line /
 * road distance pays nothing. Beyond that, delivery is charged per meal per
 * delivery day, with a lower rate for longer plans.
 *
 * This module is server-side only. The browser gets a quote from
 * /api/delivery-quote so the amount is never calculated from client input.
 */

function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export const DELIVERY_CONFIG = {
  freeKm: envNumber("DELIVERY_FREE_KM", 3),
  standardPerMeal: envNumber("DELIVERY_STANDARD_PER_MEAL", 20),
  longPlanPerMeal: envNumber("DELIVERY_LONG_PLAN_PER_MEAL", 15),
  longPlanMinDays: envNumber("DELIVERY_LONG_PLAN_MIN_DAYS", 20),
  // "charge" keeps checkout open when we cannot locate an address; the customer
  // pays the normal rate. "free" is the opposite. We default to charging so
  // unlocatable addresses do not silently get free delivery.
  unknownPolicy: process.env.DELIVERY_UNKNOWN_POLICY || "charge",
};

/** Jadpod's Fit Fuel, Khammam. Override with KITCHEN_LAT / KITCHEN_LNG. */
export const KITCHEN_LOCATION = {
  latitude: envNumber("KITCHEN_LAT", 17.2478673),
  longitude: envNumber("KITCHEN_LNG", 80.1496404),
};

/**
 * Existing subscriptions are not charged delivery. This cutoff deliberately
 * only affects dispatch, not checkout. New subscriptions are always after it.
 */
export const DELIVERY_LAUNCH_AT =
  process.env.DELIVERY_LAUNCH_AT || "2026-10-28T00:00:00+05:30";

const GEOCODE_SUFFIX =
  process.env.DELIVERY_GEOCODE_SUFFIX || "Khammam, Telangana, India";

const geocodeCache = new Map();
let geocodeBackoffUntil = 0;

export function getPublicDeliveryConfig() {
  return {
    freeKm: DELIVERY_CONFIG.freeKm,
    standardPerMeal: DELIVERY_CONFIG.standardPerMeal,
    longPlanPerMeal: DELIVERY_CONFIG.longPlanPerMeal,
    longPlanMinDays: DELIVERY_CONFIG.longPlanMinDays,
  };
}

/**
 * Accepts the several location shapes already stored in customer_addresses:
 *   { latitude, longitude }
 *   { lat, lng }
 *   "17.2478, 80.1496"
 */
export function normalizeCoordinates(location) {
  if (!location) return null;

  if (typeof location === "string") {
    const match = location.match(
      /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/,
    );
    if (!match) return null;
    return validCoordinates(Number(match[1]), Number(match[2]));
  }

  if (typeof location !== "object") return null;

  const latitude = Number(location.latitude ?? location.lat);
  const longitude = Number(location.longitude ?? location.lng ?? location.lon);
  return validCoordinates(latitude, longitude);
}

function validCoordinates(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

export function hasCoordinates(location) {
  return Boolean(normalizeCoordinates(location));
}

/** Great-circle distance in km. */
export function haversineKm(origin, destination) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(destination.latitude - origin.latitude);
  const dLng = toRad(destination.longitude - origin.longitude);
  const lat1 = toRad(origin.latitude);
  const lat2 = toRad(destination.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function geocodeWithGoogle(query) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const params = new URLSearchParams({
    address: query,
    region: "in",
    key,
  });
  const data = await fetchJson(
    `https://maps.googleapis.com/maps/api/geocode/json?${params}`,
  );
  if (data.status !== "OK" || !data.results?.length) return null;

  const first = data.results[0];
  const coordinates = normalizeCoordinates(first.geometry?.location);
  if (!coordinates) return null;

  return {
    ...coordinates,
    source: "geocoded-google",
    formattedAddress: first.formatted_address || null,
    confidence: first.geometry?.location_type || null,
  };
}

async function geocodeWithNominatim(query) {
  const params = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    countrycodes: "in",
    addressdetails: "1",
    q: query,
    email: "hello@fitfuelnutrition.com",
  });
  const data = await fetchJson(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        "User-Agent": "FitFuel/1.0 (hello@fitfuelnutrition.com)",
        "Accept-Language": "en",
      },
    },
  );
  if (!Array.isArray(data) || !data.length) return null;

  const first = data[0];
  const coordinates = validCoordinates(Number(first.lat), Number(first.lon));
  if (!coordinates) return null;

  return {
    ...coordinates,
    source: "geocoded-nominatim",
    formattedAddress: first.display_name || null,
    confidence: first.type || null,
  };
}

export async function geocodeAddress(query) {
  const cleaned = String(query || "").trim();
  if (!cleaned) return null;
  // If a provider is unreachable, don't make the customer wait through
  // several fallback attempts. Use the paid fallback and retry later.
  if (Date.now() < geocodeBackoffUntil) return null;

  const cacheKey = cleaned.toLowerCase();
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);

  const withSuffix = /khammam/i.test(cleaned)
    ? cleaned
    : `${cleaned}, ${GEOCODE_SUFFIX}`;

  let result = null;
  try {
    result = await geocodeWithGoogle(withSuffix);
    if (!result) result = await geocodeWithNominatim(withSuffix);
  } catch (err) {
    geocodeBackoffUntil = Date.now() + 60_000;
    console.error("[DELIVERY] Geocode failed:", err.message);
  }

  // Cache successes and misses for the life of this warm function. This keeps
  // quote re-renders from hammering Nominatim.
  geocodeCache.set(cacheKey, result);
  return result;
}

/**
 * Resolve a usable coordinate from a location object/string, falling back to
 * geocoding the typed address. Returns null when nothing usable is available.
 */
export async function resolveDeliveryCoordinates({ location, address, area }) {
  const direct = normalizeCoordinates(location);
  if (direct) {
    return { ...direct, source: "provided", formattedAddress: null };
  }

  const locationArea =
    typeof location === "object" && location
      ? location.areaName || location.locationName
      : typeof location === "string"
        ? location
        : null;

  const clean = (value) => {
    if (typeof value !== "string") return "";
    const text = value.trim();
    // The website uses this as a UI label when GPS coordinates are captured
    // separately. Never send it to a geocoder.
    if (/^current location/i.test(text)) return "";
    return text;
  };

  const addressText = clean(address);
  const areaText = clean(area);
  const locationAreaText = clean(locationArea);

  // Prefer the full address. Only append an area if the address does not
  // already contain it; a duplicated area makes Nominatim miss.
  const parts = [];
  if (addressText) {
    parts.push(addressText);
    const extraArea = areaText || locationAreaText;
    if (
      extraArea &&
      !addressText.toLowerCase().includes(extraArea.toLowerCase())
    ) {
      parts.push(extraArea);
    }
  } else {
    if (areaText) parts.push(areaText);
    if (
      locationAreaText &&
      locationAreaText.toLowerCase() !== areaText.toLowerCase()
    ) {
      parts.push(locationAreaText);
    }
  }

  const query = parts.filter(Boolean).join(", ");
  if (!query) return null;

  // House/plot numbers often defeat Nominatim even when the street/area is
  // known. Try progressively broader queries before giving up.
  const attempts = [query];
  const addAttempt = (fallback) => {
    if (
      fallback &&
      !attempts.some(
        (attempt) => attempt.toLowerCase() === fallback.toLowerCase(),
      )
    ) {
      attempts.push(fallback);
    }
  };

  for (const fallback of [areaText, locationAreaText]) addAttempt(fallback);

  // "12-3-45, Wyra Road, Khammam, Telangana" → try the street and city parts
  // too. This keeps saved addresses usable when the house number is unknown.
  const segments = addressText
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  for (let i = 1; i < segments.length - 1; i++) {
    addAttempt(segments.slice(i).join(", "));
  }

  for (const attempt of attempts) {
    const result = await geocodeAddress(attempt);
    if (result) return result;
  }
  return null;
}

/** Prefer real road distance; fall back to straight-line distance. */
export async function roadDistanceKm(origin, destination) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (key) {
    try {
      const params = new URLSearchParams({
        origins: `${origin.latitude},${origin.longitude}`,
        destinations: `${destination.latitude},${destination.longitude}`,
        mode: "driving",
        key,
      });
      const data = await fetchJson(
        `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`,
      );
      const element = data.rows?.[0]?.elements?.[0];
      if (element?.status === "OK" && element.distance?.value != null) {
        return {
          distanceKm: element.distance.value / 1000,
          source: "road",
        };
      }
    } catch (err) {
      console.error("[DELIVERY] Distance Matrix failed:", err.message);
    }
  }

  return {
    distanceKm: haversineKm(origin, destination),
    source: "straight-line",
  };
}

export function deliveryChargePerMeal({
  days,
  distanceKm,
  locationKnown = true,
}) {
  if (distanceKm != null && distanceKm <= DELIVERY_CONFIG.freeKm) return 0;
  if (!locationKnown && DELIVERY_CONFIG.unknownPolicy === "free") return 0;

  return Number(days) >= DELIVERY_CONFIG.longPlanMinDays
    ? DELIVERY_CONFIG.longPlanPerMeal
    : DELIVERY_CONFIG.standardPerMeal;
}

export function calcPlanAmount({ ratePerMealPerDay, days, mealsPerDay }) {
  return Math.round(
    Number(ratePerMealPerDay) * Number(days) * Number(mealsPerDay),
  );
}

/**
 * Full quote used by checkout, the bot, and the delivery-quote API.
 */
export async function getDeliveryQuote({
  ratePerMealPerDay,
  days,
  mealsPerDay,
  address,
  location,
  area,
}) {
  const planAmount = calcPlanAmount({
    ratePerMealPerDay,
    days,
    mealsPerDay,
  });

  const coordinates = await resolveDeliveryCoordinates({
    location,
    address,
    area,
  });

  let distanceKm = null;
  let distanceSource = "unknown";
  if (coordinates) {
    const measured = await roadDistanceKm(KITCHEN_LOCATION, coordinates);
    distanceKm = measured.distanceKm;
    distanceSource = measured.source;
  }

  const locationKnown = distanceKm != null;
  const deliveryPerMeal = deliveryChargePerMeal({
    days,
    distanceKm,
    locationKnown,
  });
  const deliveryTotal = Math.round(
    deliveryPerMeal * Number(days) * Number(mealsPerDay),
  );

  return {
    planAmount,
    deliveryPerMeal,
    deliveryTotal,
    totalAmount: planAmount + deliveryTotal,
    distanceKm: distanceKm == null ? null : Math.round(distanceKm * 100) / 100,
    distanceSource,
    freeDelivery: deliveryPerMeal === 0,
    locationKnown,
    coordinates: coordinates
      ? {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        }
      : null,
    locationSource: coordinates?.source || null,
    geocodedAddress: coordinates?.formattedAddress || null,
  };
}

export function isDeliveryEnabledForSubscription(createdAt) {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  const launch = new Date(DELIVERY_LAUNCH_AT).getTime();
  if (!Number.isFinite(created) || !Number.isFinite(launch)) return false;
  return created >= launch;
}
