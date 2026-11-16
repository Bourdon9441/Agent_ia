/* ============ conversations : chat réel avec streaming + markdown ============ */
import { state, save, uid, esc, nowT, logActivity } from "./store.js";
import { icon } from "./icons.js";
import { chat, enqueueLLM, PROVIDERS } from "./providers.js";
import { resolveModelFor } from "./engine.js";
import { buildSystemPrompt, getAssistant } from "./assistants.js";
import { renderMarkdown, highlightIn, attachCopyButtons } from "./markdown.js";
import { toast, viewHead, bindMenuBtn } from "./ui.js";
import { runCollaboration } from "./team.js";

let currentConvId = null;

export function newConversation(assistantId){
  const conv = { id: uid(), assistantId: assistantId || (state.assistants[0] || {}).id || "", title: "Nouvelle conversation", messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  state.conversations.unshift(conv);
  save();
  currentConvId = conv.id;
  return conv;
}
export function getConv(id){ return state.conversations.find(c => c.id === id); }

export function renderConversations(container, openId){
  if(!state.conversations.length) newConversation();
  if(openId && getConv(openId)) currentConvId = openId;
  if(!getConv(currentConvId)) currentConvId = state.conversations[0].id;
  const conv = getConv(currentConvId);
  const assistant = getAssistant(conv.assistantId) || state.assistants[0];
  if(assistant && conv.assistantId !== assistant.id){ conv.assistantId = assistant.id; }

  const convItems = state.conversations.map(c =>
    '<button class="conv-item' + (c.id === currentConvId ? " on" : "") + '" data-id="' + c.id + '"><b>' + esc(c.title) + '</b><span>' + esc((getAssistant(c.assistantId) || {}).name || "sans assistant") + ' · ' + new Date(c.updatedAt).toLocaleDateString("fr-FR") + '</span></button>'
  ).join("");

  const modelOpts = state.assistants.map(a => '<option value="' + a.id + '"' + (a.id === conv.assistantId ? " selected" : "") + '>' + esc(a.name) + '</option>').join("");

  const msgs = conv.messages.map(m =>
    '<div class="bub ' + (m.role === "user" ? "user" : "ai") + '"><span class="who">' + (m.role === "user" ? "vous" : esc((getAssistant(conv.assistantId) || {}).name || "assistant")) + ' · ' + esc(m.t) + '</span>' +
    (m.role === "user" ? esc(m.content) : renderMarkdown(m.content)) + '</div>'
  ).join("");

  container.innerHTML =
    viewHead('<button class="btn small menu-btn" id="menuBtn">' + icon("list") + '</button>', icon("text-bubble") + " Conversations") +
    '<div class="chatwrap">' +
      '<div><div class="row" style="margin-bottom:8px;"><button class="btn small" id="newConv">' + icon("add") + ' Nouvelle</button></div>' +
      '<div class="convlist">' + convItems + '</div></div>' +
      '<div class="chatmain chatmain">' +
        '<div class="chat-top"><span class="name">' + esc(assistant ? assistant.name : "aucun assistant") + '</span>' +
        '<select id="convAssistant" style="max-width:200px;">' + modelOpts + '</select>' +
        '<button class="iconbtn" id="teamRun" title="Lancer une collaboration entre assistants">' + icon("gears") + '</button>' +
        '<button class="iconbtn" id="convDel" title="Supprimer la conversation">' + icon("trash") + '</button></div>' +
        '<div class="chat-log" id="chatLog">' + (msgs || '<div class="empty">Envoyez un premier message.</div>') + '</div>' +
        '<div class="chat-tools"><label style="margin:0;">Modèle</label><select id="convModel"></select></div>' +
        '<div class="chat-input"><textarea id="chatText" placeholder="Écrivez votre message... (Entrée pour envoyer)"></textarea>' +
        '<button class="btn" id="chatSend">' + icon("login") + '</button></div>' +
      '</div>' +
    '</div>';
  bindMenuBtn(container);
  fillModelSelect(container, conv);

  container.querySelector("#newConv").addEventListener("click", ()=>{ newConversation(conv.assistantId); renderConversations(container); });
  container.querySelectorAll(".conv-item").forEach(b => b.addEventListener("click", ()=>{
    currentConvId = b.dataset.id;
    renderConversations(container);
  }));
  container.querySelector("#convAssistant").addEventListener("change", e=>{
    conv.assistantId = e.target.value;
    conv.updatedAt = new Date().toISOString();
    save(); renderConversations(container);
  });
  container.querySelector("#convDel").addEventListener("click", ()=>{
    if(!confirm("Supprimer cette conversation ?")) return;
    state.conversations = state.conversations.filter(c => c.id !== conv.id);
    currentConvId = null;
    save(); renderConversations(container);
  });
  container.querySelector("#teamRun").addEventListener("click", async ()=>{
    const objective = prompt("Objectif à réaliser par une équipe d'assistants (l'Architecte prépare, le Développeur code, le Reviewer vérifie...) :");
    if(!objective || !objective.trim()) return;
    await runCollaboration(objective.trim(), container);
  });
  const sendBtn = container.querySelector("#chatSend");
  const txt = container.querySelector("#chatText");
  const send = ()=> sendMessage(conv, txt.value, container);
  sendBtn.addEventListener("click", send);
  txt.addEventListener("keydown", e=>{
    if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); send(); }
  });
  const log = container.querySelector("#chatLog");
  highlightIn(log); attachCopyButtons(log);
  log.scrollTop = log.scrollHeight;
  txt.focus();
}

