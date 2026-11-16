/* ============ collaboration entre assistants (orchestration réelle) ============ */
import { state, save, esc, logActivity, nowT } from "./store.js";
import { icon } from "./icons.js";
import { chat, enqueueLLM, resolveModelFor } from "./engine.js";
import { buildSystemPrompt, getAssistant } from "./assistants.js";
import { renderMarkdown, highlightIn, attachCopyButtons } from "./markdown.js";
import { toast } from "./ui.js";

let running = false;

export async function runCollaboration(objective, container){
  if(running){ toast("Une collaboration est déjà en cours.", true); return; }
  const log = container.querySelector("#chatLog");
  if(!log) return;
  const coordinator = state.assistants.find(a => /architecte/i.test(a.name)) || state.assistants[0];
  if(!coordinator){ toast("Créez d'abord un assistant.", true); return; }
  const model = resolveModelFor(coordinator);
  if(!model.model){ toast("Aucun modèle par défaut configuré (Modèles IA).", true); return; }
  running = true;
  const teamDesc = state.assistants.filter(a => a.enabled !== false).map(a => a.name + " — " + (a.desc || "")).join(" ; ");
  log.insertAdjacentHTML("beforeend", '<div class="bub ai" id="teamBlock"><span class="who">collaboration d\'équipe · ' + nowT() + '</span><div id="teamSteps"></div></div>');
  const steps = container.querySelector("#teamSteps");
  const addStep = (name, task, status) => {
    steps.insertAdjacentHTML("beforeend", '<div class="team-step"><div class="head">' + icon("user") + ' <b>' + esc(name) + '</b><span class="badge">' + esc(status) + '</span></div><div class="out">' + esc(task) + '</div></div>');
    log.scrollTop = log.scrollHeight;
    return steps.lastElementChild.querySelector(".out");
  };
  try{
    addStep("Coordination", "Découpage de l'objectif : « " + objective + " »", "en cours");
    const reply = await enqueueLLM(()=> chat({ ...model, temperature: 0.3, maxTokens: 1200, messages: [
      { role: "system", content: "Tu es le coordinateur d'une équipe d'assistants IA. Équipe disponible : " + teamDesc + ". Découpe l'objectif de l'utilisateur en étapes séquentielles (max 5), chacune confiée à l'assistant le plus adapté (l'Architecte prépare, le Chercheur recherche, le Développeur code, le Designer améliore, le Code Reviewer vérifie...). Réponds UNIQUEMENT avec un tableau JSON : [{\"assistant\":\"Nom exact\",\"task\":\"l'étape\"}]." },
      { role: "user", content: objective }
    ]}));
    const m = reply.match(/\[[\s\S]*\]/);
    const plan = m ? JSON.parse(m[0]) : [];
    if(!Array.isArray(plan) || !plan.length) throw new Error("le coordinateur n'a produit aucun plan exploitable");
    steps.lastElementChild.remove();
    let context = "Objectif : " + objective;
    for(const step of plan.slice(0, 5)){
      const a = getAssistant((state.assistants.find(x => x.name.toLowerCase() === String(step.assistant || "").toLowerCase()) || {}).id) || state.assistants[0];
      const outEl = addStep(a.name, step.task, "en cours");
      const am = resolveModelFor(a);
      if(!am.model){ outEl.textContent = "ignoré : aucun modèle configuré."; continue; }
      try{
        const out = await enqueueLLM(()=> chat({ ...am,
          messages: [
            { role: "system", content: buildSystemPrompt(a) + "\n\nTu travailles en équipe sur un objectif commun. Voici ce qui a déjà été fait par tes collègues :\n" + context },
            { role: "user", content: "Ton étape : " + step.task }
          ],
          temperature: a.temperature ?? 0.7, maxTokens: a.maxTokens || 2000
        }));
        outEl.innerHTML = renderMarkdown(out);
        highlightIn(outEl); attachCopyButtons(outEl);
        context += "\n\n[" + a.name + " — " + step.task + "]\n" + out.slice(0, 1500);
        logActivity("équipe : " + esc(a.name) + " a terminé « " + esc(step.task) + " ».", "Équipe");
      }catch(e){
        outEl.innerHTML = '<span style="color:var(--red);">Erreur : ' + esc(e.message) + '</span>';
      }
      log.scrollTop = log.scrollHeight;
    }
    logActivity("collaboration terminée : « " + esc(objective) + " ».", "Équipe");
  }catch(e){
    const steps2 = container.querySelector("#teamSteps");
    if(steps2) steps2.insertAdjacentHTML("beforeend", '<div class="msg err">Erreur de collaboration : ' + esc(e.message) + '</div>');
  }
  running = false;
  save();
}
