import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RatingForm } from "@/app/r/[token]/rating-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup(hasGoogleReview = true) {
  const fetchMock = vi.fn(async () => Response.json({ ratingId: "rating-1" }, { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
  render(
    <RatingForm
      token="tok"
      locationName="Boxxes Boutique"
      barberName="Barbero 1"
      barberPhotoUrl={null}
      hasGoogleReview={hasGoogleReview}
    />,
  );
  return fetchMock;
}

describe("pantalla del cliente", () => {
  test("no deja enviar sin elegir estrellas", () => {
    setup();
    expect(screen.getByRole("button", { name: "Enviar" })).toHaveProperty("disabled", true);
  });

  // Prohibido el review gating: el botón de Google es el mismo para todos.
  test.each([1, 2, 3, 4, 5])("con %i estrellas ofrece Google igual que a todos", async (n) => {
    const fetchMock = setup();
    fireEvent.click(screen.getByLabelText(new RegExp(`^${n} estrellas?:`)));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    const google = await screen.findByRole("link", { name: "¿Nos dejás tu reseña en Google?" });
    expect(google.getAttribute("href")).toBe("/g/rating-1");
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent).toEqual({ token: "tok", stars: n, comment: "" });
  });

  test("si el local no cargó su link de Google, no se lo muestra a nadie", async () => {
    setup(false);
    fireEvent.click(screen.getByLabelText(/^5 estrellas:/));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByText("¡Gracias por tu calificación!");
    expect(screen.queryByRole("link", { name: /Google/ })).toBeNull();
  });

  test("muestra el mensaje del servidor si el link ya no vale", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "Este link ya no es válido." }, { status: 409 })),
    );
    render(
      <RatingForm token="tok" locationName="L" barberName="B" barberPhotoUrl={null} hasGoogleReview />,
    );
    fireEvent.click(screen.getByLabelText(/^4 estrellas:/));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Este link ya no es válido."));
  });
});
