/* ============ moteur d'appel IA (résolution modèle + file d'attente) ============ */
import { state } from "./store.js";
import { chat, enqueueLLM as _enqueueLLM } from "./providers.js";

export function resolveModelFor(assistant){
  if(assistant && assistant.providerId && assistant.model){
    return { providerId: assistant.providerId, model: assistant.model };
  }
  const d = state.defaultModel || { providerId: "groq", model: "" };
  return { providerId: d.providerId, model: d.model };
}
export function hasUsableModel(){
  const d = state.defaultModel || {};
  return !!d.model;
}
export { chat, _enqueueLLM as enqueueLLM };
