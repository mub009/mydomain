-- Per-shop sending controls: pace, daily cap, quiet hours and STOP handling.
ALTER TABLE `whatsapp_sessions`
  ADD COLUMN `dailyLimit` INTEGER NOT NULL DEFAULT 250,
  ADD COLUMN `sendDelayMs` INTEGER NOT NULL DEFAULT 8000,
  ADD COLUMN `sendJitterMs` INTEGER NOT NULL DEFAULT 4000,
  ADD COLUMN `windowStartHour` INTEGER NOT NULL DEFAULT 9,
  ADD COLUMN `windowEndHour` INTEGER NOT NULL DEFAULT 21,
  ADD COLUMN `autoOptOut` BOOLEAN NOT NULL DEFAULT true;
