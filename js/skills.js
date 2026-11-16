/* ============ bibliothèque de skills (instructions réellement envoyées au modèle) ============ */
import { state, save, uid, esc, logActivity } from "./store.js";
import { icon } from "./icons.js";
import { toast } from "./ui.js";

export const SKILL_CATEGORIES = ["UI/UX Design","Frontend","Backend","Programmation","Sécurité","Recherche","API","Optimisation","Documentation","Automatisation"];

export const PRESET_SKILLS = [
  { name: "UI/UX premium", category: "UI/UX Design", desc: "Concevoir des interfaces premium, minimalistes, accessibles.", instructions: "Applique ces principes à toute interface que tu conçois : hiérarchie visuelle claire (une seule action principale par écran), espacements réguliers (échelle 4/8/12/16/24/32), typographie soignée (2 familles max, tailles limitées), contrastes AA minimum, états interactifs visibles (hover, focus, actif, désactivé), animations discrètes (150-250ms), responsive mobile-first. Évite : dégradés excessifs, cartes inutiles, texte gris trop clair, boutons sans fonction." },
  { name: "Frontend propre", category: "Frontend", desc: "HTML/CSS/JS structuré, accessible, sans dépendance inutile.", instructions: "Pour tout code frontend : sémantique HTML correcte, CSS organisé avec variables (pas de couleurs brutes dispersées), JS modulaire sans variable globale, pas de framework si du vanilla suffit. Accessibilité : labels sur les champs, alt sur les images, navigation clavier. Vérifie que le HTML produit est valide." },
  { name: "Backend robuste", category: "Backend", desc: "API et services fiables avec validation et gestion d'erreurs.", instructions: "Pour tout code backend : valide toutes les entrées (type, longueur, format), réponses d'erreur normalisées (code + message), jamais de détail interne ou de secret dans les erreurs, requêtes paramétrées (jamais de SQL concaténé), timeouts et limites de débit sur les endpoints, logs sans données sensibles." },
  { name: "Sécurité applicative", category: "Sécurité", desc: "Audit rapide selon OWASP Top 10.", instructions: "Analyse systématiquement : injection (SQL, XSS, commande), authentification et sessions, contrôle d'accès (un utilisateur ne doit pas lire les données d'un autre), exposition de secrets, CSRF, validation des entrées, en-têtes de sécurité. Classe chaque risque : critique / élevé / moyen / faible, avec le correctif concret." },
  { name: "Recherche structurée", category: "Recherche", desc: "Méthode de recherche et synthèse fiable.", instructions: "Pour toute recherche : 1) reformule la question, 2) liste ce qu'on cherche à savoir, 3) donne les faits avec leur niveau de confiance, 4) cite les sources possibles, 5) signale explicitement ce qui est incertain ou daté. Ne présente jamais une supposition comme un fait." },
  { name: "Intégration d'API", category: "API", desc: "Connecter une API externe proprement.", instructions: "Pour intégrer une API : identifie auth (clé, OAuth), rate limits et quotas, format d'erreur. Écris un client isolé (une seule responsabilité), timeouts, retry avec backoff sur 429/5xx, gestion des erreurs explicite. Ne mets jamais la clé en dur : variable d'environnement ou config." },
  { name: "Optimisation", category: "Optimisation", desc: "Performance : mesurer puis optimiser.", instructions: "Avant d'optimiser : identifie le goulot réel (mesure, pas intuition). Priorités : 1) algorithmes et structures de données, 2) requêtes réseau/N+1, 3) taille des ressources, 4) rendu. Donne le gain estimé de chaque optimisation et garde le code lisible." },
  { name: "Documentation claire", category: "Documentation", desc: "Écrire des docs utiles.", instructions: "Structure : quoi (1 phrase), installation, usage avec exemples copiables, référence des options, limites connues. Exemples testés et réels, jamais pseudo-code déguisé en exemple. Ton direct, pas de remplissage." },
  { name: "Automatisation", category: "Automatisation", desc: "Automatiser des tâches répétitives.", instructions: "Pour automatiser : identifie le déclencheur, les étapes, les cas d'erreur et la sortie. Préfère des scripts idempotents (rejouables sans effet de bord), avec logs clairs et mode essai à sec (dry-run) avant l'exécution réelle." },
  { name: "Revue de code", category: "Programmation", desc: "Relire du code comme un reviewer senior.", instructions: "Relis le code en 3 passes : 1) bugs et cas limites, 2) sécurité et performance, 3) lisibilité et nommage. Sortie : liste numérotée, chaque point avec gravité (bloquant/majeur/mineur), l'extrait concerné et la correction proposée en code." }
];

export function ensurePresets(){
  if(state.skills.some(s => s.source === "community")) return;
  for(const s of PRESET_SKILLS){
    state.skills.push({ id: uid(), name: s.name, desc: s.desc, category: s.category, instructions: s.instructions, enabled: true, source: "community", files: [] });
  }
  save();
}

