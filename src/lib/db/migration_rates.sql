-- =============================================================
-- Primus FinFlow — Migración: Tasas de mercado
-- Ejecutar en Neon SQL Editor (solo una vez)
-- =============================================================

-- 1. Agregar columnas necesarias a alternativa_mercado
ALTER TABLE alternativa_mercado
  ADD COLUMN IF NOT EXISTS producto      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cft           NUMERIC(7,2),
  ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ DEFAULT NOW();

-- 2. Aumentar precisión de tasa_referencia para soportar tasas altas
ALTER TABLE alternativa_mercado
  ALTER COLUMN tasa_referencia TYPE NUMERIC(7,2);

-- 3. Constraint único para hacer UPSERT por entidad + tipo + producto
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'alternativa_unique'
  ) THEN
    ALTER TABLE alternativa_mercado
      ADD CONSTRAINT alternativa_unique
      UNIQUE (id_entidad, tipo_operacion, producto);
  END IF;
END $$;

-- 4. Seed: alternativas de inversión (tasas iniciales, se actualizan via BCRA)
INSERT INTO alternativa_mercado (id_entidad, tipo_operacion, producto, tasa_referencia, plazo_dias, actualizado_en)
VALUES
  ((SELECT id_entidad FROM entidad_financiera WHERE nombre = 'Mercado Pago'    LIMIT 1), 'Inversión', 'Fondo Money Market',  55.0, 1,  NOW()),
  ((SELECT id_entidad FROM entidad_financiera WHERE nombre = 'Personal Pay'    LIMIT 1), 'Inversión', 'Cuenta Remunerada',   52.0, 1,  NOW()),
  ((SELECT id_entidad FROM entidad_financiera WHERE nombre = 'Lemon Cash'      LIMIT 1), 'Inversión', 'Ahorro Remunerado',   51.5, 1,  NOW()),
  ((SELECT id_entidad FROM entidad_financiera WHERE nombre = 'Naranja X'       LIMIT 1), 'Inversión', 'FCI Money Market',    51.0, 1,  NOW()),
  ((SELECT id_entidad FROM entidad_financiera WHERE nombre = 'Ualá'            LIMIT 1), 'Inversión', 'Cuenta Remunerada',   50.0, 1,  NOW()),
  ((SELECT id_entidad FROM entidad_financiera WHERE nombre = 'Brubank'         LIMIT 1), 'Inversión', 'Plazo Fijo Digital',  46.0, 30, NOW()),
  ((SELECT id_entidad FROM entidad_financiera WHERE nombre = 'Banco Galicia'   LIMIT 1), 'Inversión', 'Plazo Fijo 30 días',  43.0, 30, NOW()),
  ((SELECT id_entidad FROM entidad_financiera WHERE nombre = 'Banco Santander' LIMIT 1), 'Inversión', 'Plazo Fijo 30 días',  42.5, 30, NOW()),
  ((SELECT id_entidad FROM entidad_financiera WHERE nombre = 'BBVA Argentina'  LIMIT 1), 'Inversión', 'Plazo Fijo 30 días',  42.0, 30, NOW()),
  ((SELECT id_entidad FROM entidad_financiera WHERE nombre = 'Banco Macro'     LIMIT 1), 'Inversión', 'Plazo Fijo 30 días',  41.5, 30, NOW())
ON CONFLICT (id_entidad, tipo_operacion, producto)
DO UPDATE SET tasa_referencia = EXCLUDED.tasa_referencia, actualizado_en = NOW();

-- 5. Seed: alternativas de financiación
INSERT INTO alternativa_mercado (id_entidad, tipo_operacion, producto, tasa_referencia, cft, plazo_dias, actualizado_en)
VALUES
  ((SELECT id_entidad FROM entidad_financiera WHERE nombre = 'Banco Galicia'   LIMIT 1), 'Financiación', 'Préstamo Personal', 96.0,  110.0, 1080, NOW()),
  ((SELECT id_entidad FROM entidad_financiera WHERE nombre = 'Banco Santander' LIMIT 1), 'Financiación', 'Préstamo Personal', 99.0,  114.0, 1080, NOW()),
  ((SELECT id_entidad FROM entidad_financiera WHERE nombre = 'BBVA Argentina'  LIMIT 1), 'Financiación', 'Préstamo Personal', 98.0,  112.0,  730, NOW()),
  ((SELECT id_entidad FROM entidad_financiera WHERE nombre = 'Banco Macro'     LIMIT 1), 'Financiación', 'Préstamo Personal', 102.0, 118.0, 1080, NOW()),
  ((SELECT id_entidad FROM entidad_financiera WHERE nombre = 'Naranja X'       LIMIT 1), 'Financiación', 'Crédito Personal',  125.0, 145.0,  365, NOW()),
  ((SELECT id_entidad FROM entidad_financiera WHERE nombre = 'Mercado Pago'    LIMIT 1), 'Financiación', 'Mercado Crédito',   140.0, 158.0,  365, NOW()),
  ((SELECT id_entidad FROM entidad_financiera WHERE nombre = 'Ualá'            LIMIT 1), 'Financiación', 'Préstamo Personal', 148.0, 165.0,  365, NOW())
ON CONFLICT (id_entidad, tipo_operacion, producto)
DO UPDATE SET tasa_referencia = EXCLUDED.tasa_referencia, cft = EXCLUDED.cft, actualizado_en = NOW();
