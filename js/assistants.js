/* ============ gestion des assistants ============ */
import { state, save, uid, esc, logActivity } from "./store.js";
import { icon } from "./icons.js";
import { chat, enqueueLLM, resolveModelFor } from "./engine.js";
import { renderMarkdown } from "./markdown.js";
import { toast } from "./ui.js";

export const COLORS = ["#c6f542","#5db8ff","#ff6b6b","#ffd23f","#ff9f45","#b48cff","#4fe3c1","#ff7ac8"];
export const AVATARS = ["sparkles","code","search","pen","shield","gears","star","eye","user","globe"];

export const PRESET_ASSISTANTS = [
  { name: "Développeur", icon: "code", color: "#c6f542", desc: "Programmation et création d'applications.", systemPrompt: "Tu es Développeur, un ingénieur logiciel senior. Tu écris du code complet, propre, fonctionnel et bien structuré. Tu expliques brièvement tes choix techniques. Tu utilises des blocs de code avec le langage indiqué." },
  { name: "Code Reviewer", icon: "eye", color: "#5db8ff", desc: "Vérification du code.", systemPrompt: "Tu es Code Reviewer. Tu analyses le code qu'on te soumet : bugs, failles, performance, lisibilité. Tu listes les problèmes par gravité (bloquant, majeur, mineur) avec des corrections concrètes en code. Tu es exigeant mais constructif." },
  { name: "Designer", icon: "palette", color: "#ff7ac8", desc: "Conception UI/UX.", systemPrompt: "Tu es Designer, expert UI/UX. Tu proposes des interfaces premium, minimalistes et accessibles : hiérarchie visuelle, espacements, typographie, couleurs, états interactifs. Tu fournis des maquettes décrites précisément ou du HTML/CSS quand c'est utile." },
  { name: "Chercheur", icon: "search", color: "#ffd23f", desc: "Recherche et synthèse d'informations.", systemPrompt: "Tu es Chercheur. Tu structures toute recherche : contexte, faits essentiels, sources à vérifier, synthèse actionnable. Tu signales clairement ce qui est incertain ou à vérifier." },
  { name: "Expert API", icon: "globe", color: "#4fe3c1", desc: "Recherche et intégration d'API.", systemPrompt: "Tu es Expert API. Tu trouves les API adaptées à un besoin, tu lis leur documentation, tu écris le code d'intégration (auth, requêtes, gestion d'erreurs, limites de débit) et tu signales les pièges (CORS, quotas, prix)." },
  { name: "Débogueur", icon: "gears", color: "#ff9f45", desc: "Détection et correction des erreurs.", systemPrompt: "Tu es Débogueur. On te donne une erreur ou un comportement anormal : tu formes des hypothèses classées par probabilité, tu proposes le diagnostic minimal et le correctif précis en code. Tu ne devines pas : tu demandes les informations manquantes si nécessaire." },
  { name: "Expert cybersécurité", icon: "shield", color: "#ff6b6b", desc: "Analyse de sécurité.", systemPrompt: "Tu es Expert cybersécurité. Tu analyses code et architectures : failles OWASP, gestion des secrets, validation des entrées, permissions, RGPD. Tu classes les risques (critique, élevé, moyen, faible) et tu donnes les remèdes concrets." },
  { name: "Architecte", icon: "star", color: "#b48cff", desc: "Conception technique.", systemPrompt: "Tu es Architecte logiciel. Tu conçois des architectures modulaires et évolutives : composants, responsabilités, flux de données, technologies, compromis. Tu produis des plans clairs que d'autres peuvent exécuter, et tu justifies chaque choix majeur." },
  { name: "Assistant général", icon: "sparkles", color: "#4fe3c1", desc: "Assistant polyvalent.", systemPrompt: "Tu es un assistant polyvalent, direct et utile. Tu réponds en français, de façon claire et structurée, et tu demandes ce qu'il manque quand la demande est ambiguë." }
];

export function ensurePresets(){
  if(state.assistants.length) return;
  for(const p of PRESET_ASSISTANTS){
    state.assistants.push({
      id: uid(), name: p.name, desc: p.desc, icon: p.icon, color: p.color,
      systemPrompt: p.systemPrompt, providerId: "", model: "",
      temperature: 0.7, maxTokens: 2000, enabled: true,
      skills: [], memory: [], createdAt: new Date().toISOString()
    });
  }
  logActivity("9 assistants préconfigurés créés (Développeur, Designer, Chercheur...).", "Système");
  save();
}

export function getAssistant(id){ return state.assistants.find(a => a.id === id); }