export function getSkill(id){ return state.skills.find(s => s.id === id); }

export function renderSkills(container){
  const q = (container.dataset.q || "").toLowerCase();
  const list = state.skills.filter(s =>
    !q || (s.name + " " + s.desc + " " + s.category).toLowerCase().includes(q)
  );
  const cards = list.map(s =>
    '<div class="card" data-id="' + s.id + '" style="' + (s.enabled ? "" : "opacity:.55;") + '">' +
      '<div class="head"><span class="name">' + esc(s.name) + '</span>' +
      '<span class="badge ' + (s.enabled ? "on" : "off") + '">' + (s.enabled ? "active" : "inactive") + '</span></div>' +
      '<div class="desc">' + esc(s.desc || "") + '</div>' +
      '<div class="meta">' + esc(s.category || "général") + ' · ' + (s.source === "community" ? "bibliothèque" : "personnelle") + ' · ' + (s.instructions || "").length + ' car. d\'instructions</div>' +
      '<div class="foot">' +
        '<button class="btn line small sView">' + icon("eye") + ' Voir les instructions</button>' +
        '<button class="iconbtn sToggle" title="Activer / désactiver">' + icon(s.enabled ? "pause" : "play") + '</button>' +
        '<button class="iconbtn sEdit" title="Modifier">' + icon("pen") + '</button>' +
        '<button class="iconbtn sDel" title="Supprimer">' + icon("trash") + '</button>' +
      '</div></div>'
  ).join("");
  container.innerHTML =
    '<div class="view-head"><button class="btn small menu-btn" id="menuBtn">' + icon("list") + '</button>' +
    '<h2>' + icon("star") + ' Skills</h2><span class="spacer"></span>' +
    '<button class="btn" id="newSkill">' + icon("add") + ' Créer une skill</button></div>' +
    '<div class="sub" style="color:var(--dim);font-size:13px;margin-bottom:12px;">Les instructions d\'une skill active sont réellement injectées dans le prompt des assistants qui la portent. Import possible depuis GitHub (fichier SKILL.md) ou depuis un fichier local.</div>' +
    '<div class="row" style="margin-bottom:14px;">' +
      '<input type="text" id="skillSearch" placeholder="Rechercher une skill..." value="' + esc(container.dataset.q || "") + '" style="max-width:320px;">' +
      '<button class="btn line" id="importGh">' + icon("github") + ' Importer depuis GitHub</button>' +
      '<button class="btn line" id="importFile">' + icon("folder") + ' Importer un fichier .md</button>' +
      '<input type="file" id="skillFile" accept=".md,.txt" style="display:none;">' +
    '</div>' +
    '<div class="cards">' + (cards || '<div class="empty">Aucune skill trouvée.</div>') + '</div>';
  bindSearch(container);
  container.querySelector("#newSkill").addEventListener("click", ()=> openSkillEditor(null));
  container.querySelector("#importGh").addEventListener("click", importFromGitHub);
  container.querySelector("#importFile").addEventListener("click", ()=> container.querySelector("#skillFile").click());
  container.querySelector("#skillFile").addEventListener("change", e => {
    const f = e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ()=> importSkillText(f.name.replace(/\.[^.]+$/, ""), reader.result);
    reader.readAsText(f);
  });
  container.querySelectorAll(".card").forEach(el => {
    const s = getSkill(el.dataset.id);
    if(!s) return;
    el.querySelector(".sView").addEventListener("click", ()=> showSkill(s));
    el.querySelector(".sToggle").addEventListener("click", ()=>{ s.enabled = s.enabled === false; save(); renderSkills(container); });
    el.querySelector(".sEdit").addEventListener("click", ()=> openSkillEditor(s));
    el.querySelector(".sDel").addEventListener("click", ()=>{
      if(!confirm("Supprimer la skill " + s.name + " ?")) return;
      state.skills = state.skills.filter(x => x.id !== s.id);
      state.assistants.forEach(a => { a.skills = (a.skills || []).filter(x => x !== s.id); });
      save(); renderSkills(container);
    });
  });
  const mb = container.querySelector("#menuBtn");
  if(mb) mb.addEventListener("click", ()=> document.getElementById("sidebar").classList.toggle("open"));
}
function bindSearch(container){
  const inp = container.querySelector("#skillSearch");
  inp.addEventListener("input", ()=>{
    container.dataset.q = inp.value;
    clearTimeout(container._t);
    container._t = setTimeout(()=>{
      const scroll = window.scrollY;
      renderSkills(container);
      window.scrollTo(0, scroll);
      const inp2 = container.querySelector("#skillSearch");
      inp2.focus(); inp2.setSelectionRange(inp2.value.length, inp2.value.length);
    }, 350);
  });
}

