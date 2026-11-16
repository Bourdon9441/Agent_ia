/* ============ mémoire partagée (les souvenirs personnels sont dans chaque assistant) ============ */
import { state, save, uid, esc, logActivity } from "./store.js";
import { icon } from "./icons.js";
import { viewHead, bindMenuBtn, toast } from "./ui.js";

export function renderMemory(container){
  const items = (state.memories || []).map(m =>
    '<div class="card" data-id="' + m.id + '"><div class="head"><span class="name">' + esc(m.title) + '</span>' +
    '<span class="badge">' + new Date(m.t).toLocaleDateString("fr-FR") + '</span></div>' +
    '<div class="desc" style="white-space:pre-wrap;">' + esc(m.content) + '</div>' +
    '<div class="foot"><button class="btn line small mEdit">' + icon("pen") + ' Modifier</button>' +
    '<button class="iconbtn mDel" title="Supprimer">' + icon("trash") + '</button></div></div>'
  ).join("");
  container.innerHTML =
    viewHead(icon("folder"), " Mémoire", "Deux niveaux : la mémoire partagée ici (accessible à tous les assistants), et la mémoire personnelle de chaque assistant (dans sa fiche). Tout est réellement injecté dans les prompts.") +
    '<div class="row" style="margin-bottom:14px;"><input type="text" id="memTitle" placeholder="Titre (ex : Infos entreprise)">' +
    '<button class="btn" id="memAdd">' + icon("add") + ' Ajouter</button></div>' +
    '<textarea id="memContent" placeholder="Contenu du document / connaissance (texte libre)..." style="min-height:100px;"></textarea>' +
    '<div class="cards" style="margin-top:16px;">' + (items || '<div class="empty">Mémoire partagée vide.</div>') + '</div>';
  bindMenuBtn(container);
  container.querySelector("#memAdd").addEventListener("click", ()=>{
    const title = container.querySelector("#memTitle").value.trim();
    const content = container.querySelector("#memContent").value.trim();
    if(!title || !content){ toast("Titre et contenu requis.", true); return; }
    state.memories.unshift({ id: uid(), title, content, t: Date.now() });
    save();
    logActivity("mémoire partagée : « " + esc(title) + " » ajoutée.", "Système");
    renderMemory(container);
  });
  container.querySelectorAll(".card").forEach(el => {
    const m = state.memories.find(x => x.id === el.dataset.id);
    if(!m) return;
    el.querySelector(".mEdit").addEventListener("click", ()=>{
      const t = prompt("Titre :", m.title);
      if(t === null) return;
      const c = prompt("Contenu :", m.content);
      if(c === null) return;
      m.title = t.trim() || m.title; m.content = c;
      save(); renderMemory(container);
    });
    el.querySelector(".mDel").addEventListener("click", ()=>{
      if(!confirm("Supprimer « " + m.title + " » de la mémoire partagée ?")) return;
      state.memories = state.memories.filter(x => x.id !== m.id);
      save(); renderMemory(container);
    });
  });
}
