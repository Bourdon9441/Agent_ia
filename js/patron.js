/* ============ Le Patron : analyse vos demandes et distribue les tâches ============ */
import { state, save, esc, nowT, uid, logActivity } from "./store.js";
import { icon } from "./icons.js";
import { chat, enqueueLLM, resolveModelFor } from "./engine.js";
import { buildSystemPrompt } from "./assistants.js";
import { renderMarkdown, highlightIn, attachCopyButtons } from "./markdown.js";
import { toast, viewHead, bindMenuBtn } from "./ui.js";

let busy = false;
const normName = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const PATRON_PROMPT = "Tu es le Patron d’une entreprise d’assistants IA. C’est toi qui décides comment le travail est réparti. Tu réponds en français, de façon claire et brève.";

export function ensurePatron(){
  let p = state.assistants.find(a => /^patron/i.test(a.name.trim()));
  if(!p){
    p = {
      id: uid(), name: "Patron",
      desc: "Le chef : il analyse vos demandes et distribue les tâches aux assistants.",
      icon: "crown", color: "#ffd23f",
      systemPrompt: PATRON_PROMPT,
      providerId: "", model: "",
      temperature: 0.3, maxTokens: 1500,
      enabled: true, skills: [], memory: [],
      createdAt: new Date().toISOString()
    };
    state.assistants.unshift(p);
    save();
  }
  return p;
}

function employeesList(exceptId){
  return state.assistants
    .filter(a => a.enabled !== false && a.id !== exceptId)
    .map(a => "• " + a.name + " — " + (a.desc || "assistant"))
    .join("\n") || "• (aucun autre assistant)";
}

export function renderPatron(container){
  const patron = ensurePatron();
  if(!state.patron) state.patron = { messages: [] };
  if(!Array.isArray(state.patron.messages)) state.patron.messages = [];

  const history = state.patron.messages.map(m => {
    if(m.role === "user")
      return '<div class="bub user"><span class="who">vous · ' + esc(m.t) + '</span>' + esc(m.content) + '</div>';
    let stepsHtml = (m.steps || []).map(s =>
      '<div class="team-step"><div class="head">' + icon("user") + ' <b>' + esc(s.name) + '</b><span class="badge">' + esc(s.status || "terminé") + '</span></div><div class="out">' + (s.out || "") + '</div></div>'
    ).join("");
    return '<div class="bub ai"><span class="who">' + esc("Patron") + ' · ' + esc(m.t) + '</span>' + renderMarkdown(m.content) +
      (stepsHtml ? '<div>' + stepsHtml + '</div>' : '') + '</div>';
  }).join("");

  container.innerHTML =
    viewHead('<button class="btn small menu-btn" id="menuBtn">' + icon("list") + '</button>',
      icon("crown") + " Le Patron",
      "Parlez-lui comme à un chef d’équipe : il décide quoi faire et distribue les tâches à vos assistants. Chaque tâche est vraiment exécutée par l’assistant désigné.") +
    '<div class="chatwrap"><div class="chatmain" style="grid-column:1/-1;">' +
      '<div class="chat-top"><span class="name">' + icon("crown") + ' Patron</span><span class="badge">' + esc((resolveModelFor(patron).model) || "modèle non configuré") + '</span></div>' +
      '<div class="chat-log" id="patronLog">' + (history || '<div class="empty">Exemple : « crée-moi un site vitrine pour ma boulangerie » — le Patron demandera au Chercheur de se documenter, au Développeur de coder, au Designer de soigner l’interface et au Code Reviewer de vérifier.</div>') + '</div>' +
      '<div class="chat-input"><textarea id="patronText" placeholder="Donnez votre consigne au Patron... (Entrée pour envoyer)"></textarea>' +
      '<button class="btn" id="patronSend">' + icon("login") + '</button></div>' +
    '</div></div>';
  bindMenuBtn(container);

  const log = container.querySelector("#patronLog");
  highlightIn(log); attachCopyButtons(log);
  log.scrollTop = log.scrollHeight;

  const txt = container.querySelector("#patronText");
  const send = ()=> sendToPatron(container, txt.value);
  container.querySelector("#patronSend").addEventListener("click", send);
  txt.addEventListener("keydown", e=>{ if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); send(); } });
  txt.focus();
}

