import { createServerFn } from "@tanstack/react-start";
import { getDb } from "../db.server";

// ─── ArgentinaDatos — Tasas Plazo Fijo ───────────────────────────────────────

type ArgDatosRate = {
  entidad: string;
  logo: string | null;
  tnaClientes: number;      // decimal, e.g. 0.19 = 19%
  tnaNoClientes: number;
  enlace: string | null;
  condicionesCorto: string | null;
};

export type PlazofijRate = {
  entidad: string;
  logo: string | null;
  tnaClientes: number;      // percentage, e.g. 19.0
  tnaNoClientes: number;
  tea: number;              // percentage, computed from tnaClientes
  enlace: string | null;
  condicionesCorto: string | null;
};

const ENTITY_NAMES: Record<string, string> = {
  "BANCO DE LA NACION ARGENTINA":                             "Banco Nación",
  "BANCO DE GALICIA Y BUENOS AIRES S.A.":                    "Banco Galicia",
  "BANCO BBVA ARGENTINA S.A.":                               "BBVA Argentina",
  "BANCO SANTANDER ARGENTINA S.A.":                          "Santander Argentina",
  "BANCO DE LA PROVINCIA DE BUENOS AIRES":                   "Banco Provincia",
  "BANCO MACRO S.A.":                                        "Banco Macro",
  "INDUSTRIAL AND COMMERCIAL BANK OF CHINA (ARGENTINA) S.A.U.": "ICBC Argentina",
  "BANCO DE LA CIUDAD DE BUENOS AIRES":                      "Banco Ciudad",
  "BANCO PATAGONIA S.A.":                                    "Banco Patagonia",
  "BANCO CREDICOOP COOPERATIVO LIMITADO":                    "Banco Credicoop",
  "BANCO BICA S.A.":                                         "Banco Bica",
  "BANCO CMF S.A.":                                          "Banco CMF",
  "BANCO COMAFI SOCIEDAD ANONIMA":                           "Banco Comafi",
  "BANCO DE COMERCIO S.A.":                                  "Banco de Comercio",
  "BANCO DE FORMOSA S.A.":                                   "Banco de Formosa",
  "BANCO DE LA PROVINCIA DE CORDOBA S.A.":                   "Bancor",
  "BANCO DEL CHUBUT S.A.":                                   "Banco del Chubut",
  "BANCO DEL SOL S.A.":                                      "Banco del Sol",
  "BANCO DINO S.A.":                                         "Banco Dino",
  "BANCO HIPOTECARIO S.A.":                                  "Banco Hipotecario",
  "BANCO JULIO SOCIEDAD ANONIMA":                            "Banco Julio",
  "BANCO MARIVA S.A.":                                       "Banco Mariva",
  "BANCO MASVENTAS S.A.":                                    "Banco Masventas",
  "BANCO MERIDIAN S.A.":                                     "Banco Meridian",
  "BANCO PROVINCIA DE TIERRA DEL FUEGO":                     "Banco Tierra del Fuego",
  "BANCO VOII S.A.":                                         "Banco VOII",
  "BIBANK S.A.":                                             "BiBanK",
  "CRÉDITO REGIONAL COMPAÑÍA FINANCIERA S.A.U.":            "Crédito Regional",
  "REBA COMPANIA FINANCIERA S.A.":                           "REBA Financiera",
  "Banco Piano":                                             "Banco Piano",
  "Brubank":                                                 "Brubank",
  "UALA":                                                    "Ualá",
};

// ─── ArgentinaDatos — Cuentas Remuneradas / Billeteras ───────────────────────

type ArgDatosCuenta = {
  fondo: string;
  tna: number;
  tope: number | null;
  fecha: string;
  condiciones: string | null;
  condicionesCorto: string | null;
};

export type CuentaRemunRate = {
  nombre: string;
  tna: number;              // percentage, e.g. 27
  tea: number;              // percentage
  tope: string | null;      // cap formatted, e.g. "hasta $1M"
  fecha: string;
  condicionesCorto: string | null;
};