export function buildSystemPrompt(a){
  let p = a.systemPrompt || "Tu es un assistant utile.";
  const skills = (a.skills || []).map(id => state.skills.find(s => s.id === id)).filter(Boolean).filter(s => s.enabled !== false);
  if(skills.length){
    p += "\n\n## Compétences (skills) que tu maîtrises — applique leurs instructions :\n" +
      skills.map(s => "### Skill : " + s.name + "\n" + (s.instructions || "")).join("\n\n");
  }
  const mem = (a.memory || []).filter(Boolean);
  if(mem.length) p += "\n\n## Ta mémoire personnelle (informations à retenir) :\n" + mem.join("\n");
  const shared = (state.memories || []).filter(Boolean);
  if(shared.length) p += "\n\n## Mémoire partagée de l'entreprise (documents et connaissances communes) :\n" +
    shared.map(m => "### " + m.title + "\n" + m.content).join("\n\n");
  return p;
}

export function renderAssistants(container){
  const cards = state.assistants.map(a => {
    const skills = (a.skills || []).length;
    return '<div class="card" data-id="' + a.id + '" style="' + (a.enabled ? "" : "opacity:.55;") + '">' +
      '<div class="head"><span class="avatar" style="background:' + esc(a.color) + '">' + icon(a.icon || "sparkles") + '</span>' +
      '<span class="name">' + esc(a.name) + '</span>' +
      '<span class="badge ' + (a.enabled ? "on" : "off") + '">' + (a.enabled ? "actif" : "inactif") + '</span></div>' +
      '<div class="desc">' + esc(a.desc || "") + '</div>' +
      '<div class="meta">' + esc(a.model || "modèle par défaut") + ' · ' + skills + ' skill(s) · ' + (a.memory || []).length + ' souvenir(s)</div>' +
      '<div class="foot">' +
        '<button class="btn line small aChat">' + icon("text-bubble") + ' Discuter</button>' +
        '<button class="btn line small aTest">' + icon("check") + ' Tester</button>' +
        '<button class="iconbtn aEdit" title="Modifier">' + icon("pen") + '</button>' +
        '<button class="iconbtn aDup" title="Dupliquer">' + icon("list") + '</button>' +
        '<button class="iconbtn aDel" title="Supprimer">' + icon("trash") + '</button>' +
      '</div></div>';
  }).join("");
  container.innerHTML =
    '<div class="view-head"><button class="btn small menu-btn" id="menuBtn">' + icon("list") + '</button>' +
    '<h2>' + icon("user") + ' Mes assistants</h2><span class="spacer"></span>' +
    '<button class="btn" id="newAssistant">' + icon("add") + ' Créer un assistant</button></div>' +
    '<div class="sub" style="color:var(--dim);font-size:13px;margin-bottom:16px;">Chaque assistant a son propre prompt système, son modèle, ses skills et sa mémoire. Les skills sont réellement transmises au modèle.</div>' +
    '<div class="cards">' + (cards || '<div class="empty">Aucun assistant.</div>') + '</div>';

  container.querySelector("#newAssistant").addEventListener("click", ()=> openAssistantEditor(null));
  container.querySelectorAll(".card").forEach(el => {
    const a = getAssistant(el.dataset.id);
    if(!a) return;
    el.querySelector(".aChat").addEventListener("click", ()=>{
      location.hash = "#/conversations/" + a.id;
    });
    el.querySelector(".aTest").addEventListener("click", async e => {
      const btn = e.currentTarget;
      btn.disabled = true; btn.textContent = "Test...";
      try{
        const out = await enqueueLLM(()=> chat({ ...resolveModelFor(a), messages: [
          { role: "system", content: buildSystemPrompt(a) },
          { role: "user", content: "Réponds exactement : prêt à travailler." }
        ], temperature: 0.2, maxTokens: 500 }));
        toast(a.name + " répond : " + out.slice(0, 60));
      }catch(err){ toast(err.message, true); }
      btn.disabled = false;
      btn.innerHTML = icon("check") + " Tester";
    });
    el.querySelector(".aEdit").addEventListener("click", ()=> openAssistantEditor(a));
    el.querySelector(".aDup").addEventListener("click", ()=>{
      const copy = JSON.parse(JSON.stringify(a));
      copy.id = uid(); copy.name = a.name + " (copie)";
      state.assistants.push(copy); save();
      logActivity("assistant « " + esc(a.name) + " » dupliqué.", "Système");
      renderAssistants(container);
    });
    el.querySelector(".aDel").addEventListener("click", ()=>{
      if(!confirm("Supprimer " + a.name + " ?")) return;
      state.assistants = state.assistants.filter(x => x.id !== a.id);
      save();
      logActivity("assistant « " + esc(a.name) + " » supprimé.", "Système");
      renderAssistants(container);
    });
  });
  const mb = container.querySelector("#menuBtn");
  if(mb) mb.addEventListener("click", ()=> document.getElementById("sidebar").classList.toggle("open"));
}

