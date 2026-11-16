/* ============ authentification GitHub (Supabase OAuth) ============ */
import { cfg, sessionBox, supabaseReady, SETUP_SQL, saveCfg, DEFAULT_SUPABASE_URL, loadLocal, logActivity, esc, pullRemote, pushRemote } from "./store.js";
import { icon } from "./icons.js";

let onChangeCb = null;
const cleanUrl = () => location.origin + location.pathname;

function oauthErrHelp(msg){
  const m = (msg || "").toLowerCase();
  const proj = (cfg.url || "").replace("https://", "").split(".")[0];
  const dash = "supabase.com/dashboard/project/" + proj + "/auth/providers";
  if(m.includes("provider is not enabled") || m.includes("unsupported provider")) return "Ce fournisseur n'est pas encore activé : ouvrez " + dash + " et activez-le.";
  if(m.includes("unauthorized_client") || m.includes("invalid client") || m.includes("client id")) return "Identifiants invalides ou application révoquée : recréez l'application GitHub, puis recollez le Client ID et le Secret dans " + dash + ".";
  if(m.includes("redirect")) return "URL de redirection refusée : utilisez exactement https://" + proj + ".supabase.co/auth/v1/callback chez GitHub, et Site URL = " + location.origin + location.pathname + " dans Supabase.";
  return msg;
}

export function initAuth(onChange){
  onChangeCb = onChange;
  if(!supabaseReady()){ sessionBox.sb = null; return; }
  const sb = window.supabase.createClient(cfg.url, cfg.key);
  sessionBox.sb = sb;
  sb.auth.getSession().then(({data})=>{
    if(data.session) applySession(data.session);
    if(onChangeCb) onChangeCb();
  });
  sb.auth.onAuthStateChange((event, s)=>{
    if(event === "SIGNED_IN" && s) applySession(s);
    if(event === "SIGNED_OUT"){
      sessionBox.user = null;
      loadLocal();
      if(onChangeCb) onChangeCb();
      openAuthModal();
    }
    if(onChangeCb) onChangeCb();
  });
}

function applySession(s){
  const sameUser = sessionBox.user && s.user && sessionBox.user.id === s.user.id;
  sessionBox.user = s.user;
  loadLocal();
  document.getElementById("authOverlay").classList.remove("show");
  pullRemote(!sameUser).then(()=>{ if(onChangeCb) onChangeCb(); });
}

export async function signInGitHub(){
  if(!sessionBox.sb) return;
  showAuthMsg("Redirection vers GitHub...", false);
  try{
    if(location.hash || location.search) history.replaceState(null, "", cleanUrl());
    const { error } = await sessionBox.sb.auth.signInWithOAuth({ provider: "github", options: { redirectTo: cleanUrl() } });
    if(error) showAuthMsg(oauthErrHelp(error.message), true);
  }catch(e){ showAuthMsg(oauthErrHelp(e.message), true); }
}

export function signOut(){
  if(sessionBox.sb) sessionBox.sb.auth.signOut();
  sessionBox.user = null;
  loadLocal();
  if(onChangeCb) onChangeCb();
}

function showAuthMsg(text, isErr){
  const el = document.getElementById("authMsg");
  if(!el) return;
  el.className = "msg" + (isErr ? " err" : " ok");
  el.textContent = text;
}

