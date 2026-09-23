import assert from "node:assert/strict";
import { emptyWeeklySchedule, getStoreAvailability } from "../lib/store-hours.ts";
import { getStoreThemeTokens } from "../lib/store-theme.ts";

const schedule = emptyWeeklySchedule();
schedule.wednesday = [{ open: "18:00", close: "01:00" }];

assert.equal(getStoreAvailability({ orderingMode: "open", weeklySchedule: schedule }).isOpen, true, "modo manual aberto");
assert.equal(getStoreAvailability({ orderingMode: "closed", weeklySchedule: schedule }).isOpen, false, "modo manual fechado");
assert.equal(
  getStoreAvailability({ orderingMode: "automatic", weeklySchedule: schedule }, new Date("2026-09-24T03:30:00Z")).isOpen,
  true,
  "intervalo automático após a meia-noite",
);
assert.match(
  getStoreAvailability({ orderingMode: "automatic", weeklySchedule: schedule }, new Date("2026-09-23T18:00:00Z")).message,
  /abre hoje às 18:00/,
  "próxima abertura no fuso de São Paulo",
);

const dark = getStoreThemeTokens({ accent: "#ffc21b", primary: "#e32120", background: "#141414" });
assert.equal(dark["--store-bg"], "#141414");
assert.equal(dark["--store-text"], "#fff8e9");
assert.notEqual(dark["--store-surface"], dark["--store-bg"]);

const light = getStoreThemeTokens({ accent: "#e8a500", primary: "#af171a", background: "#fffdf7" });
assert.equal(light["--store-text"], "#171411");
assert.equal(light["--store-on-primary"], "#ffffff");

console.log("Regras de tema e funcionamento validadas.");
