/* ============ état global, persistance locale + cloud (Supabase) ============ */
const CFG_KEY = "hub_cfg";
const KEYS_STORE = "hub_keys";
const DEFAULT_SUPABASE_URL = "https://rqbxvttqiinkcporqepm.supabase.co";

export const uid = () => Math.random().toString(36).slice(2,9);
export const nowT = () => new Date().toLocaleTimeString("fr-FR");
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export const cfg = { url: "", key: "" };
try{ Object.assign(cfg, JSON.parse(localStorage.getItem(CFG_KEY) || "{}")); }catch(e){}

export const sessionBox = { user: null, sb: null };

export function freshState(){
  return {
    assistants: [], conversations: [], skills: [], memories: [],
    providers: {}, defaultModel: { providerId: "groq", model: "" },
    settings: { theme: "vert", streaming: true },
    activity: [], meta: { syncedAt: null }
  };
}
export let state = freshState();

export function ensureState(){
  for(const k of ["assistants","conversations","skills","memories","activity"]){
    if(!Array.isArray(state[k])) state[k] = [];
  }
  if(!state.providers) state.providers = {};
  if(!state.defaultModel) state.defaultModel = { providerId: "groq", model: "" };
  if(!state.settings) state.settings = { theme: "vert", streaming: true };
  if(!state.meta) state.meta = { syncedAt: null };
}

function scopeKey(){ return sessionBox.user ? "hub_state_" + sessionBox.user.id : "hub_state_guest"; }

let saveTimer = null, pushTimer = null, pendingLocal = false;
export function save(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{
    try{ localStorage.setItem(scopeKey(), JSON.stringify(state)); }catch(e){}
    pendingLocal = true;
    schedulePush();
  }, 250);
}
export function replaceState(next){
  state = Object.assign(freshState(), next || {});
  ensureState();
}

export function loadLocal(){
  try{
    const raw = localStorage.getItem(scopeKey());
    state = raw ? Object.assign(freshState(), JSON.parse(raw)) : freshState();
    ensureState();
  }catch(e){ state = freshState(); }
}

export function logActivity(msg, who){
  state.activity.unshift({ t: nowT(), who: who || "Système", msg });
  if(state.activity.length > 150) state.activity.length = 150;
  save();
}

/* ---- clés API : jamais dans l'état synchronisé, jamais dans les logs ---- */
export function getKeys(){ try{ return JSON.parse(localStorage.getItem(KEYS_STORE) || "{}"); }catch(e){ return {}; } }
export function setKey(providerId, key){
  const k = getKeys();
  if(key) k[providerId] = key.trim(); else delete k[providerId];
  try{ localStorage.setItem(KEYS_STORE, JSON.stringify(k)); }catch(e){}
}
export function getKey(providerId){ return (getKeys()[providerId] || "").trim(); }

/* ---- synchro cloud (table agent_workspaces, RLS propriétaire) ---- */
export function supabaseReady(){ return !!(cfg.url && cfg.key && window.supabase); }
let pushRemoteRef = null;
export function setPushRemote(fn){ pushRemoteRef = fn; }
function schedulePush(){
  if(!sessionBox.user || !sessionBox.sb) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(()=>{ if(pushRemoteRef) pushRemoteRef(); }, 2000);
}
export async function pushRemote(){
  if(!sessionBox.user || !sessionBox.sb) return;
  try{
    const updated_at = new Date().toISOString();
    state.meta.syncedAt = updated_at;
    pendingLocal = false;
    const clean = JSON.parse(JSON.stringify(state));
    await sessionBox.sb.from("agent_workspaces").upsert({
      id: sessionBox.user.id, data: clean, updated_at
    });
    try{ localStorage.setItem(scopeKey(), JSON.stringify(state)); }catch(e){}
    if(pushRemoteRef) pushRemoteRef();
  }catch(e){ console.warn("push échoué", e.message); }
}
export async function pullRemote(force){
  if(!sessionBox.user || !sessionBox.sb) return;
  try{
    const { data, error } = await sessionBox.sb.from("agent_workspaces").select("*").eq("id", sessionBox.user.id).maybeSingle();
    if(error) throw error;
    if(data && data.data){
      const remoteNewer = !state.meta.syncedAt || (data.updated_at > state.meta.syncedAt);
      if((remoteNewer && !pendingLocal) || force){
        const keep = { activity: state.activity };
        state = Object.assign(freshState(), data.data, keep, { meta: { syncedAt: data.updated_at } });
        ensureState();
        save();
        return true;
      }
    } else if(!data){ pushRemote(); }
  }catch(e){ console.warn("pull échoué", e.message); }
  return false;
}
setInterval(()=>{ if(sessionBox.user && !pendingLocal) pullRemote(false); }, 20000);
window.addEventListener("focus", ()=>{ if(sessionBox.user && !pendingLocal) pullRemote(false); });

export const SETUP_SQL = `create table if not exists agent_workspaces (
  id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table agent_workspaces enable row level security;
create policy "proprietaire"
  on agent_workspaces for all
  using (auth.uid() = id)
  with check (auth.uid() = id);`;

export function saveCfg(){ try{ localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }catch(e){} }
export { DEFAULT_SUPABASE_URL };
