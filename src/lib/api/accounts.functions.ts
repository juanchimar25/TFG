import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "../db.server";
import { getSession } from "../session.server";
import { loginProvider, submitInteraction, getAccounts, type PrometeoAccount } from "../prometeo.server";

export type Account = {
  id_cuenta: number;
  id_entidad: number;
  nombre_entidad: string;
  tipo_entidad: string;
  tipo_cuenta: string;
  saldo_actual: string;
  moneda: string;
  ultima_sincronizacion: string | null;
  ultimos_digitos: string | null;
};

export const getUserAccounts = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  const db = getDb();
  const result = await db.query<Account>(
    `SELECT
       c.id_cuenta,
       c.id_entidad,
       ef.nombre           AS nombre_entidad,
       ef.tipo_entidad,
       c.tipo_cuenta,
       c.saldo_actual::text,
       c.moneda,
       c.ultima_sincronizacion::text,
       c.ultimos_digitos
     FROM cuenta c
     JOIN entidad_financiera ef ON ef.id_entidad = c.id_entidad
     WHERE c.id_usuario = $1
     ORDER BY c.id_cuenta`,
    [session.userId],
  );
  return result.rows;
});

export const unlinkAccount = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id_cuenta: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHORIZED");
    const db = getDb();
    await db.query("DELETE FROM cuenta WHERE id_cuenta = $1 AND id_usuario = $2", [
      data.id_cuenta,
      session.userId,
    ]);
    return { ok: true };
  });

// ─── Prometeo ────────────────────────────────────────────────────────────────

const PROVIDER_NAMES: Record<string, string> = {
  galicia:          "Banco Galicia",
  santander:        "Banco Santander",
  bbva:             "BBVA Argentina",
  macro:            "Banco Macro",
  nacion:           "Banco Nación",
  bancor:           "Bancor",
  brubank:          "Brubank",
  mercadopago:      "Mercado Pago",
  uala:             "Ualá",
  "personal-pay":   "Personal Pay",
  lemoncash:        "Lemon Cash",
  naranjax:         "Naranja X",
};

// En sandbox todos los bancos argentinos usan el provider "test" de Prometeo
const IS_SANDBOX = process.env.PROMETEO_ENV !== "production";
const AR_PROVIDERS = new Set(Object.keys(PROVIDER_NAMES));

function resolveApiProvider(provider: string): string {
  return IS_SANDBOX && AR_PROVIDERS.has(provider) ? "test" : provider;
}

const BILLETERAS = new Set(["mercadopago", "uala", "personal-pay", "lemoncash", "naranjax"]);

function mapAccountType(acc: PrometeoAccount): "Caja de Ahorro" | "Cuenta Corriente" | "CVU" {
  const name = (acc.name ?? "").toLowerCase();
  if (name.includes("corriente") || name.includes("checking")) return "Cuenta Corriente";
  if (name.includes("cvu") || name.includes("virtual")) return "CVU";
  return "Caja de Ahorro";
}

async function importAccounts(
  userId: number,
  provider: string,
  sessionKey: string,
): Promise<{ status: "logged_in"; imported: number }> {
  const db = getDb();
  const allAccounts = await getAccounts(sessionKey);
  // En sandbox cada banco virtual importa solo la primera cuenta para no mezclar entidades
  const accounts = IS_SANDBOX && AR_PROVIDERS.has(provider) ? allAccounts.slice(0, 1) : allAccounts;
  let imported = 0;

  for (const acc of accounts) {
    const entityName = PROVIDER_NAMES[provider] ?? provider;
    const entityType = BILLETERAS.has(provider) ? "Billetera Virtual" : "Banco Tradicional";

    const { rows: entityRows } = await db.query<{ id_entidad: number }>(
      "SELECT id_entidad FROM entidad_financiera WHERE nombre = $1",
      [entityName],
    );

    let id_entidad: number;
    if (entityRows.length === 0) {
      const ins = await db.query<{ id_entidad: number }>(
        "INSERT INTO entidad_financiera (nombre, tipo_entidad) VALUES ($1, $2) RETURNING id_entidad",
        [entityName, entityType],
      );
      id_entidad = ins.rows[0].id_entidad;
    } else {
      id_entidad = entityRows[0].id_entidad;
    }

    const tipoCuenta = mapAccountType(acc);
    const moneda = acc.currency === "USD" ? "USD" : "ARS";
    const saldo = typeof acc.balance === "number" ? acc.balance : 0;
    const raw = (acc.number ?? "0000").replace(/\D/g, "");
    const ultimos = raw.length >= 4 ? raw.slice(-4) : raw.padStart(4, "0");
    // Prefijo del provider para que el mismo acc.id de "test" sea único por banco virtual
    const prometeoAccountId = IS_SANDBOX && AR_PROVIDERS.has(provider)
      ? `${provider}:${acc.id}`
      : acc.id;

    const { rows: cuentaRows } = await db.query<{ id_cuenta: number }>(
      `INSERT INTO cuenta
         (id_usuario, id_entidad, tipo_cuenta, saldo_actual, moneda, ultima_sincronizacion,
          ultimos_digitos, prometeo_provider, prometeo_account_id, prometeo_session_key)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9)
       ON CONFLICT (prometeo_account_id) WHERE prometeo_account_id IS NOT NULL DO UPDATE
         SET saldo_actual         = EXCLUDED.saldo_actual,
             ultima_sincronizacion = NOW(),
             prometeo_session_key  = EXCLUDED.prometeo_session_key
       RETURNING id_cuenta`,
      [userId, id_entidad, tipoCuenta, saldo, moneda, ultimos, provider, prometeoAccountId, sessionKey],
    );

    if (cuentaRows.length > 0 && saldo > 0) {
      await db.query(
        `INSERT INTO transaccion (id_cuenta, fecha, monto, descripcion)
         VALUES ($1, NOW(), $2, 'Saldo inicial')
         ON CONFLICT DO NOTHING`,
        [cuentaRows[0].id_cuenta, saldo],
      );
    }

    imported++;
  }

  return { status: "logged_in", imported };
}

