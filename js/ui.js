/* ============ petits utilitaires d'interface ============ */
let toastTimer = null;
export function toast(msg, isErr){
  const el = document.getElementById("toast");
  if(!el) return;
  el.textContent = msg;
  el.className = "toast show" + (isErr ? " err" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ el.className = "toast"; }, 3200);
}
export function viewHead(iconHtml, title, sub){
  return '<div class="view-head"><button class="btn small menu-btn" id="menuBtn">' + iconHtml + '</button>' +
    '<h2>' + title + '</h2><span class="spacer"></span></div>' +
    (sub ? '<div class="sub" style="color:var(--dim);font-size:13px;margin:-8px 0 16px;">' + sub + '</div>' : '');
}
export function bindMenuBtn(container){
  const mb = container.querySelector("#menuBtn");
  if(mb) mb.addEventListener("click", ()=> document.getElementById("sidebar").classList.toggle("open"));
}
