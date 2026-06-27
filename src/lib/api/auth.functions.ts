import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb } from "../db.server";
import {
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getSession,
} from "../session.server";

const RegisterSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Debe contener una mayúscula")
    .regex(/[a-z]/, "Debe contener una minúscula")
    .regex(/[0-9]/, "Debe contener un número")
    .regex(/[^A-Za-z0-9]/, "Debe contener un carácter especial"),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerUser = createServerFn({ method: "POST" })
  .inputValidator(RegisterSchema)
  .handler(async ({ data }) => {
    const db = getDb();

    const existing = await db.query(
      "SELECT id_usuario FROM usuario WHERE email = $1",
      [data.email],
    );
    if (existing.rows.length > 0) {
      throw new Error("EMAIL_TAKEN");
    }

    const hash = await bcrypt.hash(data.password, 12);
    const result = await db.query(
      "INSERT INTO usuario (email, password_hash) VALUES ($1, $2) RETURNING id_usuario, email",
      [data.email, hash],
    );

    const user = result.rows[0] as { id_usuario: number; email: string };
    const token = await createSessionToken({ userId: user.id_usuario, email: user.email });
    setSessionCookie(token);

    return { userId: user.id_usuario, email: user.email };
  });

export const loginUser = createServerFn({ method: "POST" })
  .inputValidator(LoginSchema)
  .handler(async ({ data }) => {
    const db = getDb();

    const result = await db.query(
      "SELECT id_usuario, email, password_hash, failed_attempts, locked_until FROM usuario WHERE email = $1",
      [data.email],
    );

    if (result.rows.length === 0) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const user = result.rows[0] as {
      id_usuario: number;
      email: string;
      password_hash: string;
      failed_attempts: number;
      locked_until: Date | null;
    };

    if (user.locked_until && user.locked_until > new Date()) {
      throw new Error("ACCOUNT_LOCKED");
    }

    const valid = await bcrypt.compare(data.password, user.password_hash);
    if (!valid) {
      const newAttempts = (user.failed_attempts ?? 0) + 1;
      if (newAttempts >= 5) {
        await db.query(
          "UPDATE usuario SET failed_attempts = $1, locked_until = NOW() + INTERVAL '15 minutes' WHERE id_usuario = $2",
          [newAttempts, user.id_usuario],
        );
        throw new Error("ACCOUNT_LOCKED");
      }
      await db.query(
        "UPDATE usuario SET failed_attempts = $1 WHERE id_usuario = $2",
        [newAttempts, user.id_usuario],
      );
      throw new Error("INVALID_CREDENTIALS");
    }

    await db.query(
      "UPDATE usuario SET failed_attempts = 0, locked_until = NULL WHERE id_usuario = $1",
      [user.id_usuario],
    );

    const token = await createSessionToken({ userId: user.id_usuario, email: user.email });
    setSessionCookie(token);

    return { userId: user.id_usuario, email: user.email };
  });

export const logoutUser = createServerFn({ method: "POST" }).handler(async () => {
  clearSessionCookie();
  return { ok: true };
});

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  return getSession();
});
