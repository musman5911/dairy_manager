const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

function todayStr(date = new Date()) {
  return new Date(date.getTime() + PKT_OFFSET_MS).toISOString().slice(0, 10);
}

function daysAgoStr(days, date = new Date()) {
  const shifted = new Date(date.getTime() + PKT_OFFSET_MS);
  shifted.setUTCDate(shifted.getUTCDate() - days);
  return shifted.toISOString().slice(0, 10);
}

module.exports = { todayStr, daysAgoStr };
