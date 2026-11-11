import { describe, expect, it } from "vitest";
import { guidedStart, guidedTurn, type GuidedState } from "../../server/nova/guided.js";

describe("Nova · modo guiado", () => {
  it("recorre la cualificación y produce requisitos de presupuesto", () => {
    let state: GuidedState = guidedStart().state;
    const answers: [string, string[]?][] = [
      ["Quiero una tienda online"],
      ["Vendo cerámica"],
      ["Vender online"],
      ["No"],
      ["", ["Idiomas adicionales", "Asistente con IA"]],
      ["4–6"],
      ["Diseño a medida"],
      ["Sí"],
      ["1 o 2"],
      ["Ninguna"],
      ["Lo antes posible"],
    ];
    let last;
    for (const [text, choices] of answers) {
      last = guidedTurn(state, text, choices ?? []);
      state = last.state;
    }
    last = guidedTurn(state, "Prefiero no decirlo");
    expect(last.quote?.project_type).toBe("ecommerce");
    expect(last.quote?.features).toEqual(expect.arrayContaining(["multilingual", "chatbot_ai", "admin_panel", "integration"]));
    expect(last.quote?.timeline).toBe("rush");
    expect(last.quote?.pages).toBe(5);
    expect(guidedTurn(last.state, "Sí, quiero una propuesta").contact).toBe(true);
  });

  it("adapta las preguntas al tipo de proyecto (sin páginas para automatización)", () => {
    let r = guidedTurn(guidedStart().state, "Automatizar tareas");
    const asked: string[] = [r.state.step];
    for (const a of ["Gestoría", "Ahorrar tiempo", "Sí", "Ninguna en especial", "Ninguna", "3 o más", "Sin prisa"]) {
      r = guidedTurn(r.state, a);
      asked.push(r.state.step);
    }
    expect(asked).not.toContain("pages");
    expect(asked).not.toContain("design");
  });

  it("no inventa respuestas a preguntas abiertas y vuelve a preguntar", () => {
    const r = guidedTurn(guidedStart().state, "¿Cuál es vuestro horario?");
    expect(r.text).toMatch(/modo guiado/);
    expect(r.state.step).toBe("type");
  });
});
