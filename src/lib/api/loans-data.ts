// Datos de tasas de préstamos personales — actualizado junio 2026
// Fuente: BCRA Régimen de Transparencia · PERSONALES.CSV
// Se usa el producto más representativo (mejor tasa disponible) de cada entidad.
// TNA derivada de: TNA = 12 × ((1 + TEA/100)^(1/12) − 1) × 100
// CFT publicado por el BCRA: incluye TNA + sellos, seguro de vida e ITF según jurisdicción.

export type LoanProduct = {
  id: string;
  entidad: string;
  tipo: "pesos" | "uva";
  tna: number;       // % TNA anual (para UVA: tasa real sobre índice CER)
  tea: number;       // % TEA anual
  cft: number;       // % CFT anual (Costo Financiero Total)
  plazoMax: number;  // meses
  montoMin: number;  // ARS
  montoMax: number;  // ARS
  limiteVariable?: boolean;
  condiciones?: string;
};

// Ordenados de menor a mayor CFT — fuente BCRA junio 2026
export const PESOS_PRODUCTS: LoanProduct[] = [
  {
    id: "bna-pesos",
    entidad: "Banco Nación",
    tipo: "pesos",
    tna: 55.0, tea: 72.9, cft: 93.3,
    plazoMax: 72, montoMin: 100_000, montoMax: 100_000_000,
    condiciones: "Acreditar haberes en BNA",
  },
  {
    id: "macro-pesos",
    entidad: "Banco Macro",
    tipo: "pesos",
    tna: 59.5, tea: 79.6, cft: 102.4,
    plazoMax: 72, montoMin: 5_000, montoMax: 10_000_000,
    condiciones: "Acreditación de haberes",
  },
  {
    id: "ciudad-pesos",
    entidad: "Banco Ciudad",
    tipo: "pesos",
    tna: 70.5, tea: 97.5, cft: 126.7,
    plazoMax: 72, montoMin: 1, montoMax: 40_000_000,
    condiciones: "Clientes con cuenta sueldo",
  },
  {
    id: "santander-pesos",
    entidad: "Santander",
    tipo: "pesos",
    tna: 79.3, tea: 114.9, cft: 150.9,
    plazoMax: 72, montoMin: 10_000, montoMax: 50_000_000,
  },
  {
    id: "patagonia-pesos",
    entidad: "Banco Patagonia",
    tipo: "pesos",
    tna: 86.1, tea: 129.6, cft: 171.2,
    plazoMax: 60, montoMin: 10_000, montoMax: 30_000_000,
    condiciones: "Ingreso mínimo requerido",
  },
  {
    id: "bapro-pesos",
    entidad: "Banco Provincia",
    tipo: "pesos",
    tna: 107.0, tea: 178.2, cft: 178.2,
    plazoMax: 36, montoMin: 100_000, montoMax: 50_000_000,
    condiciones: "Relación de dependencia",
  },
  {
    id: "bbva-pesos",
    entidad: "BBVA",
    tipo: "pesos",
    tna: 130.4, tea: 240.5, cft: 323.0,
    plazoMax: 72, montoMin: 1_000, montoMax: 70_000_000,
    condiciones: "Acreditar sueldos en la entidad",
  },
  {
    id: "supervielle-pesos",
    entidad: "Banco Supervielle",
    tipo: "pesos",
    tna: 131.0, tea: 243.9, cft: 339.0,
    plazoMax: 72, montoMin: 10_000, montoMax: 75_000_000,
  },
  {
    id: "galicia-pesos",
    entidad: "Banco Galicia",
    tipo: "pesos",
    tna: 143.6, tea: 283.0, cft: 398.0,
    plazoMax: 72, montoMin: 500, montoMax: 24_800_000,
  },
  {
    id: "naranjax-pesos",
    entidad: "Naranja X",
    tipo: "pesos",
    tna: 151.0, tea: 307.4, cft: 436.4,
    plazoMax: 48, montoMin: 10_000, montoMax: 14_000_000,
    limiteVariable: true,
  },
  {
    // Mercado Pago no figura en BCRA PERSONALES.CSV — opera como PSP; tasa estimada de mercado
    id: "mercadopago-pesos",
    entidad: "Mercado Pago",
    tipo: "pesos",
    tna: 155.0, tea: 350.0, cft: 500.0,
    plazoMax: 24, montoMin: 5_000, montoMax: 2_000_000,
    limiteVariable: true,
  },
  {
    id: "uala-pesos",
    entidad: "Ualá",
    tipo: "pesos",
    tna: 166.0, tea: 391.0, cft: 569.0,
    plazoMax: 24, montoMin: 5_000, montoMax: 14_000_000,
    limiteVariable: true,
  },
];

// Tasas UVA: tasa real aplicada sobre el capital ajustado por CER (inflación).
// Galicia y Banco Provincia: fuente BCRA PERSONALES.CSV junio 2026.
// Resto: estimaciones de mercado — no figuran como préstamos personales UVA en el CSV.
export const UVA_PRODUCTS: LoanProduct[] = [
  {
    id: "bna-uva",
    entidad: "Banco Nación",
    tipo: "uva",
    tna: 5.0, tea: 5.1, cft: 7.8,
    plazoMax: 48, montoMin: 100_000, montoMax: 5_000_000,
    condiciones: "Acreditar haberes en BNA",
  },
  {
    id: "bapro-uva",
    entidad: "Banco Provincia",
    tipo: "uva",
    tna: 25.4, tea: 28.1, cft: 28.1,
    plazoMax: 24, montoMin: 100_000, montoMax: 50_000_000,
    condiciones: "Acreditación de haberes",
  },
  {
    id: "ciudad-uva",
    entidad: "Banco Ciudad",
    tipo: "uva",
    tna: 6.5, tea: 6.7, cft: 9.9,
    plazoMax: 36, montoMin: 50_000, montoMax: 3_000_000,
  },
  {
    id: "galicia-uva",
    entidad: "Banco Galicia",
    tipo: "uva",
    tna: 26.5, tea: 30.0, cft: 37.0,
    plazoMax: 24, montoMin: 500, montoMax: 2_000_000,
  },
  {
    id: "santander-uva",
    entidad: "Santander",
    tipo: "uva",
    tna: 8.5, tea: 8.8, cft: 12.9,
    plazoMax: 36, montoMin: 100_000, montoMax: 4_000_000,
  },
  {
    id: "bbva-uva",
    entidad: "BBVA",
    tipo: "uva",
    tna: 9.0, tea: 9.4, cft: 13.8,
    plazoMax: 36, montoMin: 100_000, montoMax: 3_500_000,
  },
];
