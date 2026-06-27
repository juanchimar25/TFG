import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "../db.server";
import { getSession } from "../session.server";

export type Obligation = {
  id_obligacion: number;
  emisor: string;
  monto: string;
  fecha_vencimiento: string;
  pagado: boolean;
};

export type EstadoObligation = "Próximo" | "Urgente" | "Vencido" | "Pagado";

export function computeEstado(fechaVenc: string, pagado: boolean): EstadoObligation {
  if (pagado) return "Pagado";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const venc = new Date(fechaVenc + "T12:00:00");
  const diffDays = Math.ceil((venc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "Vencido";
  if (diffDays <= 3) return "Urgente";
  return "Próximo";
}

export function formatObligationDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export const getObligations = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  const db = getDb();
  const { rows } = await db.query<Obligation>(
    `SELECT id_obligacion, emisor, monto::text, fecha_vencimiento::text, pagado
     FROM obligacion
     WHERE id_usuario = $1
     ORDER BY pagado ASC, fecha_vencimiento ASC`,
    [session.userId],
  );
  return rows;
});

export const addObligation = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    emisor: z.string().min(1),
    monto: z.number().positive(),
    fecha_vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }))
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHORIZED");
    const db = getDb();
    await db.query(
      `INSERT INTO obligacion (id_usuario, emisor, monto, fecha_vencimiento)
       VALUES ($1, $2, $3, $4)`,
      [session.userId, data.emisor, data.monto, data.fecha_vencimiento],
    );
    return { ok: true };
  });

export const deleteObligation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id_obligacion: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHORIZED");
    const db = getDb();
    await db.query(
      "DELETE FROM obligacion WHERE id_obligacion = $1 AND id_usuario = $2",
      [data.id_obligacion, session.userId],
    );
    return { ok: true };
  });

export const extractObligation = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    fileBase64: z.string().min(1),
    mediaType: z.string().min(1),
  }))
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHORIZED");
    const { extractFromDocument } = await import("../ocr.server");
    return extractFromDocument(data.fileBase64, data.mediaType);
  });

export const toggleObligation = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    id_obligacion: z.number().int().positive(),
    pagado: z.boolean(),
  }))
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session) throw new Error("UNAUTHORIZED");
    const db = getDb();
    await db.query(
      "UPDATE obligacion SET pagado = $1 WHERE id_obligacion = $2 AND id_usuario = $3",
      [data.pagado, data.id_obligacion, session.userId],
    );
    return { ok: true };
  });
