#!/usr/bin/env node
/**
 * Transforma el PERSONALES.CSV del BCRA al formato propio de Primus.
 * Mantiene solo las entidades definidas en WANTED_ENTITIES.
 *
 * Uso:
 *   node scripts/update-personales.mjs <ruta-al-bcra-personales.csv>
 *
 * Ejemplo:
 *   node scripts/update-personales.mjs ~/Downloads/PERSONALES.CSV
 *
 * El archivo de salida siempre es data/personales.csv (sobreescribe el actual).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ─── Entidades a mantener ────────────────────────────────────────────────────
// Clave: inicio del nombre en BCRA (mayúsculas); Valor: nombre de display e id
const WANTED_ENTITIES = {
  "BANCO DE LA NACION ARGENTINA":          { display: "Banco Nación",      id: "bna" },
  "BANCO MACRO":                           { display: "Banco Macro",       id: "macro" },
  "BANCO DE LA CIUDAD DE BUENOS AIRES":    { display: "Banco Ciudad",      id: "ciudad" },
  "BANCO SANTANDER ARGENTINA":             { display: "Santander",         id: "santander" },
  "BANCO PATAGONIA":                       { display: "Banco Patagonia",   id: "patagonia" },
  "BANCO DE LA PROVINCIA DE BUENOS AIRES": { display: "Banco Provincia",   id: "bapro" },
  "BANCO BBVA ARGENTINA":                  { display: "BBVA",              id: "bbva" },
  "BANCO SUPERVIELLE":                     { display: "Banco Supervielle", id: "supervielle" },
  "BANCO DE GALICIA Y BUENOS AIRES":       { display: "Banco Galicia",     id: "galicia" },
  "NARANJA DIGITAL":                       { display: "Naranja X",         id: "naranjax" },
  "UALA BANK":                             { display: "Ualá",              id: "uala" },
  "MERCADO CREDITO":                       { display: "Mercado Pago",      id: "mercadopago" },
};

// ─── Filtro de préstamos con destino específico ───────────────────────────────
const SPECIFIC_PURPOSE =
  /\b(AUTO|MOTO|VEHIC|RODADO|HIPOTEC|VIVIEND|INMUEBLE|BICICLET|PANEL SOLAR|TURISMO|ELECTRODOM|INFORMATIC|CONEXION GAS|CONEXION AGUA|ALQUILER|TERRENO|CONSTRUCCION)\b/i;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseBcraFloat(s) {
  const n = parseFloat((s ?? "").trim().replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function parseBcraInt(s) {
  const n = parseInt((s ?? "").trim(), 10);
  return isNaN(n) ? 0 : n;
}

// TEA% → TNA% (capitalización mensual)
function teaToTna(tea) {
  if (tea <= 0) return 0;
  return Math.round(12 * (Math.pow(1 + tea / 100, 1 / 12) - 1) * 1000) / 10;
}

function matchEntity(bcraName) {
  const upper = (bcraName ?? "").trim().toUpperCase();
  for (const [key, info] of Object.entries(WANTED_ENTITIES)) {
    if (upper.startsWith(key)) return info;
  }
  return null;
}

// ─── Lectura del archivo BCRA ─────────────────────────────────────────────────
const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Uso: node scripts/update-personales.mjs <ruta-al-bcra-personales.csv>");
  process.exit(1);
}

let buf;
try {
  buf = readFileSync(resolve(process.cwd(), inputPath));
} catch {
  console.error(`Error: no se pudo leer el archivo: ${inputPath}`);
  process.exit(1);
}

// Quitar BOM y decodificar (BCRA usa Windows-1252 / Latin-1)
const offset = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF ? 3 : 0;
const text = buf.slice(offset).toString("latin1");

const lines = text.split(/\r?\n/).filter(l => l.trim());
if (lines.length < 2) {
  console.error("Error: el archivo no tiene filas de datos.");
  process.exit(1);
}

// Verificar que parece un archivo BCRA (21 columnas en el encabezado)
if (lines[0].split(";").length < 15) {
  console.error("Error: el archivo no tiene el formato esperado del BCRA (menos de 15 columnas).");
  process.exit(1);
}

// ─── Parseo: mejor oferta por (entidad, tipo) según menor CFT ────────────────
// Columnas BCRA: 0=código, 1=entidad, 3=producto, 5=denominación,
//                6=montoMax, 7=montoMin, 8=plazoMax, 13=beneficiario,
//                15=TEA, 17=CFT
const best = new Map();

for (const line of lines.slice(1)) {
  const c = line.split(";");
  const tipo = (c[5] ?? "").trim();
  if (tipo !== "Pesos" && tipo !== "UVA") continue;

  const productName = (c[3] ?? "").trim();
  if (SPECIFIC_PURPOSE.test(productName)) continue;

  const tea = parseBcraFloat(c[15]);
  const cft = parseBcraFloat(c[17]);
  if (tea <= 0 || cft <= 0) continue;

  const entityInfo = matchEntity(c[1]);
  if (!entityInfo) continue;

  const key = `${entityInfo.id}::${tipo}`;
  const existing = best.get(key);
  if (!existing || cft < existing.cft) {
    const beneficiario = (c[13] ?? "").trim();
    best.set(key, {
      entityInfo,
      tipo,
      tna: teaToTna(tea),
      tea,
      cft,
      plazoMax:    parseBcraInt(c[8]),
      montoMin:    parseBcraInt(c[7]),
      montoMax:    parseBcraInt(c[6]),
      condiciones: beneficiario && beneficiario !== "Todos los beneficiarios" ? beneficiario : "",
    });
  }
}

// ─── Construcción del CSV de salida ──────────────────────────────────────────
const pesoRows = [...best.values()]
  .filter(r => r.tipo === "Pesos")
  .sort((a, b) => a.cft - b.cft);

const uvaRows = [...best.values()]
  .filter(r => r.tipo === "UVA")
  .sort((a, b) => a.cft - b.cft);

const csvLines = [
  "# Préstamos Personales — Fuente: BCRA Régimen de Transparencia (PERSONALES.CSV)",
  "# Actualizar este archivo con la versión descargada del BCRA para mantener las tasas vigentes.",
  "# Columnas: id;entidad;tipo;tna;tea;cft;plazoMax;montoMin;montoMax;limiteVariable;condiciones",
  "# tipo: pesos | uva",
  "# limiteVariable: true si el monto máximo depende del perfil del cliente (dejar vacío si no aplica)",
  "# condiciones: texto libre (no usar punto y coma dentro del campo)",
  "id;entidad;tipo;tna;tea;cft;plazoMax;montoMin;montoMax;limiteVariable;condiciones",
];

for (const r of [...pesoRows, ...uvaRows]) {
  const tipo = r.tipo === "Pesos" ? "pesos" : "uva";
  const id = `${r.entityInfo.id}-${tipo}`;
  csvLines.push(
    `${id};${r.entityInfo.display};${tipo};${r.tna.toFixed(1)};${r.tea.toFixed(1)};${r.cft.toFixed(1)};${r.plazoMax};${r.montoMin};${r.montoMax};;${r.condiciones}`
  );
}

const outputPath = resolve(ROOT, "data", "personales.csv");
writeFileSync(outputPath, csvLines.join("\n") + "\n", "utf-8");

// ─── Reporte ──────────────────────────────────────────────────────────────────
console.log(`\n✓ data/personales.csv actualizado.`);
console.log(`  Entidades en pesos: ${pesoRows.length}  |  En UVA: ${uvaRows.length}\n`);

if (pesoRows.length > 0) {
  console.log("Ranking pesos (por CFT ascendente):");
  pesoRows.forEach((r, i) =>
    console.log(`  ${i + 1}. ${r.entityInfo.display.padEnd(20)} TNA ${r.tna.toFixed(1).padStart(6)}%  CFT ${r.cft.toFixed(1).padStart(6)}%`)
  );
}

// Advertir sobre entidades no encontradas en el archivo BCRA
const foundIds = new Set([...best.keys()].map(k => k.split("::")[0]));
const missing = Object.values(WANTED_ENTITIES).filter(e => !foundIds.has(e.id));
if (missing.length > 0) {
  console.log(`\n⚠ No encontradas en el archivo BCRA (no tienen oferta o usan otro nombre):`);
  missing.forEach(e => console.log(`  - ${e.display}`));
}
