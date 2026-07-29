const header=document.querySelector(".site-header"),menu=document.querySelector(".menu");
const updateHeader=()=>header.classList.toggle("scrolled",scrollY>20);
updateHeader();addEventListener("scroll",updateHeader,{passive:true});
menu?.addEventListener("click",()=>{const open=document.body.classList.toggle("nav-open");menu.setAttribute("aria-expanded",String(open));menu.textContent=open?"×":"☰"});
