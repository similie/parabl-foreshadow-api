/* eslint-disable max-len */
import {
  ForecastParamSelect,
  LocalTimeValues,
  LocationCoordinates,
  SunRiseSetValues,
  WeatherRequest,
} from "../types";
import { find } from "geo-tz";
import { getSunrise, getSunset } from "sunrise-sunset-js";
import { DateTime } from "luxon";
import { RedisStore } from "../config";

export const generateCoordinatesKey = (
  key: string,
  coords: LocationCoordinates,
) => {
  return `${key || "GeneralRedisKey"}:${coords.latitude}:${coords.longitude}`;
};

export const getLocationName = async (coords: LocationCoordinates) => {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json&accept-language=en`;
  try {
    const key = generateCoordinatesKey("city_name", coords);
    const cachedValue = await RedisStore.instance.get(key);
    if (cachedValue) {
      return cachedValue;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch location name");
    }
    const data = await response.json();
    if (data.error) {
      return null;
    }
    // Extract city name from the response
    const city = (
      data.address?.city ||
      data.display_name.split(",")[1] ||
      ""
    ).trim();
    await RedisStore.instance.set(key, city);
    return city;
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
};

export const isTesting = () => {
  return process.env.NODE_ENV === "test";
};

export const delayAction = (timeout: number = 1000) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(null), timeout);
  });
};

export const getDateUnixTimestamp = (date?: Date): number => {
  const currentDate = date || new Date();
  return Math.floor(currentDate.getTime() / 1000);
};

export const setDateToLocalTime = (date: Date, tz: string) => {
  return DateTime.fromJSDate(date).setZone(tz).toISO(); // Use the returned value
};

export const setDateToLocalTimeToDate = (date: string, tz: string) => {
  return DateTime.fromISO(date).setZone(tz).toJSDate(); // Use the returned value
};

export const nowPlusValue = (
  value: number,
  tz: string = "UTC",
  date: Date = new Date(),
) => {
  return DateTime.fromJSDate(date).setZone(tz).plus({ days: value }).toJSDate();
};

/**
 * @name isDayAtLocation
 * @description Determines whether the specified local time (in a given timezone) at a location is during daytime.
 *
 * This function:
 *   1. Parses the provided ISO date (with offset) into a timezone-aware Luxon DateTime.
 *   2. Anchors the calculation to local noon on that day (to ensure we’re using the intended calendar day).
 *   3. Uses sunrise-sunset-js to compute sunrise and sunset based on that anchored time.
 *   4. Converts the computed sunrise/sunset times back to the target timezone.
 *   5. If the computed sunset appears to be from the previous day (i.e. it’s earlier than sunrise),
 *      it adjusts sunset by adding one day.
 *   6. Finally, it checks whether the provided local time is between sunrise and sunset.
 *
 * @param {number} latitude - The latitude of the location.
 * @param {number} longitude - The longitude of the location.
 * @param {string} isoDate - An ISO date string representing the local time (with offset) at the location.
 *                  For example: '2025-02-01T17:14:29.000-06:00'
 * @param {string} timeZone - A valid IANA timezone string (e.g., 'America/Chicago' or 'Asia/Shanghai')
 * @returns {SunRiseSetValues} true if the local time falls between sunrise and sunset; otherwise, false.
 */
export function isDayAtLocation(
  latitude: number,
  longitude: number,
  isoDate: string,
  timeZone: string,
): SunRiseSetValues {
  // Parse the provided ISO date in the given timezone.
  const localDateTime = DateTime.fromISO(isoDate, { zone: timeZone });

  // Anchor the calculation by creating a DateTime for local noon.
  // Noon is within the intended local day.
  const localNoon = localDateTime.set({
    hour: 12,
    minute: 0,
    second: 0,
    millisecond: 0,
  });

  // Use localNoon as the anchor date for calculation.
  const calcDate = localNoon.toJSDate();

  // Calculate sunrise and sunset times (UTC) for the anchored date.
  const sunriseUTC = getSunrise(latitude, longitude, calcDate);
  const sunsetUTC = getSunset(latitude, longitude, calcDate);

  // Convert the UTC times back into the target timezone.
  let sunriseLocal = DateTime.fromJSDate(sunriseUTC, { zone: timeZone });
  let sunsetLocal = DateTime.fromJSDate(sunsetUTC, { zone: timeZone });

  // Adjust sunriseLocal if it is not on the same local calendar day as localNoon.
  if (!localNoon.hasSame(sunriseLocal, "day")) {
    // Calculate the full-day difference between the dates.
    const deltaDays = localNoon
      .startOf("day")
      .diff(sunriseLocal.startOf("day"), "days").days;
    sunriseLocal = sunriseLocal.plus({ days: deltaDays });
  }

  // Adjust sunsetLocal similarly.
  if (!localNoon.hasSame(sunsetLocal, "day")) {
    const deltaDays = localNoon
      .startOf("day")
      .diff(sunsetLocal.startOf("day"), "days").days;
    sunsetLocal = sunsetLocal.plus({ days: deltaDays });
  }

  // If sunset appears earlier than sunrise (which may happen if the sunset calculation ended up on the previous day),
  // adjust by adding one day.
  if (sunsetLocal < sunriseLocal) {
    sunsetLocal = sunsetLocal.plus({ days: 1 });
  }

  // Determine if the current local time falls between sunrise and sunset.
  const isDay = localDateTime >= sunriseLocal && localDateTime <= sunsetLocal;

  return {
    isDay,
    sunrise: sunriseLocal.toISO() || "",
    sunset: sunsetLocal.toISO() || "",
  };
}

export const dateBetween = (lower: string, upper: string, against: string) => {
  const lowerDate = DateTime.fromISO(lower).toMillis();
  const upperDate = DateTime.fromISO(upper).toMillis();
  const date = DateTime.fromISO(against).toMillis();
  return date >= lowerDate && date < upperDate;
};

export const getGeoTime = (
  coords: LocationCoordinates,
  date?: Date,
): LocalTimeValues => {
  const tz = find(coords.latitude, coords.longitude);
  const unixTimestamp = getDateUnixTimestamp(date);
  // Create a DateTime object in UTC
  const utcTime = DateTime.fromMillis(unixTimestamp * 1000, { zone: "utc" });
  const timeZone = tz.pop() || "";
  // Convert to 'Asia/Dili' timezone
  const localTime = utcTime.setZone(timeZone);
  return {
    timeZone,
    unixTimestamp,
    localTime: localTime.toString(),
  };
};

export const defaultMappingLayers = (): ForecastParamSelect[] => {
  return [
    {
      param_key: "total-cloud-cover",
      level: 0,
      typeOfLevel: "atmosphere",
      stepType: "avg",
      model: "gfs",
    },
    {
      param_key: "2-metre-relative-humidity",
      typeOfLevel: "heightAboveGround",
      level: 2,
      stepType: "instant",
      model: "gfs",
    },
    {
      param_key: "2-metre-temperature",
      typeOfLevel: "heightAboveGround",
      level: 2,
      stepType: "instant",
      model: "gfs",
    },
    {
      param_key: "wind-speed-gust",
      stepType: "instant",
      typeOfLevel: "surface",
      level: 0,
      model: "gfs",
    },
    {
      param_key: "total-precipitation",
      stepType: "accum",
      typeOfLevel: "surface",
      level: 0,
      model: "gfs",
    },
  ];
};

export const getWeatherRequestTemplate = (
  coords: LocationCoordinates,
): WeatherRequest => {
  return {
    lat: coords.latitude,
    lon: coords.longitude,
    model: "gfs",
    param_keys: defaultMappingLayers(),
  };
};
