import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type OcrResult = {
  emisor: string | null;
  monto: number | null;
  fecha_vencimiento: string | null;
};

const PROMPT = `Sos un procesador de documentos financieros argentinos.
Analizá este documento (factura, boleta o resumen de tarjeta) y extraé:
- emisor: nombre del emisor o empresa (ej: "EPEC", "Ecogas", "Visa Galicia")
- monto: monto total a pagar como número sin símbolos ni separadores (ej: 24580.50)
- fecha_vencimiento: fecha de vencimiento en formato YYYY-MM-DD (ej: "2025-12-03")

Si hay múltiples vencimientos tomá el más próximo.
Respondé ÚNICAMENTE con JSON válido, sin texto adicional:
{"emisor": "...", "monto": 0.00, "fecha_vencimiento": "YYYY-MM-DD"}
Si no encontrás algún campo usá null.`;

function parseResult(text: string): OcrResult {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { emisor: null, monto: null, fecha_vencimiento: null };
  try {
    const p = JSON.parse(match[0]);
    return {
      emisor: p.emisor ?? null,
      monto: p.monto != null ? parseFloat(p.monto) : null,
      fecha_vencimiento: p.fecha_vencimiento ?? null,
    };
  } catch {
    return { emisor: null, monto: null, fecha_vencimiento: null };
  }
}

export async function extractFromDocument(base64: string, mediaType: string): Promise<OcrResult> {
  const isPdf = mediaType === "application/pdf";
  const isImage = /^image\/(jpeg|png|gif|webp)$/.test(mediaType);
  if (!isPdf && !isImage) throw new Error("Formato no soportado. Usá JPG, PNG o PDF.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileBlock: any = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image",    source: { type: "base64", media_type: mediaType,          data: base64 } };

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    messages: [{ role: "user", content: [fileBlock, { type: "text", text: PROMPT }] }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  return parseResult(text);
}
