import { createServerFn } from "@tanstack/react-start";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { LoanProduct } from "./loans-data";

// ─── Parser formato propio (id;entidad;tipo;tna;tea;cft;...) ─────────────────

function parseCustomFormat(text: string): LoanProduct[] {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#"));
  if (lines.length < 2) return [];

  return lines.slice(1).flatMap(line => {
    const cols = line.split(";");
    const [id, entidad, tipo, tna, tea, cft, plazoMax, montoMin, montoMax, limiteVariable, ...condParts] = cols;
    const condiciones = condParts.join(";").trim() || undefined;
    const product: LoanProduct = {
      id:             id.trim(),
      entidad:        entidad.trim(),
      tipo:           tipo.trim() as "pesos" | "uva",
      tna:            parseFloat(tna),
      tea:            parseFloat(tea),
      cft:            parseFloat(cft),
      plazoMax:       parseInt(plazoMax, 10),
      montoMin:       parseInt(montoMin, 10),
      montoMax:       parseInt(montoMax, 10),
      limiteVariable: limiteVariable?.trim() === "true" || undefined,
      condiciones,
    };
    return isNaN(product.tna) ? [] : [product];
  });
}

// ─── Parser formato BCRA ──────────────────────────────────────────────────────
// Columnas: 0=código, 1=Descripción de Entidad, 2=Fecha, 3=Nombre completo,
//           4=Nombre corto, 5=Denominación, 6=montoMax, 7=montoMin,
//           8=plazoMax, 15=TEA, 17=CFT

type AllowedProduct = {
  entityPrefix: string; // inicio del campo "Descripción de Entidad" en mayúsculas
  shortName: string;    // campo "Nombre corto del Préstamo Personal" exacto en mayúsculas
  display: string;      // nombre de display en la UI
  id: string;           // slug para el campo id
};

// Lista exacta de los productos a mostrar, identificados por entidad + nombre corto.
// Si hay varias filas que coinciden (distintos tramos, territorios, etc.)
// se elige la de menor CFT.
const ALLOWED_PRODUCTS: AllowedProduct[] = [
  { entityPrefix: "BANCO DE LA PROVINCIA DE BUENOS AIRES", shortName: "PRESTAMO PERSONAL",        display: "Banco Provincia",   id: "bapro"      },
  { entityPrefix: "BANCO DE LA PROVINCIA DE CORDOBA",      shortName: "PP MULTIDESTINO",          display: "Bancor",            id: "bancor"     },
  { entityPrefix: "BANCO DE LA NACION ARGENTINA",          shortName: "NACION LIBRE DESTINO",     display: "Banco Nación",      id: "bna"        },
  { entityPrefix: "BANCO MACRO",                           shortName: "PRESTAMOS PERSONALES",     display: "Banco Macro",       id: "macro"      },
  { entityPrefix: "BANCO DE LA CIUDAD DE BUENOS AIRES",    shortName: "CIUDAD VELOZ PLAN SUELDO", display: "Banco Ciudad",      id: "ciudad"     },
  { entityPrefix: "BANCO SANTANDER ARGENTINA",             shortName: "SUPER PRESTAMO PERSONAL",  display: "Santander",         id: "santander"  },
  { entityPrefix: "BANCO PATAGONIA",                       shortName: "PP PLUS",                  display: "Banco Patagonia",   id: "patagonia"  },
  { entityPrefix: "BANCO SUPERVIELLE",                     shortName: "PP",                       display: "Banco Supervielle", id: "supervielle"},
  { entityPrefix: "BANCO BBVA ARGENTINA",                  shortName: "PRESTAMO PERSONAL",        display: "BBVA",              id: "bbva"       },
  { entityPrefix: "BANCO DE GALICIA Y BUENOS AIRES",       shortName: "PP",                       display: "Banco Galicia",     id: "galicia"    },
  { entityPrefix: "NARANJA DIGITAL",                       shortName: "PRESTAMOS PERSONALES",     display: "Naranja X",         id: "naranjax"   },
  { entityPrefix: "UALA BANK",                             shortName: "PRESTAMOS",                display: "Ualá",              id: "uala"       },
  { entityPrefix: "MERCADOLIBRE",                          shortName: "PRESTAMO PERSONAL",        display: "Mercado Pago",      id: "mercadopago"},
  { entityPrefix: "BRUBANK",                               shortName: "PP RIESGO MEDIO BAJO",     display: "Brubank",           id: "brubank"    },
];

