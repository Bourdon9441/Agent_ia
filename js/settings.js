/* ============ paramètres : compte, thème, données, synchro ============ */
import { state, save, esc, sessionBox, cfg, supabaseReady, SETUP_SQL, loadLocal, ensureState, freshState, replaceState } from "./store.js";
import { icon } from "./icons.js";
import { viewHead, bindMenuBtn, toast } from "./ui.js";
import { signOut } from "./auth.js";

export const THEMES = {
  vert:   { signal: "#c6f542", signalRgb: "198,245,66",  amber: "#ffb454" },
  rouge:  { signal: "#ff6b6b", signalRgb: "255,107,107", amber: "#ffd23f" },
  bleu:   { signal: "#5db8ff", signalRgb: "93,184,255",  amber: "#ffb454" },
  jaune:  { signal: "#ffd23f", signalRgb: "255,210,63",  amber: "#ff9f45" },
  orange: { signal: "#ff9f45", signalRgb: "255,159,69",  amber: "#ffd23f" },
  violet: { signal: "#b48cff", signalRgb: "180,140,255", amber: "#ff7ac8" },
  cyan:   { signal: "#4fe3c1", signalRgb: "79,227,193",  amber: "#5db8ff" },
  rose:   { signal: "#ff7ac8", signalRgb: "255,122,200", amber: "#b48cff" }
};

export function applyTheme(name){
  const t = THEMES[name] || THEMES.vert;
  const r = document.documentElement.style;
  r.setProperty("--signal", t.signal);
  r.setProperty("--signal-rgb", t.signalRgb);
  r.setProperty("--amber", t.amber);
}

export function renderSettings(container){
  const u = sessionBox.user;
  const themeDots = Object.keys(THEMES).map(k =>
    '<button class="dot' + (state.settings.theme === k ? " on" : "") + '" data-theme="' + k + '" title="' + k + '" style="background:' + THEMES[k].signal + ';"></button>'
  ).join("");

  container.innerHTML =
    viewHead('<button class="btn small menu-btn" id="menuBtn">' + icon("list") + '</button>', icon("palette") + " Paramètres",
      "Compte, apparence et gestion de vos données.") +
    '<div class="panel"><div class="panel-head">' + icon("user") + " Compte</div>" +
      (u
        ? '<div class="row"><span class="avatar">' + icon("user") + '</span><div><b>' + esc(u.user_metadata && (u.user_metadata.preferred_username || u.user_metadata.name) || "compte GitHub") + '</b><div class="hint">' + esc(u.email || "") + '</div></div><span class="spacer"></span><button class="btn danger small" id="btnOut">' + icon("logout") + ' Se déconnecter</button></div>'
        : '<div class="row"><span class="hint">Non connecté — vos données restent sur cet appareil seulement.</span><button class="btn small" id="btnIn">' + icon("login") + ' Se connecter</button></div>') +
    '</div>' +
    '<div class="panel" style="margin-top:16px;"><div class="panel-head">' + icon("palette") + " Thème</div>" +
      '<div class="dots">' + themeDots + '</div></div>' +
    '<div class="panel" style="margin-top:16px;"><div class="panel-head">' + icon("sparkles") + " Réponses en streaming</div>" +
      '<div class="row"><span style="flex:1;">Afficher les réponses mot à mot pendant la génération.</span>' +
      '<label class="switch"><input type="checkbox" id="swStream"' + (state.settings.streaming !== false ? " checked" : "") + '><span class="track"></span></label></div></div>' +
    '<div class="panel" style="margin-top:16px;"><div class="panel-head">' + icon("folder") + " Mes données</div>" +
      '<div class="row"><button class="btn small" id="btnExport">' + icon("check") + ' Exporter (JSON)</button>' +
      '<button class="btn line small" id="btnImportBtn">' + icon("folder") + ' Importer</button>' +
      '<input type="file" id="btnImport" accept="application/json" style="display:none;">' +
      '<button class="btn danger small" id="btnReset">' + icon("trash") + ' Tout effacer</button></div>' +
      "<div class='hint'>L'export contient vos assistants, skills, conversations et mémoires — jamais vos clés API.</div></div>" +
    '<div class="panel" style="margin-top:16px;"><div class="panel-head">' + icon("globe") + " Synchronisation</div>" +
      (supabaseReady()
        ? '<div class="hint">Projet : ' + esc(cfg.url) + '</div><div class="hint">Dernière synchro : ' + (state.meta.syncedAt ? esc(new Date(state.meta.syncedAt).toLocaleString("fr-FR")) : "jamais") + '</div>'
        : '<div class="hint">Aucun projet configuré — mode local.</div>') +
      '<div class="sql">' + esc(SETUP_SQL) + '</div></div>';
  bindMenuBtn(container);

  const out = container.querySelector("#btnOut");
  if(out) out.addEventListener("click", ()=>{ if(confirm("Se déconnecter ?")) signOut(); });
  const inn = container.querySelector("#btnIn");
  if(inn) inn.addEventListener("click", ()=>{ import("./auth.js").then(m => m.openAuthModal()); });

  container.querySelectorAll("[data-theme]").forEach(d => d.addEventListener("click", ()=>{
    state.settings.theme = d.dataset.theme;
    save(); applyTheme(d.dataset.theme);
    renderSettings(container);
  }));

  container.querySelector("#swStream").addEventListener("change", e=>{
    state.settings.streaming = e.target.checked;
    save();
    toast("Streaming " + (e.target.checked ? "activé" : "désactivé") + ".");
  });

  container.querySelector("#btnExport").addEventListener("click", ()=>{
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ai-assistant-hub-export.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });
  const fileInput = container.querySelector("#btnImport");
  container.querySelector("#btnImportBtn").addEventListener("click", ()=> fileInput.click());
  fileInput.addEventListener("change", ()=>{
    const f = fileInput.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const data = JSON.parse(reader.result);
        replaceState(Object.assign(freshState(), data));
        ensureState(); save();
        toast("Données importées.");
        renderSettings(container);
      }catch(e){ toast("Fichier invalide : " + e.message, true); }
    };
    reader.readAsText(f);
  });
  container.querySelector("#btnReset").addEventListener("click", ()=>{
    if(!confirm("Effacer TOUTES vos données locales (assistants, conversations, skills, mémoires) ?")) return;
    try{ localStorage.removeItem(sessionBox.user ? "hub_state_" + sessionBox.user.id : "hub_state_guest"); }catch(e){}
    loadLocal();
    toast("Données effacées.");
    location.hash = "#/dashboard";
    location.reload();
  });
}
