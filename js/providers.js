/* ============ gestionnaire universel de fournisseurs IA ============
   Chaque fournisseur est un adaptateur : la plupart parlent l'API
   "OpenAI-compatible" (chat/completions + models). Anthropic a son
   propre format, géré par kind:"anthropic". Les serveurs locaux
   (Ollama, LM Studio) utilisent la même API ouverte sur localhost. */
import { getKey } from "./store.js";

export const PROVIDERS = [
  { id: "groq",       label: "Groq",             baseUrl: "https://api.groq.com/openai/v1",                 kind: "openai",    keyUrl: "https://console.groq.com/keys", keyPrefix: "gsk_", help: "Gratuit, très rapide. Recommandé." },
  { id: "openrouter", label: "OpenRouter",       baseUrl: "https://openrouter.ai/api/v1",                   kind: "openai",    keyUrl: "https://openrouter.ai/keys", help: "Accès à des centaines de modèles.", usageUrl: "https://openrouter.ai/api/v1/auth/key" },
  { id: "mistral",    label: "Mistral",          baseUrl: "https://api.mistral.ai/v1",                      kind: "openai",    keyUrl: "https://console.mistral.ai/api-keys", help: "Le fournisseur français." },
  { id: "openai",     label: "OpenAI",           baseUrl: "https://api.openai.com/v1",                      kind: "openai",    keyUrl: "https://platform.openai.com/api-keys", keyPrefix: "sk-", help: "GPT-4o, GPT-4.1, etc." },
  { id: "anthropic",  label: "Anthropic",        baseUrl: "https://api.anthropic.com/v1",                   kind: "anthropic", keyUrl: "https://console.anthropic.com/settings/keys", keyPrefix: "sk-ant-", help: "Claude. Autorise le navigateur directement." },
  { id: "gemini",     label: "Google Gemini",    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", kind: "openai", keyUrl: "https://aistudio.google.com/apikey", help: "Via l'endpoint compatible OpenAI." },
  { id: "huggingface",label: "Hugging Face",     baseUrl: "https://router.huggingface.co/v1",               kind: "openai",    keyUrl: "https://huggingface.co/settings/tokens", keyPrefix: "hf_", help: "Modèles open source hébergés." },
  { id: "lmstudio",   label: "LM Studio (local)",baseUrl: "http://localhost:1234/v1",                       kind: "openai",    local: true, help: "Sur votre PC, activez le serveur local et le CORS." },
  { id: "ollama",     label: "Ollama (local)",   baseUrl: "http://localhost:11434/v1",                      kind: "openai",    local: true, help: "Lancez : OLLAMA_ORIGINS=* ollama serve" },
  { id: "custom",     label: "Compatible OpenAI",baseUrl: "",                                               kind: "openai",    custom: true, help: "Tout serveur parlant l'API OpenAI (vLLM, LiteLLM, etc.)." }
];
export const providerById = id => PROVIDERS.find(p => p.id === id);

export function connectedProviders(){
  return PROVIDERS.filter(p => {
    if(p.local) return p.id !== "custom";
    if(p.custom){ const c = customCfg(); return !!(c.baseUrl); }
    return !!getKey(p.id);
  });
}
export function customCfg(){ try{ return JSON.parse(localStorage.getItem("hub_custom_provider") || "{}"); }catch(e){ return {}; } }
export function setCustomCfg(c){ try{ localStorage.setItem("hub_custom_provider", JSON.stringify(c || {})); }catch(e){} }
export function baseUrlOf(p){
  if(p.custom) return (customCfg().baseUrl || "").replace(/\/$/, "");
  return p.baseUrl.replace(/\/$/, "");
}

function headersFor(p){
  const key = p.custom ? (customCfg().key || "") : getKey(p.id);
  const h = { "Content-Type": "application/json" };
  if(p.kind === "anthropic"){
    h["x-api-key"] = key;
    h["anthropic-version"] = "2023-06-01";
    h["anthropic-dangerous-direct-browser-access"] = "true";
  } else if(key){
    h["Authorization"] = "Bearer " + key;
  }
  return h;
}

export async function listModels(providerId){
  const p = providerById(providerId);
  if(!p) throw new Error("fournisseur inconnu");
  const base = baseUrlOf(p);
  if(!base) throw new Error("URL de base manquante (fournisseur personnalisé)");
  const res = await fetch(base + "/models", { headers: headersFor(p) });
  if(!res.ok) throw new Error("HTTP " + res.status);
  const j = await res.json();
  const arr = j.data || j.models || [];
  return arr.map(m => ({ id: m.id || m.name, label: m.id || m.name })).filter(m => m.id);
}

export async function testProvider(providerId){
  const models = await listModels(providerId);
  return models.length + " modèle(s) disponible(s)";
}

/* ---- appel chat unifié, avec streaming optionnel ---- */
export async function chat({ providerId, model, messages, temperature = 0.7, maxTokens = 2000, onDelta, signal }){
  const p = providerById(providerId);
  if(!p) throw new Error("fournisseur inconnu");
  const base = baseUrlOf(p);
  if(!base) throw new Error("URL de base manquante pour ce fournisseur");
  if(!p.local && !p.custom && !getKey(p.id)) throw new Error("aucune clé API pour " + p.label + " (Fournisseurs API)");
  if(p.custom && !customCfg().key) throw new Error("aucune clé API pour le fournisseur personnalisé");
  if(!model) throw new Error("aucun modèle choisi (Modèles IA)");

  if(p.kind === "anthropic"){
    const system = messages.filter(m => m.role === "system").map(m => m.content).join("\n\n");
    const rest = messages.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content }));
    return await anthropicChat(base, getKey(p.id), model, system, rest, temperature, maxTokens, onDelta, signal);
  }

  const body = { model, messages, temperature, max_tokens: maxTokens, stream: !!onDelta };
  if(p.id === "groq" && /gpt-oss/i.test(model)) body.reasoning_format = "hidden";
  let res, lastErr = "";
  for(let attempt = 0; attempt < 3; attempt++){
    if(attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt));
    res = await fetch(base + "/chat/completions", {
      method: "POST", headers: headersFor(p), body: JSON.stringify(body), signal
    });
    if(res.ok) break;
    let detail = "";
    try{ const j = await res.json(); detail = (j.error && (j.error.message || j.error)) || ""; }catch(e){}
    lastErr = "HTTP " + res.status + (detail ? " — " + detail : "");
    const ra = res.headers.get("retry-after");
    if(res.status === 429 || res.status >= 500){
      if(ra) await new Promise(r => setTimeout(r, (parseFloat(ra) || 2) * 1000));
      continue;
    }
    throw new Error(lastErr);
  }
  if(!res.ok) throw new Error(lastErr + " ( après 3 essais — le fournisseur est saturé, réessayez dans un instant )");
  if(!onDelta){
    const j = await res.json();
    const out = (j.choices[0].message || {}).content || "";
    if(!out && (j.choices[0].message || {}).reasoning) throw new Error("le modèle n’a renvoyé que du raisonnement interne — augmentez « Tokens max » de l’assistant");
    return out;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", full = "";
  while(true){
    const { done, value } = await reader.read();
    if(done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for(const line of lines){
      const s = line.trim();
      if(!s.startsWith("data:")) continue;
      const payload = s.slice(5).trim();
      if(payload === "[DONE]") continue;
      try{
        const j = JSON.parse(payload);
        const d = j.choices && j.choices[0] && (j.choices[0].delta || j.choices[0].message);
        const piece = d && d.content;
        if(piece){ full += piece; onDelta(piece, full); }
      }catch(e){}
    }
  }
  return full;
}

async function anthropicChat(base, key, model, system, messages, temperature, maxTokens, onDelta, signal){
  const body = { model, system, messages, temperature, max_tokens: maxTokens, stream: !!onDelta };
  const res = await fetch(base + "/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json", "x-api-key": key,
      "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify(body), signal
  });
  if(!res.ok){
    let detail = "";
    try{ const j = await res.json(); detail = (j.error && j.error.message) || ""; }catch(e){}
    throw new Error("HTTP " + res.status + (detail ? " — " + detail : ""));
  }
  if(!onDelta){
    const j = await res.json();
    return (j.content || []).map(c => c.text || "").join("");
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", full = "";
  while(true){
    const { done, value } = await reader.read();
    if(done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for(const line of lines){
      const s = line.trim();
      if(!s.startsWith("data:")) continue;
      try{
        const j = JSON.parse(s.slice(5).trim());
        if(j.type === "content_block_delta" && j.delta && j.delta.text){
          full += j.delta.text; onDelta(j.delta.text, full);
        }
      }catch(e){}
    }
  }
  return full;
}

/* ---- sérialisation des appels (évite les 429 sur les niveaux gratuits) ---- */
const queue = [];
let busy = false;
export function enqueueLLM(job){
  return new Promise((resolve, reject)=>{
    queue.push({ job, resolve, reject });
    pump();
  });
}
async function pump(){
  if(busy || !queue.length) return;
  busy = true;
  const item = queue.shift();
  try{ item.resolve(await item.job()); }catch(e){ item.reject(e); }
  busy = false;
  setTimeout(pump, 1500);
}
