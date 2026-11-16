/* ============ AI Assistant Hub — routeur + navigation ============ */
import { state, sessionBox, setPushRemote, esc } from "./store.js";
import { icon } from "./icons.js";
import { initAuth, openAuthModal, signOut, initAuthUI } from "./auth.js";
import { applyTheme, renderSettings } from "./settings.js";
import { renderDashboard } from "./dashboard.js";
import { renderAssistants, openAssistantEditor, ensurePresets as ensureAssistantPresets } from "./assistants.js";
import { renderConversations, renderHistory } from "./chat.js";
import { renderSkills, ensurePresets as ensureSkillPresets } from "./skills.js";
import { renderProviders, renderModels } from "./providersview.js";
import { renderMemory } from "./memory.js";
import { viewHead, bindMenuBtn } from "./ui.js";

const NAV = [
  ["dashboard",     "Dashboard",         "pie"],
  ["assistants",    "Mes assistants",    "user"],
  ["create",        "Créer un assistant","add"],
  ["conversations", "Conversations",     "text-bubble"],
  ["skills",        "Skills",            "star"],
  ["models",        "Modèles IA",        "gears"],
  ["providers",     "Fournisseurs API",  "globe"],
  ["memory",        "Mémoire",           "folder"],
  ["navsep1",       null,                null],
  ["tools",         "Outils & MCP",      "list"],
  ["workflows",     "Workflows",         "tasks"],
  ["history",       "Historique",        "clock"],
  ["settings",      "Paramètres",        "palette"]
];

function buildNav(){
  document.getElementById("nav").innerHTML = NAV.map(([id, label, ic]) =>
    id.startsWith("navsep")
      ? '<div class="nav-sep"></div>'
      : '<button class="nav-item" data-page="' + id + '">' + icon(ic) + '<span>' + esc(label) + '</span></button>'
  ).join("");
  document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click", ()=>{
    location.hash = "#/" + b.dataset.page;
    document.getElementById("sidebar").classList.remove("open");
  }));
  document.getElementById("brandMark").innerHTML = icon("sparkles");
}

function markNav(page){
  document.querySelectorAll(".nav-item").forEach(b =>
    b.classList.toggle("on", b.dataset.page === page || (page === "create" && b.dataset.page === "create")));
}

function route(){
  const view = document.getElementById("view");
  const parts = (location.hash || "#/dashboard").replace(/^#\//, "").split("/");
  const page = parts[0] || "dashboard";
  markNav(page);
  if(page === "dashboard") renderDashboard(view);
  else if(page === "assistants") renderAssistants(view);
  else if(page === "create"){ renderAssistants(view); openAssistantEditor(null); }
  else if(page === "conversations") renderConversations(view, parts[1]);
  else if(page === "skills") renderSkills(view);
  else if(page === "models") renderModels(view);
  else if(page === "providers") renderProviders(view);
  else if(page === "memory") renderMemory(view);
  else if(page === "history") renderHistory(view);
  else if(page === "settings") renderSettings(view);
  else if(page === "tools") renderSoon(view, "Outils & MCP", "list",
    ["Connexion GitHub (repos, fichiers, publications de sites)",
     "Notion, recherche web et lecture de fichiers",
     "Analyse de documents et API personnalisées",
     "Connecteurs MCP avec permissions par assistant"]);
  else if(page === "workflows") renderSoon(view, "Workflows", "tasks",
    ["Éditeur de chaînes d'assistants (style plan de flux)",
     "Déclencheurs : manuel, programmé, webhook",
     "Exécution pas à pas avec interruption",
     "Historique d'exécution détaillé"]);
  else renderDashboard(view);
}

function renderSoon(view, title, ic, items){
  view.innerHTML =
    viewHead('<button class="btn small menu-btn" id="menuBtn">' + icon("list") + '</button>', icon(ic) + " " + title,
      "Prochaine étape de développement — volontairement non simulé : aucun bouton factice ici.") +
    '<div class="panel"><div class="panel-head">Ce qui arrivera dans cette section</div>' +
    items.map(t => '<div class="row">' + icon("check") + '<span>' + esc(t) + '</span></div>').join("") +
    '<div class="hint" style="margin-top:10px;">Tout le reste de la plateforme est déjà fonctionnel : assistants, fournisseurs, skills réelles, conversations, mémoire et collaboration.</div></div>';
  bindMenuBtn(view);
}

function refreshAccount(){
  const btn = document.getElementById("accountBtn");
  const u = sessionBox.user;
  btn.innerHTML = u
    ? icon("logout") + '<span>' + esc((u.user_metadata && (u.user_metadata.preferred_username || u.user_metadata.name)) || u.email || "compte") + '</span>'
    : icon("login") + '<span>Se connecter</span>';
}

function refreshSyncChip(){
  const chip = document.getElementById("chipSync");
  if(sessionBox.user){
    chip.innerHTML = icon("check") + " sync · " + (state.meta.syncedAt ? new Date(state.meta.syncedAt).toLocaleTimeString("fr-FR") : "en cours");
  } else {
    chip.innerHTML = icon("eye") + " local";
  }
}

function onAuthChange(){
  ensureAssistantPresets();
  ensureSkillPresets();
  refreshAccount();
  refreshSyncChip();
  route();
}

function boot(){
  buildNav();
  document.getElementById("accountBtn").addEventListener("click", ()=>{
    if(sessionBox.user){ if(confirm("Se déconnecter de ce compte ?")) signOut(); }
    else openAuthModal();
  });
  document.getElementById("backdrop").addEventListener("click", ()=> document.getElementById("sidebar").classList.remove("open"));
  setPushRemote(refreshSyncChip);
  initAuth(onAuthChange);
  initAuthUI();
  ensureAssistantPresets();
  ensureSkillPresets();
  applyTheme(state.settings.theme);
  refreshAccount();
  refreshSyncChip();
  window.addEventListener("hashchange", route);
  route();
  if(!sessionBox.user) openAuthModal();
}

boot();