export function openAssistantEditor(a){
  const isNew = !a;
  const ov = document.createElement("div");
  ov.className = "overlay show";
  const roleOpts = state.skills.map(s => '<option value="' + s.id + '"' + (a && (a.skills || []).includes(s.id) ? " selected" : "") + '>' + esc(s.name) + '</option>').join("");
  ov.innerHTML = '<div class="modal">' +
    '<button class="iconbtn close-x aeClose">' + icon("cross") + '</button>' +
    '<h2>' + icon(isNew ? "add" : "pen") + (isNew ? " Créer un assistant" : " Modifier " + esc(a.name)) + '</h2>' +
    '<div class="sub">Tout est réellement envoyé au modèle : prompt système, skills, mémoire, température.</div>' +
    '<div class="row"><div style="flex:1"><label>Nom</label><input type="text" id="aeName" value="' + esc(a ? a.name : "") + '" placeholder="Ex : Rédacteur web"></div>' +
    '<div style="max-width:110px;"><label>Couleur</label><input type="color" id="aeColor" value="' + esc(a ? a.color : COLORS[0]) + '" style="width:100%;height:40px;background:var(--bg);border:1px solid var(--line2);border-radius:9px;padding:4px;"></div></div>' +
    '<label>Description</label><input type="text" id="aeDesc" value="' + esc(a ? a.desc : "") + '" placeholder="À quoi sert cet assistant ?">' +
    '<label>Prompt système</label><textarea id="aeSys" style="min-height:110px;">' + esc(a ? a.systemPrompt : "") + '</textarea>' +
    '<label>Skills attribuées (leurs instructions sont envoyées au modèle)</label>' +
    '<select id="aeSkills" multiple size="4">' + roleOpts + '</select>' +
    '<label>Mémoire personnelle (une information par ligne)</label>' +
    '<textarea id="aeMem" placeholder="Ex : l\'entreprise s\'appelle...">' + esc(a ? (a.memory || []).join("\n") : "") + '</textarea>' +
    '<div class="row" style="margin-top:12px;">' +
      '<div style="flex:1"><label>Température (0 = précis, 1 = créatif)</label><input type="number" id="aeTemp" min="0" max="2" step="0.1" value="' + (a ? (a.temperature ?? 0.7) : 0.7) + '"></div>' +
      '<div style="flex:1"><label>Tokens max</label><input type="number" id="aeMax" min="100" max="32000" step="100" value="' + (a ? (a.maxTokens || 2000) : 2000) + '"></div></div>' +
    '<button class="btn wide" id="aeSave" style="margin-top:16px;">' + icon("check") + (isNew ? " Créer" : " Enregistrer") + '</button></div>';
  document.body.appendChild(ov);
  const close = ()=> ov.remove();
  ov.querySelector(".aeClose").addEventListener("click", close);
  ov.addEventListener("click", e=>{ if(e.target === ov) close(); });
  ov.querySelector("#aeSave").addEventListener("click", ()=>{
    const name = ov.querySelector("#aeName").value.trim();
    if(!name){ toast("Donnez un nom à l'assistant.", true); return; }
    const skills = Array.from(ov.querySelector("#aeSkills").selectedOptions).map(o => o.value);
    const memory = ov.querySelector("#aeMem").value.split("\n").map(s => s.trim()).filter(Boolean);
    const data = {
      name,
      desc: ov.querySelector("#aeDesc").value.trim(),
      color: ov.querySelector("#aeColor").value,
      systemPrompt: ov.querySelector("#aeSys").value.trim() || "Tu es un assistant utile.",
      skills, memory,
      temperature: Math.min(2, Math.max(0, parseFloat(ov.querySelector("#aeTemp").value) || 0.7)),
      maxTokens: Math.min(32000, Math.max(100, parseInt(ov.querySelector("#aeMax").value) || 2000))
    };
    if(isNew){
      state.assistants.push(Object.assign({
        id: uid(), icon: "sparkles", providerId: "", model: "", enabled: true,
        createdAt: new Date().toISOString()
      }, data));
      logActivity("assistant « " + esc(name) + " » créé.", "Système");
    } else {
      Object.assign(a, data);
      logActivity("assistant « " + esc(name) + " » modifié.", "Système");
    }
    save();
    close();
    const view = document.getElementById("view");
    renderAssistants(view);
  });
}
