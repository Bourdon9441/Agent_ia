/* ============ rendu Markdown sûr (marked + DOMPurify + highlight.js) ============ */
export function renderMarkdown(text){
  let html = "";
  try{
    html = window.marked ? window.marked.parse(String(text || "")) : "<p>" + String(text || "") + "</p>";
  }catch(e){
    html = "<p>" + String(text || "") + "</p>";
  }
  if(window.DOMPurify) html = window.DOMPurify.sanitize(html);
  return html;
}
export function highlightIn(el){
  if(!window.hljs || !el) return;
  el.querySelectorAll("pre code").forEach(b => { try{ window.hljs.highlightElement(b); }catch(e){} });
}
export function attachCopyButtons(el){
  if(!el) return;
  el.querySelectorAll("pre").forEach(pre => {
    if(pre.querySelector(".code-copy")) return;
    const btn = document.createElement("button");
    btn.className = "code-copy";
    btn.textContent = "copier";
    btn.addEventListener("click", ()=>{
      const code = pre.querySelector("code");
      navigator.clipboard.writeText(code ? code.innerText : pre.innerText).then(()=>{
        btn.textContent = "copié ✓";
        setTimeout(()=>{ btn.textContent = "copier"; }, 1500);
      });
    });
    pre.appendChild(btn);
  });
}