const CUENTA_NAMES: Record<string, string> = {
  "NARANJA X":             "Naranja X",
  "UALA":                  "Ualá",
  "UALA PLUS 1":           "Ualá Plus",
  "UALA PLUS 2":           "Ualá Plus (max)",
  "BRUBANK":               "Brubank",
  "FIWIND":                "Fiwind",
  "BELO":                  "Belo",
  "CARREFOUR BANCO":       "Carrefour Banco",
  "BNA":                   "Banco Nación",
  "SUPERVIELLE":           "Banco Supervielle",
  "SUPERVIELLE HIT IOL":   "Supervielle Hit IOL",
  "MONTEMAR PAY":          "Montemar Pay",
  "CRESIUM":               "Cresium",
  "BICA CUENTA POSITIVA 1": "Banco Bica (> $20M)",
  "BICA CUENTA POSITIVA 2": "Banco Bica ($2.25M–$20M)",
  "BICA CUENTA POSITIVA 3": "Banco Bica ($750K–$2.25M)",
  "BICA CUENTA POSITIVA 4": "Banco Bica (hasta $750K)",
};

function formatTope(tope: number | null): string | null {
  if (tope === null) return null;
  if (tope >= 1_000_000) return `hasta $${(tope / 1_000_000).toFixed(0)}M`;
  if (tope >= 1_000)     return `hasta $${(tope / 1_000).toFixed(0)}K`;
  return `hasta $${tope}`;
}

export const getCuentasRemuneradas = createServerFn({ method: "GET" }).handler(async () => {
  const res = await fetch("https://api.argentinadatos.com/v1/finanzas/fci/otros/ultimo", {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`ArgentinaDatos respondió ${res.status}`);
  const data = (await res.json()) as ArgDatosCuenta[];
  return data
    .filter((r) => r.tna > 0)
    .map((r): CuentaRemunRate => ({
      nombre:          CUENTA_NAMES[r.fondo] ?? r.fondo,
      tna:             Math.round(r.tna * 10000) / 100,
      tea:             tnaToTea(r.tna * 100),
      tope:            formatTope(r.tope),
      fecha:           r.fecha,
      condicionesCorto: r.condicionesCorto ?? null,
    }))
    .sort((a, b) => b.tna - a.tna);
});

export const getPlazofijo = createServerFn({ method: "GET" }).handler(async () => {
  const res = await fetch("https://api.argentinadatos.com/v1/finanzas/tasas/plazoFijo", {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`ArgentinaDatos respondió ${res.status}`);
  const data = (await res.json()) as ArgDatosRate[];
  return data
    .map((r): PlazofijRate => ({
      entidad:         ENTITY_NAMES[r.entidad] ?? r.entidad,
      logo:            r.logo ? r.logo.replace("http://", "https://") : null,
      tnaClientes:     Math.round(r.tnaClientes    * 10000) / 100,
      tnaNoClientes:   Math.round(r.tnaNoClientes  * 10000) / 100,
      tea:             tnaToTea(r.tnaClientes * 100),
      enlace:          r.enlace    ?? null,
      condicionesCorto: r.condicionesCorto ?? null,
    }))
    .sort((a, b) => b.tnaClientes - a.tnaClientes);
});

export type InvestmentRate = {
  id_alternativa: number;
  entidad: string;
  tipo_entidad: string;
  producto: string;
  tea: number;
  plazo_dias: number;
  actualizado_en: string;
};

export type FinancingRate = {
  id_alternativa: number;
  entidad: string;
  tipo_entidad: string;
  producto: string;
  tea: number;
  cft: number;
  plazo_dias: number;
  actualizado_en: string;
};

export const getInvestmentRates = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  const result = await db.query<InvestmentRate>(`
    SELECT
      am.id_alternativa,
      ef.nombre          AS entidad,
      ef.tipo_entidad,
      am.producto,
      am.tasa_referencia::float AS tea,
      am.plazo_dias,
      am.actualizado_en::text
    FROM alternativa_mercado am
    JOIN entidad_financiera ef ON ef.id_entidad = am.id_entidad
    WHERE am.tipo_operacion = 'Inversión'
    ORDER BY am.tasa_referencia DESC
  `);
  return result.rows;
});