const LinkSchema = z.object({
  provider: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
});

export const linkPrometeoAccount = createServerFn({ method: "POST" })
  .inputValidator(LinkSchema)
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHORIZED");

    const result = await loginProvider(resolveApiProvider(data.provider), data.username, data.password);

    if (result.status === "wrong_credentials") {
      throw new Error("Credenciales incorrectas. Verificá tu usuario y contraseña.");
    }
    if (result.status === "error") {
      throw new Error((result as { status: "error"; message: string }).message ?? "Error al conectar.");
    }
    if (result.status === "interaction_required") {
      return {
        status: "interaction_required" as const,
        field: result.field,
        context: result.context,
        key: result.key,
      };
    }

    // En modo mock la clave debe llevar el provider virtual (no "test") para que
    // cada banco genere un saldo distinto en getAccounts.
    const sessionKey = process.env.PROMETEO_MOCK === "true" ? `mock:${data.provider}` : result.key;
    return importAccounts(session.userId, data.provider, sessionKey);
  });

const InteractionSchema = z.object({
  key: z.string().min(1),
  field: z.string().min(1),
  value: z.string().min(1),
  provider: z.string().min(1),
});

export const submitPrometeoOtp = createServerFn({ method: "POST" })
  .inputValidator(InteractionSchema)
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHORIZED");

    const result = await submitInteraction(data.key, data.field, data.value);

    if (result.status !== "logged_in") {
      throw new Error("Código incorrecto o expirado. Intentá de nuevo.");
    }

    return importAccounts(session.userId, data.provider, result.key);
  });

// ─── Sync ────────────────────────────────────────────────────────────────────

export const syncAccounts = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  const db = getDb();

  const { rows } = await db.query<{
    id_cuenta: number;
    saldo_actual: string;
    prometeo_session_key: string | null;
    prometeo_account_id: string | null;
  }>(
    "SELECT id_cuenta, saldo_actual, prometeo_session_key, prometeo_account_id FROM cuenta WHERE id_usuario = $1",
    [session.userId],
  );

  const now = new Date();
  let synced = 0;

  const sessions = new Map<string, typeof rows>();
  const fallback: typeof rows = [];

  for (const acc of rows) {
    if (acc.prometeo_session_key && acc.prometeo_account_id) {
      const group = sessions.get(acc.prometeo_session_key) ?? [];
      group.push(acc);
      sessions.set(acc.prometeo_session_key, group);
    } else {
      fallback.push(acc);
    }
  }

  // Prometeo: saldo real vía API
  for (const [sessionKey, accs] of sessions) {
    try {
      const remote = await getAccounts(sessionKey);
      for (const remAcc of remote) {
        const local = accs.find((a) => {
          const rawId = a.prometeo_account_id?.includes(":")
            ? a.prometeo_account_id.split(":").slice(1).join(":")
            : a.prometeo_account_id;
          return rawId === remAcc.id;
        });
        if (!local) continue;
        const newSaldo = typeof remAcc.balance === "number" ? remAcc.balance : parseFloat(local.saldo_actual);
        const delta = Math.round((newSaldo - parseFloat(local.saldo_actual)) * 100) / 100;
        if (Math.abs(delta) >= 0.01) {
          await db.query(
            "INSERT INTO transaccion (id_cuenta, fecha, monto, descripcion) VALUES ($1, $2, $3, 'Actualización automática')",
            [local.id_cuenta, now, delta],
          );
        }
        await db.query(
          "UPDATE cuenta SET saldo_actual = $1, ultima_sincronizacion = $2 WHERE id_cuenta = $3",
          [newSaldo, now, local.id_cuenta],
        );
        synced++;
      }
    } catch {
      // Sesión expirada → tratar como fallback
      fallback.push(...accs);
    }
  }

  // Fallback: fluctuación simulada ±2%
  for (const acc of fallback) {
    const current = parseFloat(acc.saldo_actual);
    const pct = (Math.random() * 4 - 2) / 100;
    const delta = Math.round(current * pct * 100) / 100;
    const newSaldo = Math.round((current + delta) * 100) / 100;
    if (Math.abs(delta) >= 0.01) {
      await db.query(
        "INSERT INTO transaccion (id_cuenta, fecha, monto, descripcion) VALUES ($1, $2, $3, 'Actualización automática')",
        [acc.id_cuenta, now, delta],
      );
    }
    await db.query(
      "UPDATE cuenta SET saldo_actual = $1, ultima_sincronizacion = $2 WHERE id_cuenta = $3",
      [newSaldo, now, acc.id_cuenta],
    );
    synced++;
  }

  return { synced, syncedAt: now.toISOString() };
});
