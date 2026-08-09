# Cómo conectar el juego a Supabase (para admin en tiempo real)

Para que el panel de administrador funcione desde **cualquier dispositivo** y vea
a los jugadores **en tiempo real**, el sitio necesita una base de datos en la nube.
Usamos **Supabase** (Postgres + tiempo real), gratis para este uso.

Este paso se hace **una sola vez**. Lleva unos 10 minutos.

## 1. Creá un proyecto de Supabase

1. Entrá a **https://supabase.com** y creá una cuenta gratis (podés usar GitHub o Google).
2. Hacé clic en **"New project"**.
3. Ponele un nombre (ej: `mcdonalds-juego`), elegí una contraseña de base de datos
   (guardala, no la vas a necesitar para esto pero por las dudas) y una región cercana.
4. Esperá 1-2 minutos a que el proyecto termine de crearse.

## 2. Creá las tablas (SQL)

1. En el menú lateral, andá a **"SQL Editor"**.
2. Hacé clic en **"New query"**.
3. Pegá exactamente este bloque y hacé clic en **"Run"**:

   ```sql
   create extension if not exists pgcrypto;

   -- Tabla de sesión: una sola fila que indica si el juego está en espera o en curso
   create table sesion (
     id int primary key default 1,
     estado text not null default 'espera',
     iniciado_en timestamptz,
     constraint solo_una_fila check (id = 1)
   );
   insert into sesion (id, estado) values (1, 'espera');

   -- Tabla de jugadores
   create table jugadores (
     id uuid primary key default gen_random_uuid(),
     nombre text not null,
     carrera text not null,
     estado text not null default 'esperando', -- esperando | jugando | terminado
     tiempo int,
     aciertos int,
     errores int,
     completado boolean,
     unido_en timestamptz default now(),
     terminado_en timestamptz
   );

   -- Habilitar tiempo real para ambas tablas
   alter publication supabase_realtime add table sesion;
   alter publication supabase_realtime add table jugadores;

   -- Seguridad a nivel de fila (RLS), permisiva a propósito: es una app
   -- sin login, pensada para una actividad de clase.
   alter table sesion enable row level security;
   alter table jugadores enable row level security;

   create policy "lectura publica sesion" on sesion for select using (true);
   create policy "escritura publica sesion" on sesion for update using (true);

   create policy "lectura publica jugadores" on jugadores for select using (true);
   create policy "insercion publica jugadores" on jugadores for insert with check (true);
   create policy "actualizacion publica jugadores" on jugadores for update using (true);
   create policy "borrado publico jugadores" on jugadores for delete using (true);
   ```

4. Si ves "Success. No rows returned", ya está: las tablas y el tiempo real quedaron listos.

⚠️ Estas reglas son **permisivas a propósito** (cualquiera con el link puede leer/escribir),
porque el sitio no tiene un sistema de login — es lo esperable para una actividad de
clase. No las uses para guardar información sensible.

## 3. Copiá la URL y la clave pública (anon key)

1. En el menú lateral, andá a **"Project Settings"** (ícono de engranaje) → **"API"**.
2. Copiá el valor de **"Project URL"**.
3. Copiá el valor de **"anon public"** (dentro de "Project API keys").
4. Pegá los dos valores en el archivo **`supabase-config.js`** de esta carpeta,
   reemplazando `"TU_SUPABASE_URL"` y `"TU_ANON_KEY"`. Guardá el archivo.

¡Listo! Con eso alcanza para que `juego.html` y `admin.html` se conecten.

## 4. Probalo

1. Abrí `admin.html`, ingresá la contraseña (`mcdonalds2026` por defecto, la podés
   cambiar en `admin.js`) y vas a ver la "Sala de espera" vacía.
2. Abrí `juego.html` en otro dispositivo (celular, otra compu), anotate con tu
   nombre y carrera — va a aparecer al instante en el panel admin, sin importar
   desde qué dispositivo lo abriste.
3. Desde el panel, tocá **"▶ Iniciar juego para todos"** — el juego arranca
   automáticamente en todas las pantallas anotadas, sin que nadie toque nada más.

## Cómo funciona el flujo

- **Tabla `sesion`**: una sola fila que guarda si el juego está en `'espera'`
  o `'jugando'`. Todos los jugadores están suscriptos a los cambios de esta
  fila (`postgres_changes` en tiempo real); en cuanto cambia a `'jugando'`,
  arrancan todos a la vez, sin recargar la página.
- **Tabla `jugadores`**: una fila por cada persona anotada, con su nombre,
  carrera y — al terminar — su tiempo, aciertos y errores.
- El panel admin está suscripto a cambios en ambas tablas, por eso los ve
  al instante desde cualquier dispositivo conectado a internet.