function showSkill(s){
  const ov = document.createElement("div");
  ov.className = "overlay show";
  ov.innerHTML = '<div class="modal">' +
    '<button class="iconbtn close-x skClose">' + icon("cross") + '</button>' +
    '<h2>' + icon("star") + ' ' + esc(s.name) + '</h2>' +
    '<div class="sub">' + esc(s.desc || "") + ' — catégorie : ' + esc(s.category || "général") + '</div>' +
    '<div class="sql" style="max-height:50vh;overflow-y:auto;">' + esc(s.instructions || "(aucune instruction)") + '</div>' +
    ((s.files || []).length ? '<div class="hint">Fichiers complémentaires : ' + s.files.map(f => esc(f.name)).join(", ") + '</div>' : '') +
    '</div>';
  document.body.appendChild(ov);
  ov.querySelector(".skClose").addEventListener("click", ()=> ov.remove());
  ov.addEventListener("click", e=>{ if(e.target === ov) ov.remove(); });
}

function openSkillEditor(s){
  const isNew = !s;
  const ov = document.createElement("div");
  ov.className = "overlay show";
  ov.innerHTML = '<div class="modal">' +
    '<button class="iconbtn close-x skClose">' + icon("cross") + '</button>' +
    '<h2>' + icon(isNew ? "add" : "pen") + (isNew ? " Créer une skill" : " Modifier " + esc(s.name)) + '</h2>' +
    '<div class="sub">Les instructions ci-dessous seront réellement transmises au modèle IA.</div>' +
    '<label>Nom</label><input type="text" id="skName" value="' + esc(s ? s.name : "") + '" placeholder="Ex : Rédaction SEO">' +
    '<label>Catégorie</label><select id="skCat">' +
      SKILL_CATEGORIES.map(c => '<option' + (s && s.category === c ? " selected" : "") + '>' + c + '</option>').join("") + '</select>' +
    '<label>Description</label><input type="text" id="skDesc" value="' + esc(s ? s.desc : "") + '">' +
    '<label>Instructions (envoyées au modèle)</label><textarea id="skInstr" style="min-height:160px;">' + esc(s ? s.instructions : "") + '</textarea>' +
    '<button class="btn wide" id="skSave" style="margin-top:16px;">' + icon("check") + (isNew ? " Créer" : " Enregistrer") + '</button></div>';
  document.body.appendChild(ov);
  const close = ()=> ov.remove();
  ov.querySelector(".skClose").addEventListener("click", close);
  ov.addEventListener("click", e=>{ if(e.target === ov) close(); });
  ov.querySelector("#skSave").addEventListener("click", ()=>{
    const name = ov.querySelector("#skName").value.trim();
    if(!name){ toast("Donnez un nom à la skill.", true); return; }
    const data = {
      name,
      category: ov.querySelector("#skCat").value,
      desc: ov.querySelector("#skDesc").value.trim(),
      instructions: ov.querySelector("#skInstr").value.trim()
    };
    if(isNew) state.skills.push(Object.assign({ id: uid(), enabled: true, source: "perso", files: [] }, data));
    else Object.assign(s, data);
    save();
    logActivity("skill « " + esc(name) + " » " + (isNew ? "créée" : "modifiée") + ".", "Système");
    close();
    renderSkills(document.getElementById("view"));
  });
}

export async function importFromGitHub(){
  const url = prompt("URL du fichier SKILL.md sur GitHub (raw ou page GitHub) :", "https://raw.githubusercontent.com/...");
  if(!url) return;
  let raw = url.trim();
  const m = raw.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/(blob|raw)\/(.+)$/);
  if(m) raw = "https://raw.githubusercontent.com/" + m[1] + "/" + m[2] + "/" + m[4];
  try{
    const res = await fetch(raw);
    if(!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    const name = decodeURIComponent(raw.split("/").pop().replace(/\.(md|txt)$/i, ""));
    importSkillText(name, text);
  }catch(e){
    toast("Import impossible : " + e.message, true);
  }
}
function importSkillText(name, text){
  const content = String(text || "").trim();
  if(!content){ toast("Fichier vide.", true); return; }
  let desc = "", instructions = content;
  const fm = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
  if(fm){
    const meta = fm[1];
    const dm = meta.match(/^description:\s*(.+)$/m);
    if(dm) desc = dm[1].trim();
    instructions = fm[2].trim();
  }
  state.skills.push({ id: uid(), name: name.slice(0, 60), desc, category: "Programmation", instructions, enabled: true, source: "perso", files: [] });
  save();
  logActivity("skill « " + esc(name) + " » importée (" + content.length + " caractères d'instructions).", "Système");
  toast("Skill importée : " + name);
  renderSkills(document.getElementById("view"));
}
