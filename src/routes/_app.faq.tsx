import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/_app/faq")({
  component: FAQ,
});

const sections = [
  {
    title: "Tasas de interés",
    items: [
      {
        q: "¿Qué es la TNA (Tasa Nominal Anual)?",
        a: `La TNA es el porcentaje anual que una entidad financiera usa como punto de partida para calcular intereses, pero no refleja cómo se acumulan con el tiempo.

Ejemplo: si un plazo fijo ofrece TNA 30% y lo colocás por 30 días, ganás aproximadamente: $100.000 × 30% × (30/365) = $2.466. No el 30% completo, porque ese porcentaje es anual y vos invertiste solo 30 días.

La TNA sirve para calcular cuánto ganás en períodos cortos, pero no alcanza para comparar dos productos de distinta duración o frecuencia de acreditación.`,
      },
      {
        q: "¿Qué es la TEA (Tasa Efectiva Anual)?",
        a: `La TEA es lo que realmente ganarías si renovaras la inversión todos los meses durante un año entero, sumando los intereses que se generan sobre los intereses anteriores (capitalización).

Ejemplo: una TNA de 30% con capitalización mensual equivale a una TEA de aproximadamente 34,5%. Esa diferencia es el efecto del interés compuesto.

La TEA es el número correcto para comparar inversiones con distintos plazos o frecuencias de acreditación, como un plazo fijo de 30 días versus una cuenta remunerada con acreditación diaria.`,
      },
      {
        q: "¿Qué es el CFT (Costo Financiero Total)?",
        a: `El CFT es el costo real de un préstamo. Incluye la TEA más todos los gastos adicionales que cobra el banco:

• Impuesto de sellos (varía por provincia)
• Seguro de vida obligatorio
• ITF (Impuesto a las Transacciones Financieras)
• Gastos administrativos

El CFT siempre es mayor que la TEA. Si un banco anuncia una TEA del 80% en un préstamo personal, el CFT real puede estar cerca del 100% o más. En Primus, el ranking de financiaciones está ordenado por CFT de menor a mayor, que es la única comparación justa entre entidades.`,
      },
      {
        q: "¿Cuál es la diferencia entre TNA, TEA y CFT?",
        a: `Las tres miden tasas, pero sirven para cosas distintas:

TNA → punto de partida, sin capitalización ni costos extra. Útil solo para calcular intereses de corto plazo en productos simples (como un plazo fijo a 30 días).

TEA → incluye el efecto de la capitalización. Es el número correcto para comparar inversiones entre sí.

CFT → incluye la TEA más todos los costos del crédito (impuestos, seguros). Es el único número relevante cuando pedís un préstamo.

Regla práctica: para invertir, mirá la TEA. Para pedir plata prestada, mirá el CFT.`,
      },
    ],
  },
  {
    title: "Interés simple e interés compuesto",
    items: [
      {
        q: "¿Qué es el interés simple?",
        a: `El interés simple se calcula siempre sobre el capital original, sin importar cuánto tiempo pase.

Ejemplo: si ponés $100.000 a una TNA del 36% durante 30 días:
Ganancia = $100.000 × 36% × (30 / 365) = $2.959

Si renovás ese plazo fijo el mes siguiente, volvés a calcular sobre los mismos $100.000 originales (no sobre $102.959). Los plazos fijos tradicionales usan interés simple.`,
      },
      {
        q: "¿Qué es el interés compuesto?",
        a: `El interés compuesto se calcula sobre el capital más los intereses ya acumulados. Es decir, los intereses generan más intereses con el tiempo.

Ejemplo: si una cuenta remunerada acredita intereses diariamente a una TEA del 40%, al día 2 ya estás ganando intereses sobre los del día 1. Al cabo de un año, la diferencia con el interés simple puede ser muy significativa.

Las cuentas remuneradas y los fondos money market usan capitalización diaria, por eso conviene comparar sus tasas usando la TEA (que ya incorpora ese efecto) y no la TNA.`,
      },
    ],
  },
  {
    title: "Inversiones",
    items: [
      {
        q: "¿Qué es un plazo fijo?",
        a: `Un plazo fijo es un depósito bancario por un período mínimo (en Argentina, 30 días). A cambio de dejar el dinero inmovilizado durante ese tiempo, el banco te paga una tasa de interés fija.

Al vencer el plazo, recibís tu capital más los intereses. El dinero en un plazo fijo está garantizado por el SEDESA (Seguro de Garantía de los Depósitos) hasta un monto determinado por normativa del BCRA.

Ventaja: tasa predecible, capital garantizado.
Desventaja: no podés acceder al dinero antes de que venza sin penalización.`,
      },
      {
        q: "¿Qué es una cuenta remunerada?",
        a: `Una cuenta remunerada (también llamada cuenta de ahorro remunerada o billetera digital con rendimiento) acredita intereses automáticamente, generalmente de forma diaria, sobre el saldo disponible.

La ventaja principal frente al plazo fijo es la liquidez total: podés retirar tu dinero en cualquier momento sin perder los intereses ya acumulados. La desventaja es que la tasa puede cambiar sin previo aviso.

Muchas billeteras digitales (Ualá, Naranja X, Brubank, etc.) ofrecen este tipo de producto como alternativa de corto plazo para no dejar el dinero parado en una caja de ahorro sin rendimiento.`,
      },
    ],
  },
  {
    title: "Créditos y préstamos",
    items: [
      {
        q: "¿Qué es un préstamo personal?",
        a: `Un préstamo personal es un crédito de consumo sin destino específico: el banco o entidad financiera te presta una suma de dinero y vos la devolvés en cuotas mensuales fijas durante un plazo acordado.

El costo total depende del CFT (Costo Financiero Total), que incluye intereses, impuestos y seguros. A diferencia de un crédito hipotecario o prendario, no requiere garantía real (como un inmueble o un vehículo), por eso sus tasas suelen ser más altas.`,
      },
      {
        q: "¿Qué es una cuota y cómo se calcula?",
        a: `La cuota mensual de un préstamo es el importe fijo que pagás cada mes hasta cancelar la deuda. En Argentina, la mayoría de los préstamos personales usa el Sistema Francés: las cuotas son siempre iguales, pero al principio pagás más intereses y menos capital; hacia el final, pagás más capital y menos intereses.

El monto de cada cuota depende de tres factores: el capital prestado, la tasa (CFT) y el plazo en meses. Por eso, el comparador de financiaciones de Primus te permite ajustar los tres para ver cómo cambia la cuota.`,
      },
      {
        q: "¿Por qué el CFT es siempre mayor que la TEA en un préstamo?",
        a: `Porque el CFT incluye costos que la TEA no contempla. La TEA solo mide el interés puro. Pero cuando pedís un préstamo también pagás:

• Impuesto de sellos: varía según la provincia (en Buenos Aires ronda el 1% del capital).
• Seguro de vida: obligatorio por regulación del BCRA, cubre el saldo deudor en caso de fallecimiento.
• ITF (Impuesto a las Transacciones Financieras): se aplica sobre cada débito de tu cuenta.

La diferencia entre TEA y CFT puede ser del 20% al 40% adicional. Por eso nunca compares préstamos usando solo la TEA anunciada.`,
      },
    ],
  },
  {
    title: "Gestión financiera personal",
    items: [
      {
        q: "¿Qué es el Cash Flow (flujo de caja)?",
        a: `El Cash Flow, o flujo de caja, es la diferencia entre el dinero que entra y el que sale en un período determinado.

Cash Flow = Ingresos − Gastos

Si tus ingresos del mes son $500.000 y tus gastos totales son $420.000, tu flujo de caja es positivo en $80.000. Si es negativo, estás gastando más de lo que ingresás.

Primus proyecta tu Cash Flow a 7, 14 y 30 días considerando tus obligaciones registradas, para que puedas anticiparte a períodos de escasez antes de que ocurran.`,
      },
      {
        q: "¿Qué es la liquidez?",
        a: `La liquidez es qué tan rápido podés convertir un activo en efectivo sin perder valor.

• Alta liquidez: dinero en cuenta corriente o caja de ahorro (disponible al instante).
• Liquidez media: cuenta remunerada o fondo money market (disponible en horas o al día siguiente).
• Baja liquidez: plazo fijo (tenés que esperar al vencimiento), o un inmueble (venderlo puede llevar meses).

Tener buena liquidez no significa tener mucho dinero, sino tener acceso rápido a fondos cuando los necesitás. Una empresa o persona puede ser rentable pero quebrar por falta de liquidez.`,
      },
      {
        q: "¿Qué son los fondos ociosos?",
        a: `Los fondos ociosos son el dinero disponible que no está trabajando para vos: no genera intereses ni rendimiento, y en un contexto inflacionario, su valor real disminuye con el tiempo.

En Primus, se calculan como: Saldo consolidado − Vencimientos próximos pendientes.

Si tenés fondos ociosos, es señal de que podrías colocar ese excedente en una cuenta remunerada o un plazo fijo para que no pierda valor frente a la inflación. El objetivo no es tener cero fondos ociosos, sino mantener una reserva de liquidez razonable e invertir el resto.`,
      },
      {
        q: "¿Qué es la inflación y por qué importa al invertir?",
        a: `La inflación es el aumento generalizado y sostenido de los precios. Si la inflación anual es del 100%, un producto que hoy cuesta $1.000 va a costar $2.000 en un año.

Esto afecta directamente tus ahorros: si tenés $100.000 guardados sin rendimiento, al año siguiente ese dinero va a valer la mitad en términos de lo que podés comprar con él.

Por eso, la tasa de interés que buscás en una inversión siempre debe compararse con la inflación. Si ganás 80% anual pero la inflación es 100%, estás perdiendo poder adquisitivo aunque nominalmente hayas ganado dinero.`,
      },
      {
        q: "¿Qué es el BCRA?",
        a: `El BCRA (Banco Central de la República Argentina) es el organismo público que regula y supervisa el sistema financiero argentino. Entre sus funciones principales están:

• Fijar la tasa de política monetaria (que influye en todas las tasas del mercado).
• Regular a bancos y entidades financieras.
• Publicar datos oficiales de tasas a través del Régimen de Transparencia.

Primus utiliza los datos del Régimen de Transparencia del BCRA como fuente para las tasas de financiación mostradas en el comparador de créditos.`,
      },
    ],
  },
];

function FAQ() {
  return (
    <div className="space-y-6 max-w-3xl">

      <Card className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Glosario financiero</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Explicaciones simples de los conceptos que aparecen en Primus, pensadas para cualquier persona sin importar su experiencia financiera.
            </p>
          </div>
        </div>
      </Card>

      {sections.map((section) => (
        <Card key={section.title} className="rounded-2xl border-border p-5 shadow-[var(--shadow-soft)]">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {section.title}
          </h3>
          <Accordion type="multiple" className="space-y-1">
            {section.items.map((item) => (
              <AccordionItem
                key={item.q}
                value={item.q}
                className="rounded-xl border border-border px-4"
              >
                <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline text-left">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      ))}

    </div>
  );
}
