-- =============================================================
-- Primus FinFlow — Migración: Integración Belvo (HU-03)
-- Ejecutar en Neon SQL Editor (solo una vez)
-- =============================================================

ALTER TABLE cuenta
  ADD COLUMN IF NOT EXISTS belvo_link_id    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS belvo_account_id VARCHAR(100);

-- Índice único parcial: evita duplicar la misma cuenta Belvo
CREATE UNIQUE INDEX IF NOT EXISTS cuenta_belvo_account_unique
  ON cuenta (belvo_account_id)
  WHERE belvo_account_id IS NOT NULL;
