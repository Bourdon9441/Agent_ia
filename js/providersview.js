/* ============ fournisseurs API + modèles IA ============ */
import { state, save, esc, getKey, setKey, logActivity } from "./store.js";
import { icon } from "./icons.js";
import { PROVIDERS, customCfg, setCustomCfg, listModels, testProvider, connectedProviders } from "./providers.js";
import { cachedModels, setCachedModels } from "./chat.js";
import { viewHead, bindMenuBtn, toast } from "./ui.js";

export function renderProviders(container){
  const cards = PROVIDERS.map(p => {
    const c = customCfg();
    const isCustom = !!p.custom;
    const isLocal = !!p.local;
    const connected = connectedProviders().some(x => x.id === p.id);
    return '<div class="card" data-p="' + p.id + '">' +
      '<div class="head"><span class="name">' + esc(p.label) + '</span>' +
        '<span class="led ' + (connected ? "on" : "off") + '"></span></div>' +
      '<div class="desc">' + esc(p.help) + '</div>' +
      (isCustom
        ? '<label class="lbl">URL de base (ex. https://mon-serveur/v1)</label><input type="text" class="in-base" value="' + esc(c.baseUrl || "") + '" placeholder="https://...">' +
          '<label class="lbl">Clé API</label><input type="password" class="in-key" value="' + esc(c.key || "") + '" placeholder="clé API">'
        : (isLocal
          ? '<div class="hint">Serveur local : aucune clé nécessaire, mais il doit tourner sur votre machine avec le CORS activé.</div>'
          : '<label class="lbl">Clé API</label><input type="password" class="in-key" value="' + esc(getKey(p.id)) + '" placeholder="' + esc(p.keyPrefix || "clé API") + '...">')) +
      '<div class="foot">' +
        '<button class="btn small bSave">' + icon("check") + ' Enregistrer</button>' +
        '<button class="btn line small bTest">Tester la connexion</button>' +
        (p.keyUrl ? '<a class="btn line small" href="' + p.keyUrl + '" target="_blank" rel="noopener">Obtenir une clé</a>' : '') +
      '</div></div>';
  }).join("");

  container.innerHTML =
    viewHead('<button class="btn small menu-btn" id="menuBtn">' + icon("list") + '</button>', icon("globe") + " Fournisseurs API",
      "Vos clés restent dans votre navigateur uniquement : jamais synchronisées, jamais affichées dans les logs, envoyées seulement au fournisseur concerné.") +
    '<div class="cards">' + cards + '</div>';
  bindMenuBtn(container);

  container.querySelectorAll(".card[data-p]").forEach(card => {
    const p = providerByIdSafe(card.dataset.p);
    card.querySelector(".bSave").addEventListener("click", ()=>{
      if(p.custom){
        setCustomCfg({ baseUrl: card.querySelector(".in-base").value.trim(), key: card.querySelector(".in-key").value.trim() });
      } else {
        setKey(p.id, card.querySelector(".in-key").value.trim());
      }
      toast("Clé enregistrée pour " + p.label + ".");
      logActivity("Fournisseur configuré : " + p.label, "Vous");
      renderProviders(container);
    });
    card.querySelector(".bTest").addEventListener("click", async ()=>{
      const b = card.querySelector(".bTest");
      b.disabled = true; b.textContent = "Test...";
      try{ toast("✓ " + p.label + " : " + (await testProvider(p.id))); }
      catch(e){ toast(p.label + " : " + e.message, true); }
      b.disabled = false; b.textContent = "Tester la connexion";
    });
  });
}

function providerByIdSafe(id){ return PROVIDERS.find(p => p.id === id); }

export function renderModels(container){
  const usable = PROVIDERS.filter(p => connectedProviders().some(x => x.id === p.id));
  const d = state.defaultModel || { providerId: "groq", model: "" };

  const sections = usable.map(p => {
    const models = cachedModels(p.id);
    const rows = models.map(m =>
      '<button class="conv-item' + (d.providerId === p.id && d.model === m.id ? " on" : "") + '" data-m="' + esc(m.id) + '" data-p="' + p.id + '">' +
      '<b>' + esc(m.id) + '</b>' + (d.providerId === p.id && d.model === m.id ? '<span class="badge">par défaut</span>' : '') + '</button>'
    ).join("");
    return '<div class="panel" data-sec="' + p.id + '"><div class="panel-head">' + icon("gears") + " " + esc(p.label) + '</div>' +
      (models.length
        ? '<div class="convlist">' + rows + '</div>'
        : "<div class='row'><button class='btn small bLoad' data-p='" + p.id + "'>Charger les modèles</button><span class='hint'>interroge l'API du fournisseur</span></div>") +
      '</div>';
  }).join("");

  container.innerHTML =
    viewHead('<button class="btn small menu-btn" id="menuBtn">' + icon("list") + '</button>', icon("gears") + " Modèles IA",
      "Choisissez le modèle par défaut utilisé par les assistants qui n'en définissent pas un proprement.") +
    '<div class="panel" style="margin-bottom:16px;"><div class="panel-head">Modèle par défaut actuel</div>' +
      '<div class="row"><span class="badge">' + esc(d.providerId || "—") + '</span><b>' + esc(d.model || "aucun — les conversations afficheront une erreur") + '</b></div></div>' +
    (sections || "<div class='empty'>Aucun fournisseur connecté. Ajoutez d'abord une clé dans Fournisseurs API.</div>");
  bindMenuBtn(container);

  container.querySelectorAll(".bLoad").forEach(b => b.addEventListener("click", async ()=>{
    const pid = b.dataset.p;
    b.disabled = true; b.textContent = "Chargement...";
    try{
      const models = await listModels(pid);
      setCachedModels(pid, models);
      toast(models.length + " modèles chargés.");
      renderModels(container);
    }catch(e){ toast("Échec : " + e.message, true); b.disabled = false; b.textContent = "Charger les modèles"; }
  }));
  container.querySelectorAll(".conv-item[data-m]").forEach(b => b.addEventListener("click", ()=>{
    state.defaultModel = { providerId: b.dataset.p, model: b.dataset.m };
    save();
    toast("Modèle par défaut : " + b.dataset.p + " · " + b.dataset.m);
    logActivity("Modèle par défaut : " + b.dataset.p + " / " + b.dataset.m, "Vous");
    renderModels(container);
  }));
}
