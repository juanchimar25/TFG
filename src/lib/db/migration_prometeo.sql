-- =============================================================
-- Primus FinFlow — Migración: Integración Prometeo (HU-03 v2)
-- Ejecutar en Neon SQL Editor (solo una vez)
-- =============================================================

ALTER TABLE cuenta
  ADD COLUMN IF NOT EXISTS prometeo_provider     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS prometeo_account_id   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS prometeo_session_key  VARCHAR(200);

-- Índice único parcial: evita importar la misma cuenta Prometeo dos veces
CREATE UNIQUE INDEX IF NOT EXISTS cuenta_prometeo_account_unique
  ON cuenta (prometeo_account_id)
  WHERE prometeo_account_id IS NOT NULL;