export const getFinancingRates = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  const result = await db.query<FinancingRate>(`
    SELECT
      am.id_alternativa,
      ef.nombre          AS entidad,
      ef.tipo_entidad,
      am.producto,
      am.tasa_referencia::float AS tea,
      am.cft::float      AS cft,
      am.plazo_dias,
      am.actualizado_en::text
    FROM alternativa_mercado am
    JOIN entidad_financiera ef ON ef.id_entidad = am.id_entidad
    WHERE am.tipo_operacion = 'Financiación'
    ORDER BY am.cft ASC
  `);
  return result.rows;
});

// ─── Metodología de spreads ──────────────────────────────────────────────────
//
// INVERSIONES — spread aditivo sobre BADLAR privada (Variable 35 BCRA)
//   TEA = tnaToTea(BADLAR + tnaSpread)
//
//   La BADLAR es la tasa que los bancos pagan por depósitos mayoristas >$1M.
//   Los spreads reflejan el diferencial observado entre tasa mayorista y
//   las tasas minoristas publicadas por cada tipo de entidad:
//   - FCI money market: invierten en pases del BCRA, superan levemente la BADLAR
//   - Bancos privados: ofrecen menos que la BADLAR para depósitos minoristas
//
// FINANCIACIONES — spread multiplicativo sobre Tasa de Política Monetaria (Variable 6 BCRA)
//   CFT = tnaToTea(policyTNA × lendMult) × cftMult
//
//   Las tasas activas bancarias están más correlacionadas con la tasa de
//   política que con la BADLAR. El cftMult incorpora impuesto de sellos,
//   seguro de vida e ITF (típicamente +14–25% sobre la TEA del préstamo).

type InvSpread = { nombre: string; producto: string; tnaSpread: number; plazo: number };
type FinSpread = { nombre: string; producto: string; lendMult: number; cftMult: number; plazo: number };

const INV_SPREADS: InvSpread[] = [
  { nombre: "Mercado Pago",    producto: "Fondo Money Market", tnaSpread: +4, plazo: 1  },
  { nombre: "Personal Pay",    producto: "Cuenta Remunerada",  tnaSpread: +2, plazo: 1  },
  { nombre: "Lemon Cash",      producto: "Ahorro Remunerado",  tnaSpread: +3, plazo: 1  },
  { nombre: "Naranja X",       producto: "FCI Money Market",   tnaSpread: +2, plazo: 1  },
  { nombre: "Ualá",            producto: "Cuenta Remunerada",  tnaSpread: -1, plazo: 1  },
  { nombre: "Brubank",         producto: "Plazo Fijo Digital", tnaSpread: -3, plazo: 30 },
  { nombre: "Banco Galicia",   producto: "Plazo Fijo 30 días", tnaSpread: -6, plazo: 30 },
  { nombre: "Banco Santander", producto: "Plazo Fijo 30 días", tnaSpread: -7, plazo: 30 },
  { nombre: "BBVA Argentina",  producto: "Plazo Fijo 30 días", tnaSpread: -7, plazo: 30 },
  { nombre: "Banco Macro",     producto: "Plazo Fijo 30 días", tnaSpread: -8, plazo: 30 },
];

const FIN_SPREADS: FinSpread[] = [
  { nombre: "Banco Galicia",   producto: "Préstamo Personal", lendMult: 2.40, cftMult: 1.15, plazo: 1080 },
  { nombre: "Banco Santander", producto: "Préstamo Personal", lendMult: 2.50, cftMult: 1.15, plazo: 1080 },
  { nombre: "BBVA Argentina",  producto: "Préstamo Personal", lendMult: 2.45, cftMult: 1.14, plazo:  730 },
  { nombre: "Banco Macro",     producto: "Préstamo Personal", lendMult: 2.55, cftMult: 1.16, plazo: 1080 },
  { nombre: "Naranja X",       producto: "Crédito Personal",  lendMult: 3.10, cftMult: 1.25, plazo:  365 },
  { nombre: "Mercado Pago",    producto: "Mercado Crédito",   lendMult: 3.50, cftMult: 1.20, plazo:  365 },
  { nombre: "Ualá",            producto: "Préstamo Personal", lendMult: 3.70, cftMult: 1.22, plazo:  365 },
];