function fillModelSelect(container, conv){
  const sel = container.querySelector("#convModel");
  const a = getAssistant(conv.assistantId);
  const cur = resolveModelFor(a);
  sel.innerHTML = '<option value="">modèle par défaut</option>' + PROVIDERS.map(p => {
    const models = cachedModels(p.id);
    return models.map(m => '<option value="' + p.id + "|" + esc(m.id) + '"' + (cur.providerId === p.id && cur.model === m.id ? " selected" : "") + '>' + esc(p.label) + " · " + esc(m.id) + '</option>').join("");
  }).join("");
  sel.addEventListener("change", ()=>{
    if(!a) return;
    const v = sel.value;
    if(!v){ a.providerId = ""; a.model = ""; }
    else { const [pid, ...rest] = v.split("|"); a.providerId = pid; a.model = rest.join("|"); }
    save();
    toast("Modèle de " + a.name + " : " + (a.model || "par défaut"));
  });
}

const modelCache = {};
export function cachedModels(providerId){ return modelCache[providerId] || []; }
export function setCachedModels(providerId, models){ modelCache[providerId] = models; }

export async function sendMessage(conv, text, container){
  text = (text || "").trim();
  if(!text) return;
  const a = getAssistant(conv.assistantId);
  if(!a){ toast("Créez d'abord un assistant.", true); return; }
  const model = resolveModelFor(a);
  if(!model.model){ toast("Aucun modèle par défaut : allez dans Modèles IA pour en choisir un.", true); return; }
  conv.messages.push({ role: "user", content: text, t: nowT() });
  if(conv.title === "Nouvelle conversation") conv.title = text.slice(0, 40);
  conv.updatedAt = new Date().toISOString();
  save();
  const log = container.querySelector("#chatLog");
  if(log){
    log.insertAdjacentHTML("beforeend", '<div class="bub user"><span class="who">vous · ' + nowT() + '</span>' + esc(text) + '</div>' +
      '<div class="bub ai" id="pendingBub"><span class="who">' + esc(a.name) + '</span><span class="thinking"><i></i><i></i><i></i> ' + esc(a.name) + ' réfléchit...</span></div>');
    log.scrollTop = log.scrollHeight;
  }
  const sendBtn = container.querySelector("#chatSend");
  if(sendBtn) sendBtn.disabled = true;
  const history = conv.messages.slice(-20).map(m => ({ role: m.role, content: m.content }));
  try{
    let full = "";
    const out = await enqueueLLM(()=> chat({
      ...model,
      messages: [{ role: "system", content: buildSystemPrompt(a) }, ...history],
      temperature: a.temperature ?? 0.7,
      maxTokens: a.maxTokens || 2000,
      onDelta: (state.settings.streaming !== false) ? ((piece, acc) => {
        full = acc;
        const bub = container.querySelector("#pendingBub");
        if(bub){ bub.innerHTML = '<span class="who">' + esc(a.name) + '</span>' + renderMarkdown(acc); log.scrollTop = log.scrollHeight; }
      }) : undefined
    }));
    conv.messages.push({ role: "assistant", content: out || "(réponse vide)", t: nowT() });
    conv.updatedAt = new Date().toISOString();
    save();
    if(log){
      const bub = container.querySelector("#pendingBub");
      if(bub){
        bub.remove();
        log.insertAdjacentHTML("beforeend", '<div class="bub ai"><span class="who">' + esc(a.name) + ' · ' + nowT() + '</span>' + renderMarkdown(out) + '</div>');
        highlightIn(log); attachCopyButtons(log);
        log.scrollTop = log.scrollHeight;
      } else renderConversations(container);
    }
  }catch(e){
    const bub = container.querySelector("#pendingBub");
    if(bub) bub.innerHTML = '<span class="who">' + esc(a.name) + '</span><span style="color:var(--red);">Erreur : ' + esc(e.message) + '</span>';
    conv.messages.push({ role: "assistant", content: "Erreur : " + e.message, t: nowT() });
    save();
  }
  if(sendBtn) sendBtn.disabled = false;
}

export function renderHistory(container){
  const items = state.conversations.map(c =>
    '<div class="card" data-id="' + c.id + '"><div class="head"><span class="name">' + esc(c.title) + '</span>' +
    '<span class="badge">' + esc((getAssistant(c.assistantId) || {}).name || "sans assistant") + '</span></div>' +
    '<div class="meta">' + c.messages.length + ' message(s) · ' + new Date(c.updatedAt).toLocaleString("fr-FR") + '</div>' +
    '<div class="foot"><button class="btn line small hOpen">' + icon("text-bubble") + ' Ouvrir</button>' +
    '<button class="iconbtn hDel" title="Supprimer">' + icon("trash") + '</button></div></div>'
  ).join("");
  container.innerHTML =
    viewHead(icon("clock"), " Historique", "Toutes vos conversations, les plus récentes en premier.") +
    '<div class="cards">' + (items || '<div class="empty">Aucune conversation enregistrée.</div>') + '</div>';
  bindMenuBtn(container);
  container.querySelectorAll(".card").forEach(el => {
    el.querySelector(".hOpen").addEventListener("click", ()=>{ location.hash = "#/conversations/" + el.dataset.id; });
    el.querySelector(".hDel").addEventListener("click", ()=>{
      state.conversations = state.conversations.filter(c => c.id !== el.dataset.id);
      save(); renderHistory(container);
    });
  });
}
