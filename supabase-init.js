// Inicialización compartida de Supabase, usada por juego.js y admin.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

// true solo si ya reemplazaste los valores de ejemplo en supabase-config.js
const configCompletada =
  !!SUPABASE_URL && SUPABASE_URL !== "TU_SUPABASE_URL" &&
  !!SUPABASE_ANON_KEY && SUPABASE_ANON_KEY !== "TU_ANON_KEY";

let clientInstance = null;

if (configCompletada) {
  try {
    clientInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    console.error("No se pudo inicializar Supabase:", e);
  }
}

// CONFIGURADO solo es true si además la inicialización de verdad funcionó
export const CONFIGURADO = configCompletada && clientInstance !== null;
export const supabase = clientInstance;
