/* ============ dashboard : vue d'ensemble réelle ============ */
import { state, esc, sessionBox, getKey } from "./store.js";
import { icon } from "./icons.js";
import { PROVIDERS, connectedProviders, testProvider } from "./providers.js";
import { cachedModels } from "./chat.js";
import { viewHead, bindMenuBtn, toast } from "./ui.js";

export function renderDashboard(container){
  const actifs = state.assistants.filter(a => a.enabled !== false).length;
  const modeles = PROVIDERS.reduce((n, p) => n + cachedModels(p.id).length, 0);
  const connexions = connectedProviders();
  const convs = state.conversations.slice().sort((a,b) => (b.updatedAt||"").localeCompare(a.updatedAt||"")).slice(0,5);
  const act = state.activity.slice(0,8);

  const connRows = PROVIDERS.map(p => {
    const on = connexions.some(c => c.id === p.id) || (p.local && p.id !== "custom");
    return '<div class="row" style="align-items:center;gap:10px;">' +
      '<span class="led ' + (on ? "on" : "off") + '"></span>' +
      '<span style="flex:1;">' + esc(p.label) + '</span>' +
      (on && !p.local ? '<button class="btn line small" data-test="' + p.id + '">Tester</button>' : '') +
    '</div>';
  }).join("");

  const convCards = convs.map(c =>
    '<button class="conv-item" data-open="' + c.id + '"><b>' + esc(c.title) + '</b><span>' +
    esc((state.assistants.find(a => a.id === c.assistantId) || {}).name || "sans assistant") + ' · ' +
    new Date(c.updatedAt).toLocaleString("fr-FR") + '</span></button>'
  ).join("");

  const actRows = act.map(a =>
    '<div class="row" style="gap:10px;align-items:baseline;"><span class="badge">' + esc(a.who) + '</span>' +
    '<span style="flex:1;">' + esc(a.msg) + '</span><span class="hint">' + esc(a.t) + '</span></div>'
  ).join("") || '<div class="empty">Aucune activité pour le moment.</div>';

  container.innerHTML =
    viewHead('<button class="btn small menu-btn" id="menuBtn">' + icon("list") + '</button>', icon("pie") + " Dashboard",
      "Vue d'ensemble de votre hub. Tout ce qui est affiché ici reflète l'état réel de vos connexions.") +
    '<div class="kpis">' +
      '<div class="kpi"><span class="lbl">Assistants créés</span><b>' + state.assistants.length + '</b></div>' +
      '<div class="kpi"><span class="lbl">Assistants actifs</span><b>' + actifs + '</b></div>' +
      '<div class="kpi"><span class="lbl">Modèles disponibles</span><b>' + modeles + '</b><span class="hint">' + (modeles ? "" : "chargez-les dans Modèles IA") + '</span></div>' +
      '<div class="kpi"><span class="lbl">Fournisseurs connectés</span><b>' + connexions.length + '</b></div>' +
    '</div>' +
    onboarding() +
    '<div class="grid2">' +
      '<div class="panel"><div class="panel-head">' + icon("globe") + ' État des connexions</div>' + connRows +
        '<div class="hint" id="orUsage" style="margin-top:10px;"></div></div>' +
      '<div class="panel"><div class="panel-head">' + icon("text-bubble") + ' Dernières conversations</div>' +
        (convCards || "<div class='empty'>Aucune conversation. Ouvrez l'onglet Conversations.</div>") + '</div>' +
    '</div>' +
    '<div class="panel" style="margin-top:16px;"><div class="panel-head">' + icon("clock") + ' Activité récente</div>' + actRows + '</div>';

  bindMenuBtn(container);
  container.querySelectorAll("[data-test]").forEach(b => b.addEventListener("click", async ()=>{
    b.disabled = true; b.textContent = "...";
    try{ toast("✓ " + (await testProvider(b.dataset.test))); logConnexion(b.dataset.test); }
    catch(e){ toast("Échec : " + e.message, true); }
    b.disabled = false; b.textContent = "Tester";
  }));
  container.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", ()=>{
    location.hash = "#/conversations/" + b.dataset.open;
  }));

  refreshOpenRouterUsage(container);
}

function onboarding(){
  const hasKey = PROVIDERS.some(p => getKey(p.id)) || connectedProviders().length > 0;
  const hasModel = !!(state.defaultModel && state.defaultModel.model);
  const step = (ok, num, label, page, btn) =>
    '<div class="row" style="align-items:center;gap:10px;">' +
      '<span class="led ' + (ok ? "on" : "off") + '"></span>' +
      '<span style="flex:1;"><b>' + num + '.</b> ' + label + '</span>' +
      (ok ? '' : '<a class="btn line small" href="#/' + page + '">' + btn + '</a>') +
    '</div>';
  const done = hasKey && hasModel;
  return '<div class="panel" style="margin-bottom:16px;"><div class="panel-head">' + icon("sparkles") + ' Bien démarrer' + (done ? ' — tout est prêt ✓' : '') + '</div>' +
    step(hasKey, 1, 'Collez votre clé API (ex. Groq, gratuit) dans Fournisseurs API.', 'providers', 'Fournisseurs API') +
    step(hasModel, 2, 'Choisissez un modèle par défaut dans Modèles IA.', 'models', 'Modèles IA') +
    '<div class="row" style="align-items:center;gap:10px;">' +
      '<span class="led ' + (done ? "on" : "off") + '"></span>' +
      '<span style="flex:1;"><b>3.</b> Donnez votre consigne au Patron : il distribue les tâches à vos assistants.</span>' +
      '<a class="btn small" href="#/patron">' + icon("crown") + ' Le Patron</a>' +
    '</div>' +
    (done ? '' : '<div class="hint" style="margin-top:8px;">Sans clé et sans modèle, les assistants ne peuvent pas travailler — c\'est voulu : ici, rien ne simule.</div>') +
  '</div>';
}

function logConnexion(pid){
  state.activity.unshift({ t: new Date().toLocaleTimeString("fr-FR"), who: "Système", msg: "Connexion testée : " + pid });
  if(state.activity.length > 150) state.activity.length = 150;
}

async function refreshOpenRouterUsage(container){
  const el = container.querySelector("#orUsage");
  if(!el) return;
  const key = getKey("openrouter");
  if(!key){ el.textContent = "Consommation : non disponible chez ce fournisseur (visible ici pour OpenRouter quand une clé est configurée)."; return; }
  try{
    const res = await fetch("https://openrouter.ai/api/v1/auth/key", { headers: { Authorization: "Bearer " + key } });
    if(!res.ok) throw new Error("HTTP " + res.status);
    const j = await res.json();
    const d = j.data || {};
    const usage = typeof d.usage === "number" ? "$" + d.usage.toFixed(4) : "?";
    const limit = d.is_free_tier || !d.limit ? "sans limite fixe" : "$" + Number(d.limit).toFixed(2);
    el.textContent = "OpenRouter — consommé : " + usage + " / " + limit;
  }catch(e){ el.textContent = "Consommation OpenRouter indisponible (" + e.message + ")."; }
}
