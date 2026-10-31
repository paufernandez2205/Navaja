import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad · Navaja",
};

// BORRADOR. Los textos entre [COMPLETAR] dependen de quién sea el responsable
// legal y tienen que ser revisados por un abogado antes de usar datos reales.
export default function Privacidad() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 font-sans leading-7">
      <h1 className="mb-6 text-3xl font-semibold">Política de privacidad</h1>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Quién es el responsable</h2>
        <p>
          El responsable de la base de datos es [COMPLETAR: razón social, CUIT y
          domicilio]. Navaja presta el servicio técnico como encargado del
          tratamiento.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Qué datos usamos y para qué</h2>
        <p>
          Tu número de teléfono, para enviarte el enlace de calificación de tu
          corte, y la calificación y el comentario que decidas dejar. Solo se
          usan para medir internamente la calidad de la atención. No se
          venden ni se comparten con terceros. [COMPLETAR: plazo de guarda.]
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Tus derechos</h2>
        <p>
          Podés pedir acceder, corregir o borrar tus datos escribiendo a
          [COMPLETAR: email de contacto]. Respondemos los pedidos de acceso en
          un máximo de 10 días corridos y los de corrección o borrado en un
          máximo de 5 días hábiles.
        </p>
        <p className="mt-3">
          El titular de los datos personales tiene la facultad de ejercer el
          derecho de acceso a los mismos en forma gratuita a intervalos no
          inferiores a seis meses, salvo que se acredite un interés legítimo al
          efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley
          Nº 25.326.
        </p>
        <p className="mt-3">
          La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de
          Órgano de Control de la Ley Nº 25.326, tiene la atribución de atender
          las denuncias y reclamos que interpongan quienes resulten afectados en
          sus derechos por incumplimiento de las normas vigentes en materia de
          protección de datos personales.
        </p>
      </section>
    </main>
  );
}