async function sendToPatron(container, text){
  text = (text || "").trim();
  if(!text || busy) return;
  const patron = ensurePatron();
  if(!state.patron) state.patron = { messages: [] };
  const model = resolveModelFor(patron);
  if(!model.model){ toast("Configurez d’abord une clé (Fournisseurs API) puis un modèle par défaut (Modèles IA).", true); return; }
  busy = true;

  const log = container.querySelector("#patronLog");
  const empty = log.querySelector(".empty");
  if(empty) empty.remove();
  state.patron.messages.push({ role: "user", content: text, t: nowT() });
  log.insertAdjacentHTML("beforeend", '<div class="bub user"><span class="who">vous · ' + nowT() + '</span>' + esc(text) + '</div>' +
    '<div class="bub ai" id="patronPending"><span class="who">Patron</span><span class="thinking"><i></i><i></i><i></i> le Patron analyse votre demande...</span></div>');
  log.scrollTop = log.scrollHeight;
  const sendBtn = container.querySelector("#patronSend");
  if(sendBtn) sendBtn.disabled = true;

  try{
    const reply = await enqueueLLM(()=> chat({ ...model, temperature: 0.2, maxTokens: 1200, messages: [
      { role: "system", content: PATRON_PROMPT +
        "\n\nVos employés assistants :\n" + employeesList(patron.id) +
        "\n\nDécidez : soit vous répondez vous-même (taches vide), soit vous distribuez le travail aux employés les plus adaptés." +
        "\nRépondez UNIQUEMENT avec un objet JSON : {\"reponse\":\"votre réponse directe OU votre plan en une phrase\",\"taches\":[{\"assistant\":\"Nom exact de l'employé\",\"task\":\"tâche précise et autonome\"}]}" +
        "\nMaximum 5 tâches. Chaque tâche doit être compréhensible sans vous." },
      { role: "user", content: text }
    ]}));

    let plan = { reponse: reply, taches: [] };
    try{
      const jm = reply.match(/\{[\s\S]*\}/);
      if(jm){ const j = JSON.parse(jm[0]); if(j && typeof j.reponse === "string") plan = { reponse: j.reponse, taches: Array.isArray(j.taches) ? j.taches : [] }; }
    }catch(e){}

    const pend = container.querySelector("#patronPending");
    if(pend){
      pend.innerHTML = '<span class="who">Patron · ' + nowT() + '</span>' + renderMarkdown(plan.reponse || "Je m’en occupe.") +
        (plan.taches.length ? '<div id="patronSteps"></div>' : '');
      highlightIn(pend); attachCopyButtons(pend);
    }
    const msg = { role: "assistant", content: plan.reponse || "", t: nowT(), steps: [] };

    if(plan.taches.length){
      const steps = container.querySelector("#patronSteps") || pend;
      let context = "Demande du client : " + text;
      for(const t of plan.taches.slice(0, 5)){
        const a = state.assistants.find(x => normName(x.name) === normName(t.assistant) && x.enabled !== false) || state.assistants.find(x => x.enabled !== false && x.id !== patron.id);
        if(!a){ continue; }
        steps.insertAdjacentHTML("beforeend", '<div class="team-step"><div class="head">' + icon("user") + ' <b>' + esc(a.name) + '</b><span class="badge">en cours</span></div><div class="out">' + esc(t.task || "") + '</div></div>');
        log.scrollTop = log.scrollHeight;
        const outEl = steps.lastElementChild.querySelector(".out");
        const badge = steps.lastElementChild.querySelector(".badge");
        const am = resolveModelFor(a);
        if(!am.model){ outEl.textContent = "ignoré : aucun modèle configuré."; badge.textContent = "ignoré"; continue; }
        try{
          const out = await enqueueLLM(()=> chat({ ...am,
            messages: [
              { role: "system", content: buildSystemPrompt(a) + "\n\nTu travailles pour l’entreprise. Le Patron t’a confié cette tâche. Voici le contexte de ce qui a déjà été fait :\n" + context },
              { role: "user", content: "Ta tâche : " + (t.task || "") }
            ],
            temperature: a.temperature ?? 0.7, maxTokens: a.maxTokens || 2000
          }));
          outEl.innerHTML = renderMarkdown(out);
          highlightIn(outEl); attachCopyButtons(outEl);
          badge.textContent = "terminé";
          msg.steps.push({ name: a.name, task: t.task, out: out.slice(0, 4000), status: "terminé" });
          context += "\n\n[" + a.name + " — " + (t.task || "") + "]\n" + out.slice(0, 1500);
          logActivity("Patron → " + a.name + " : " + (t.task || "").slice(0, 60), "Patron");
        }catch(e){
          outEl.innerHTML = '<span style="color:var(--red);">Erreur : ' + esc(e.message) + '</span>';
          badge.textContent = "erreur";
          msg.steps.push({ name: a.name, task: t.task, out: "Erreur : " + e.message, status: "erreur" });
        }
        log.scrollTop = log.scrollHeight;
      }

      const pend2 = container.querySelector("#patronPending");
      if(pend2){
        pend2.insertAdjacentHTML("beforeend", '<div class="team-step"><div class="head">' + icon("crown") + ' <b>Patron</b><span class="badge">synthèse...</span></div><div class="out" id="patronSynth"></div></div>');
        log.scrollTop = log.scrollHeight;
        try{
          const synth = await enqueueLLM(()=> chat({ ...model, temperature: 0.4, maxTokens: 900, messages: [
            { role: "system", content: PATRON_PROMPT + " Vos équipes ont travaillé. Présentez le résultat final au client en quelques phrases claires, en français." },
            { role: "user", content: context }
          ]}));
          const sEl = container.querySelector("#patronSynth");
          if(sEl){
            sEl.closest(".team-step").querySelector(".badge").textContent = "terminé";
            sEl.innerHTML = renderMarkdown(synth);
            highlightIn(sEl); attachCopyButtons(sEl);
          }
          msg.content += "\n\n**Synthèse :** " + synth;
          logActivity("Patron : mission terminée.", "Patron");
        }catch(e){
          const sEl = container.querySelector("#patronSynth");
          if(sEl) sEl.innerHTML = '<span style="color:var(--red);">' + esc(e.message) + '</span>';
        }
      }
    }

    state.patron.messages.push(msg);
    if(state.patron.messages.length > 40) state.patron.messages = state.patron.messages.slice(-40);
    save();
  }catch(e){
    const pend = container.querySelector("#patronPending");
    if(pend) pend.innerHTML = '<span class="who">Patron</span><span style="color:var(--red);">Erreur : ' + esc(e.message) + '</span>';
  }
  busy = false;
  if(sendBtn) sendBtn.disabled = false;
  const log2 = container.querySelector("#patronLog");
  if(log2) log2.scrollTop = log2.scrollHeight;
}
