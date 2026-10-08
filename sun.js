// Solar position & sunset times (adapted from the public-domain SunCalc formulas).
const PI = Math.PI, rad = PI / 180, dayMs = 864e5, J1970 = 2440588, J2000 = 2451545, J0 = 0.0009;
const e = rad * 23.4397;
const toDays = (ms) => ms / dayMs - 0.5 + J1970 - J2000;
const fromJulian = (j) => (j + 0.5 - J1970) * dayMs;
const declination = (l) => Math.asin(Math.sin(e) * Math.sin(l));
const rightAscension = (l) => Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l));
const solarMeanAnomaly = (d) => rad * (357.5291 + 0.98560028 * d);
const eclipticLongitude = (M) =>
  M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + PI;

export function sunPosition(ms, lat, lng) {
  const lw = rad * -lng, phi = rad * lat, d = toDays(ms);
  const L = eclipticLongitude(solarMeanAnomaly(d));
  const dec = declination(L), ra = rightAscension(L);
  const H = rad * (280.16 + 360.9856235 * d) - lw - ra;
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  return { azimuth: (az / rad + 180 + 360) % 360, altitude: alt / rad };
}

function setTime(h, lw, phi, dec, n, M, L) {
  const w = Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
  const a = J0 + (w + lw) / (2 * PI) + n;
  return fromJulian(J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L));
}

/**
 * Sunset facts for a local calendar date (YYYY-MM-DD, America/Los_Angeles).
 * elevation (m) lowers the apparent horizon, so elevated spots see the sun set later.
 */
export function sunsetInfo(dateStr, lat, lng, elevation = 0) {
  const [y, m, dd] = dateStr.split('-').map(Number);
  const noon = Date.UTC(y, m - 1, dd, 20); // ~noon Pacific
  const lw = rad * -lng, phi = rad * lat, d = toDays(noon);
  const n = Math.round(d - J0 - lw / (2 * PI));
  const ds = J0 + lw / (2 * PI) + n;
  const M = solarMeanAnomaly(ds), L = eclipticLongitude(M), dec = declination(L);
  const dip = (1.76 * Math.sqrt(Math.max(0, elevation))) / 60; // degrees
  const sunset = setTime((-0.833 - dip) * rad, lw, phi, dec, n, M, L);
  const seaLevelSunset = setTime(-0.833 * rad, lw, phi, dec, n, M, L);
  const dusk = setTime(-6 * rad, lw, phi, dec, n, M, L);
  const golden = setTime(6 * rad, lw, phi, dec, n, M, L);
  return {
    sunset, dusk, golden,
    azimuth: sunPosition(sunset, lat, lng).azimuth,
    elevationGainMin: Math.round((sunset - seaLevelSunset) / 60000),
  };
}

const DIRS = ['北', '北偏东', '东北', '东偏北', '东', '东偏南', '东南', '南偏东', '南', '南偏西', '西南', '西偏南', '西', '西偏北', '西北', '北偏西'];
const DIRS_EN = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compass = (az) => DIRS[Math.round((az % 360) / 22.5) % 16];
export const compassEn = (az) => DIRS_EN[Math.round((az % 360) / 22.5) % 16];
