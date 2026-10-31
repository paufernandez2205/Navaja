# Navaja

Sistema de valoraciones internas por barbero. Los clientes califican el corte desde el celular, el dueño ve los resultados en un panel privado y se invita a todos por igual a dejar una reseña en Google.

## Cómo está armado

| Pieza | Para qué sirve |
|---|---|
| **Next.js** | Las pantallas y la lógica del servidor, en un solo proyecto. |
| **Supabase** | La base de datos (Postgres) y el login con link mágico. |
| **Netlify** | Publica el sitio en internet cada vez que se sube un cambio a GitHub. |

Carpetas principales:

- `app/` – las pantallas. Cada carpeta es una dirección del sitio (por ejemplo `app/privacidad` es `/privacidad`).
- `lib/` – reglas de negocio, sin pantallas.
- `supabase/migrations/` – los cambios de la base de datos, numerados en orden.
- `tests/` – los controles automáticos.

## Instalar (una sola vez)

1. **Node.js 24 o más nuevo**: bajalo de [nodejs.org](https://nodejs.org) (versión LTS) e instalalo con las opciones por defecto.
2. **Git**: bajalo de [git-scm.com](https://git-scm.com) e instalalo con las opciones por defecto.
3. **VS Code** (opcional, para ver los archivos): [code.visualstudio.com](https://code.visualstudio.com).

Para comprobar que quedaron instalados, abrí una terminal (en Windows: tecla Windows → escribí "PowerShell") y escribí `node --version` y después `git --version`. Cada uno tiene que mostrar un número.

## Correrlo en tu compu

En una terminal abierta en esta carpeta:

1. `npm install` – baja las librerías que usa el proyecto. Solo hace falta la primera vez o cuando cambian.
2. Copiá `.env.example` como `.env.local` y completá los datos de Supabase (ver abajo).
3. `npm run dev` – prende el sitio en tu compu.
4. Abrí `http://localhost:3000` en el navegador.

Para apagarlo: en la terminal, `Ctrl + C`.

## Controles automáticos

- `npm test` – corre los tests.
- `npm run lint` – revisa errores comunes de código.
- `npm run typecheck` – revisa que los tipos de datos sean coherentes.

Los mismos controles corren solos en GitHub cada vez que se sube un cambio.

## Conectar Supabase

1. Creá una cuenta en [supabase.com](https://supabase.com) y un proyecto llamado `navaja-dev` (para pruebas). Más adelante vamos a crear `navaja-prod` para los datos reales.
2. Región: elegí **South America (São Paulo)**, la más cercana.
3. En el proyecto: **Project Settings → API Keys**. Copiá la **Project URL** y la **Publishable key** a tu `.env.local`.

## Publicarlo

1. Subí el proyecto a un repositorio de GitHub.
2. En [netlify.com](https://netlify.com): **Add new site → Import an existing project → GitHub** y elegí el repo. La configuración ya está en `netlify.toml`.
3. En Netlify: **Site configuration → Environment variables**, cargá las mismas variables de `.env.local`.
4. Desde ahí, cada cambio que se sube a la rama `main` se publica solo.

## Privacidad (Ley 25.326)

La página `/privacidad` es un **borrador**. Los textos marcados `[COMPLETAR]` dependen de quién sea el responsable legal y tienen que pasar por un abogado antes de usar datos de clientes reales.