export function openAuthModal(){
  document.getElementById("authTitle").innerHTML = icon("login") + " Connexion";
  document.getElementById("authClose").innerHTML = icon("cross");
  document.getElementById("authClose").style.display = sessionBox.user ? "" : "none";
  const body = document.getElementById("authBody");
  if(supabaseReady()){
    document.getElementById("authSub").textContent = "Connectez-vous avec GitHub pour retrouver tout votre hub sur tous vos appareils, avec le même compte.";
    const proj = (cfg.url || "").replace("https://","").split(".")[0];
    body.innerHTML = `
      <div class="oauth">
        <button class="btn line wide" data-p="github">${icon("github")} Continuer avec GitHub</button>
      </div>
      <div class="msg" id="authMsg"></div>
      <div class="hint" style="margin-top:14px;">Si GitHub ne fonctionne pas : <a href="https://supabase.com/dashboard/project/${proj}/auth/providers" target="_blank" rel="noopener">Supabase → Authentication → Providers → GitHub</a> doit contenir un Client ID + Secret valides (Callback = https://${proj}.supabase.co/auth/v1/callback), et <a href="https://supabase.com/dashboard/project/${proj}/auth/url-configuration" target="_blank" rel="noopener">URL Configuration</a> doit avoir Site URL = <b>${esc(location.origin + location.pathname)}</b>.</div>
      <div class="divider">outil de réparation</div>
      <button class="btn line wide" id="diagBtn">${icon("gears")} Tester la configuration des fournisseurs</button>
      <div class="msg" id="diagMsg" style="display:none;"></div>
      <details class="settings"><summary>${icon("gears")} Changer la configuration Supabase</summary>
        <label for="cfgUrl">URL du projet Supabase</label>
        <input type="text" id="cfgUrl" value="${esc(cfg.url)}" placeholder="https://xxxx.supabase.co">
        <label for="cfgKey">Clé publique (anon)</label>
        <input type="password" id="cfgKey" value="${esc(cfg.key)}" placeholder="eyJ...">
        <button class="btn wide" id="cfgSave" style="margin-top:10px;">Enregistrer la configuration</button>
      </details>`;
    body.querySelectorAll("[data-p]").forEach(b => b.addEventListener("click", ()=> signInGitHub()));
    body.querySelector("#diagBtn").addEventListener("click", async ()=>{
      const m = body.querySelector("#diagMsg");
      m.style.display = ""; m.className = "msg"; m.textContent = "Vérification en cours...";
      try{
        const res = await fetch(cfg.url + "/auth/v1/settings", { headers: { apikey: cfg.key } });
        if(!res.ok) throw new Error("Supabase a répondu " + res.status);
        const j = await res.json();
        const on = j.external && j.external.github && j.external.github.enabled;
        m.className = "msg " + (on ? "ok" : "err");
        m.textContent = "GitHub : " + (on ? "activé ✓ côté Supabase. Si la connexion échoue quand même, recréez l'application sur github.com/settings/developers (Callback = " + cfg.url + "/auth/v1/callback) puis recollez Client ID + Secret dans Supabase." : "désactivé ✗ — activez-le dans Supabase → Authentication → Providers → GitHub.");
      }catch(e){
        m.className = "msg err";
        m.textContent = "Test impossible : " + e.message;
      }
    });
    body.querySelector("#cfgSave").addEventListener("click", ()=>{
      cfg.url = body.querySelector("#cfgUrl").value.trim() || DEFAULT_SUPABASE_URL;
      cfg.key = body.querySelector("#cfgKey").value.trim();
      saveCfg();
      initAuth(onChangeCb);
      openAuthModal();
    });
  } else {
    document.getElementById("authSub").textContent = "Configurez une fois votre projet Supabase (gratuit) pour activer la connexion GitHub et la synchronisation entre appareils.";
    body.innerHTML = `
      <label for="cfgUrl">URL du projet Supabase</label>
      <input type="text" id="cfgUrl" value="${esc(cfg.url || DEFAULT_SUPABASE_URL)}" placeholder="https://xxxx.supabase.co">
      <label for="cfgKey">Clé publique (anon)</label>
      <input type="password" id="cfgKey" value="${esc(cfg.key)}" placeholder="Collez ici la clé anon de Supabase">
      <button class="btn wide" id="cfgSave" style="margin-top:12px;">Enregistrer et continuer</button>
      <div class="hint">Dans Supabase → Project Settings → API : copiez l'<b>URL du projet</b> et la clé <b>anon public</b>. Ensuite, dans SQL Editor, exécutez :</div>
      <div class="sql">${esc(SETUP_SQL)}</div>`;
    body.querySelector("#cfgSave").addEventListener("click", ()=>{
      cfg.url = body.querySelector("#cfgUrl").value.trim() || DEFAULT_SUPABASE_URL;
      cfg.key = body.querySelector("#cfgKey").value.trim();
      if(!cfg.key){ showAuthMsg("Collez la clé anon de votre projet Supabase.", true); return; }
      saveCfg();
      initAuth(onChangeCb);
      openAuthModal();
    });
  }
  document.getElementById("authOverlay").classList.add("show");
}

export function initAuthUI(){
  document.getElementById("authClose").addEventListener("click", ()=> document.getElementById("authOverlay").classList.remove("show"));
  document.getElementById("authOverlay").addEventListener("click", e=>{
    if(e.target.id === "authOverlay" && sessionBox.user) e.currentTarget.classList.remove("show");
  });
  const err = new URLSearchParams(location.hash.slice(1)).get("error_description")
    || new URLSearchParams(location.search).get("error_description");
  if(err){
    openAuthModal();
    showAuthMsg("Échec de connexion : " + err, true);
    setTimeout(()=>{ try{ history.replaceState(null, "", location.pathname); }catch(e){} }, 3000);
  }
}