// TNA (% anual, capitalización diaria) → TEA (% anual)
function tnaToTea(tna: number): number {
  return Math.round((Math.pow(1 + tna / 100 / 365, 365) - 1) * 1000) / 10;
}

// ─── Fetcher genérico para variables del BCRA ────────────────────────────────
async function fetchBCRAVariable(variableId: number, desde: string, hasta: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.bcra.gob.ar/estadisticas/v3.0/datosvariable/${variableId}/${desde}/${hasta}`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: { valor: number }[] };
    const results = json.results ?? [];
    if (results.length === 0) return null;
    return results[results.length - 1].valor;
  } catch {
    return null;
  }
}

export const refreshRates = createServerFn({ method: "POST" }).handler(async () => {
  const today = new Date();
  const since = new Date(today);
  since.setDate(since.getDate() - 10);
  const desde = since.toISOString().slice(0, 10);
  const hasta = today.toISOString().slice(0, 10);

  // Obtener ambas variables del BCRA en paralelo
  const [policyTNA, badlarTNA] = await Promise.all([
    fetchBCRAVariable(6,  desde, hasta), // Tasa de política monetaria
    fetchBCRAVariable(35, desde, hasta), // BADLAR bancos privados
  ]);

  // Base para inversiones: BADLAR real, o política × 0.80 como proxy histórico
  const investBase = badlarTNA ?? (policyTNA !== null ? policyTNA * 0.80 : null);
  // Base para financiaciones: tasa de política monetaria
  const finBase = policyTNA;

  const db = getDb();
  const now = new Date();
  let updatedInv = 0;
  let updatedFin = 0;

  // Actualizar tasas de inversión sobre BADLAR (spreads aditivos en TNA)
  if (investBase !== null) {
    for (const s of INV_SPREADS) {
      const entityTNA = Math.max(investBase + s.tnaSpread, 0.1);
      const tea = tnaToTea(entityTNA);
      const { rowCount } = await db.query(
        `UPDATE alternativa_mercado am
            SET tasa_referencia = $1, actualizado_en = $2
           FROM entidad_financiera ef
          WHERE am.id_entidad    = ef.id_entidad
            AND ef.nombre        = $3
            AND am.tipo_operacion = 'Inversión'
            AND am.producto      = $4`,
        [tea, now, s.nombre, s.producto],
      );
      updatedInv += rowCount ?? 0;
    }
  }

  // Actualizar tasas de financiación sobre tasa de política (spreads multiplicativos)
  if (finBase !== null) {
    for (const s of FIN_SPREADS) {
      const lendTNA = finBase * s.lendMult;
      const tea = tnaToTea(lendTNA);
      const cft = Math.round(tea * s.cftMult * 10) / 10;
      const { rowCount } = await db.query(
        `UPDATE alternativa_mercado am
            SET tasa_referencia = $1, cft = $2, actualizado_en = $3
           FROM entidad_financiera ef
          WHERE am.id_entidad    = ef.id_entidad
            AND ef.nombre        = $4
            AND am.tipo_operacion = 'Financiación'
            AND am.producto      = $5`,
        [tea, cft, now, s.nombre, s.producto],
      );
      updatedFin += rowCount ?? 0;
    }
  }

  return {
    policyTNA,
    badlarTNA,
    investBase,
    badlarOk: badlarTNA !== null,
    policyOk: policyTNA !== null,
    updatedInv,
    updatedFin,
    updatedAt: now.toISOString(),
  };
});
