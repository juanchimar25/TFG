-- =============================================================
-- Primus FinFlow — Schema inicial
-- Ejecutar una sola vez en el SQL Editor de Neon
-- =============================================================

CREATE TABLE IF NOT EXISTS usuario (
  id_usuario      SERIAL PRIMARY KEY,
  email           VARCHAR(100) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  fecha_registro  TIMESTAMPTZ DEFAULT NOW(),
  failed_attempts SMALLINT DEFAULT 0,
  locked_until    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS entidad_financiera (
  id_entidad   SERIAL PRIMARY KEY,
  nombre       VARCHAR(100) NOT NULL,
  tipo_entidad VARCHAR(50) NOT NULL
    CHECK (tipo_entidad IN ('Banco Tradicional', 'Billetera Virtual'))
);

CREATE TABLE IF NOT EXISTS cuenta (
  id_cuenta    SERIAL PRIMARY KEY,
  id_usuario   INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_entidad   INTEGER NOT NULL REFERENCES entidad_financiera(id_entidad),
  tipo_cuenta  VARCHAR(50) NOT NULL
    CHECK (tipo_cuenta IN ('Caja de Ahorro', 'Cuenta Corriente', 'CVU')),
  saldo_actual NUMERIC(15,2) NOT NULL DEFAULT 0,
  moneda       VARCHAR(3) NOT NULL CHECK (moneda IN ('ARS', 'USD'))
);

CREATE TABLE IF NOT EXISTS transaccion (
  id_transaccion SERIAL PRIMARY KEY,
  id_cuenta      INTEGER NOT NULL REFERENCES cuenta(id_cuenta) ON DELETE CASCADE,
  fecha          TIMESTAMPTZ DEFAULT NOW(),
  monto          NUMERIC(15,2) NOT NULL,
  descripcion    VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS comprobante_ocr (
  id_comprobante    SERIAL PRIMARY KEY,
  id_usuario        INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  emisor            VARCHAR(100),
  monto_total       NUMERIC(15,2),
  fecha_vencimiento TIMESTAMPTZ,
  estado_pago       VARCHAR(20) DEFAULT 'Pendiente'
    CHECK (estado_pago IN ('Pendiente', 'Pagado', 'Vencido'))
);

CREATE TABLE IF NOT EXISTS alternativa_mercado (
  id_alternativa  SERIAL PRIMARY KEY,
  id_entidad      INTEGER NOT NULL REFERENCES entidad_financiera(id_entidad),
  tipo_operacion  VARCHAR(20) NOT NULL
    CHECK (tipo_operacion IN ('Inversión', 'Financiación')),
  tasa_referencia NUMERIC(5,2),
  plazo_dias      INTEGER
);

-- =============================================================
-- Datos de entidades financieras de referencia
-- =============================================================

INSERT INTO entidad_financiera (nombre, tipo_entidad) VALUES
  ('Banco Galicia',   'Banco Tradicional'),
  ('Banco Santander', 'Banco Tradicional'),
  ('BBVA Argentina',  'Banco Tradicional'),
  ('Banco Macro',     'Banco Tradicional'),
  ('Banco Nación',    'Banco Tradicional'),
  ('Bancor',          'Banco Tradicional'),
  ('Brubank',         'Banco Tradicional'),
  ('Mercado Pago',    'Billetera Virtual'),
  ('Ualá',            'Billetera Virtual'),
  ('Personal Pay',    'Billetera Virtual'),
  ('Lemon Cash',      'Billetera Virtual'),
  ('Naranja X',       'Billetera Virtual')
ON CONFLICT (nombre) DO NOTHING;