function findProduct(entityName: string, shortName: string): AllowedProduct | null {
  const upperEntity = entityName.trim().toUpperCase();
  const upperShort  = shortName.trim().toUpperCase();
  for (const p of ALLOWED_PRODUCTS) {
    if (upperEntity.startsWith(p.entityPrefix) && upperShort === p.shortName) return p;
  }
  return null;
}

function parseBcraFloat(s: string): number {
  const n = parseFloat((s ?? "").trim().replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function parseBcraInt(s: string): number {
  const n = parseInt((s ?? "").trim(), 10);
  return isNaN(n) ? 0 : n;
}

function teaToTna(tea: number): number {
  if (tea <= 0) return 0;
  return Math.round(12 * (Math.pow(1 + tea / 100, 1 / 12) - 1) * 1000) / 10;
}

function parseBcraFormat(text: string): LoanProduct[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  type Row = { product: AllowedProduct; montoMax: number; montoMin: number; plazoMax: number; tea: number; cft: number };

  const rows: Row[] = lines.slice(1).flatMap(line => {
    const c = line.split(";");
    if ((c[5] ?? "").trim() !== "Pesos") return [];

    const product = findProduct(c[1] ?? "", c[4] ?? "");
    if (!product) return [];

    const tea = parseBcraFloat(c[15] ?? "");
    const cft = parseBcraFloat(c[17] ?? "");
    if (tea <= 0 || cft <= 0) return [];

    return [{ product, montoMax: parseBcraInt(c[6]), montoMin: parseBcraInt(c[7]), plazoMax: parseBcraInt(c[8]), tea, cft }];
  });

  // Por cada producto, quedarse con la fila de menor CFT
  const groups = new Map<string, Row>();
  for (const r of rows) {
    const ex = groups.get(r.product.id);
    if (!ex || r.cft < ex.cft) groups.set(r.product.id, r);
  }

  return Array.from(groups.values()).map(r => ({
    id:       `${r.product.id}-pesos`,
    entidad:  r.product.display,
    tipo:     "pesos" as const,
    tna:      teaToTna(r.tea),
    tea:      r.tea,
    cft:      r.cft,
    plazoMax: r.plazoMax,
    montoMin: r.montoMin,
    montoMax: r.montoMax,
  }));
}

// ─── Server function ──────────────────────────────────────────────────────────

export const getLoanProducts = createServerFn({ method: "GET" }).handler(async () => {
  const csvPath = path.join(process.cwd(), "data", "personales.csv");
  const buf = await fs.readFile(csvPath);

  // Quitar BOM si está presente
  const offset = (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) ? 3 : 0;
  const raw = buf.slice(offset);

  // Detectar formato por número de columnas (insensible al encoding)
  // BCRA tiene 21 columnas; el formato propio empieza con "id;"
  const firstLine = raw.toString("utf-8").trimStart().split(/\r?\n/)[0] ?? "";
  const isBcra = !firstLine.startsWith("id;") && firstLine.split(";").length >= 15;

  // BCRA usa Windows-1252 / Latin-1; el formato propio es UTF-8
  const text = isBcra ? raw.toString("latin1") : raw.toString("utf-8");

  const all = isBcra ? parseBcraFormat(text) : parseCustomFormat(text);

  return {
    pesos: all.filter(p => p.tipo === "pesos").sort((a, b) => a.cft - b.cft),
    uva:   all.filter(p => p.tipo === "uva").sort((a, b) => a.cft - b.cft),
  };
});
