const IS_MOCK = process.env.PROMETEO_MOCK === "true";

const BASE_URL =
  process.env.PROMETEO_ENV === "production"
    ? "https://banking.prometeoapi.net"
    : "https://banking.sandbox.prometeoapi.com";

export type LoginResponse =
  | { status: "logged_in"; key: string }
  | { status: "interaction_required"; field: string; context: string; key: string }
  | { status: "wrong_credentials" }
  | { status: "missing_credentials" }
  | { status: "user_blocked" }
  | { status: "max_sessions_reached" }
  | { status: "error"; message: string };

export type PrometeoAccount = {
  id: string;
  number: string | null;
  name: string;
  branch: string | null;
  currency: string;
  balance: number;
};

// ─── Mock local (cuando PROMETEO_MOCK=true) ───────────────────────────────────

const MOCK_BALANCES: Record<string, number> = {
  galicia:          1_458_320,
  santander:          873_500,
  bbva:             1_230_000,
  macro:              245_700,
  nacion:             512_400,
  bancor:              98_600,
  brubank:             34_200,
  mercadopago:         18_750,
  uala:                47_300,
  "personal-pay":      11_900,
  lemoncash:          128_400,
  naranjax:            63_800,
};

const MOCK_NUMBERS: Record<string, string> = {
  galicia:          "00014583",
  santander:        "00008735",
  bbva:             "00012300",
  macro:            "00002457",
  nacion:           "00005124",
  bancor:           "00000986",
  brubank:          "00000342",
  mercadopago:      "00000187",
  uala:             "00000473",
  "personal-pay":   "00000119",
  lemoncash:        "00001284",
  naranjax:         "00000638",
};

function mockAccounts(provider: string): PrometeoAccount[] {
  const id = provider.replace(/[^a-z0-9]/gi, "");
  const balance = MOCK_BALANCES[provider] ?? 50_000;
  const number  = MOCK_NUMBERS[provider]  ?? "00000500";
  return [
    { id: `${id}-001`, number, name: "Caja de Ahorro", branch: null, currency: "ARS", balance },
  ];
}

// ─── API real ─────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "X-API-Key": process.env.PROMETEO_API_KEY ?? "",
      ...(options.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Prometeo ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// Prometeo devuelve HTTP 403 para wrong_credentials/user_blocked/max_sessions_reached
// — son flujos esperados del login, no errores de red, así que los parseamos normalmente.
async function loginFetch(body: URLSearchParams): Promise<LoginResponse> {
  const res = await fetch(`${BASE_URL}/login/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-API-Key": process.env.PROMETEO_API_KEY ?? "",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 403 || res.ok) {
    return res.json() as Promise<LoginResponse>;
  }
  const text = await res.text();
  throw new Error(`Prometeo ${res.status}: ${text}`);
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export async function loginProvider(
  provider: string,
  username: string,
  password: string,
): Promise<LoginResponse> {
  if (IS_MOCK) {
    return { status: "logged_in", key: `mock:${provider}` };
  }
  return loginFetch(new URLSearchParams({ provider, username, password }));
}

export async function submitInteraction(
  key: string,
  field: string,
  value: string,
): Promise<LoginResponse> {
  if (IS_MOCK) {
    return { status: "logged_in", key };
  }
  return loginFetch(new URLSearchParams({ key, [field]: value }));
}

export async function getAccounts(sessionKey: string): Promise<PrometeoAccount[]> {
  if (IS_MOCK) {
    const provider = sessionKey.startsWith("mock:") ? sessionKey.slice(5) : sessionKey;
    return mockAccounts(provider);
  }
  const res = await apiFetch<{ status: string; accounts: PrometeoAccount[] }>(
    `/account/?key=${encodeURIComponent(sessionKey)}`,
  );
  return res.accounts ?? [];
}
