-- =============================================================
-- Primus FinFlow — Migración: Tabla obligaciones
-- Ejecutar en Neon SQL Editor (solo una vez)
-- =============================================================

CREATE TABLE IF NOT EXISTS obligacion (
  id_obligacion     SERIAL PRIMARY KEY,
  id_usuario        INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  emisor            VARCHAR(100) NOT NULL,
  monto             NUMERIC(12,2) NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  pagado            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS obligacion_usuario_fecha_idx
  ON obligacion (id_usuario, fecha_vencimiento);
