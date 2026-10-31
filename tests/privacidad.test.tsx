import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Privacidad from "@/app/privacidad/page";

test("la política incluye las leyendas obligatorias de la Ley 25.326", () => {
  render(<Privacidad />);
  expect(
    screen.getByRole("heading", { level: 1, name: "Política de privacidad" }),
  ).toBeDefined();
  expect(screen.getByText(/artículo 14, inciso 3/)).toBeDefined();
  expect(
    screen.getByText(/AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA/),
  ).toBeDefined();
});
