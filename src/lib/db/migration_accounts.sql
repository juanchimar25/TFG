-- =============================================================
-- Primus FinFlow — Migración: Cuentas sincronizadas (HU-03)
-- Ejecutar en Neon SQL Editor (solo una vez)
-- =============================================================

ALTER TABLE cuenta
  ADD COLUMN IF NOT EXISTS ultima_sincronizacion TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS ultimos_digitos       CHAR(4);
