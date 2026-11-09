(function(){
 "use strict";
 const view=document.getElementById("documents"),body=document.getElementById("documentsTable");
 if(!view||!body)return;
 const panel=body.closest(".panel"),tableWrap=body.closest(".table-wrap");
 if(!panel||!tableWrap)return;
 const toolbar=document.createElement("div");
 toolbar.className="archive-search-toolbar";
 toolbar.innerHTML='<label for="archiveCompanySearch">Hľadať firmu v archíve<input id="archiveCompanySearch" type="search" autocomplete="off" placeholder="Názov firmy"></label><span class="archive-search-count" id="archiveSearchCount"></span>';
 panel.insertBefore(toolbar,tableWrap);
 const empty=document.createElement("div");
 empty.className="archive-filter-empty";empty.hidden=true;
 empty.textContent="Pre túto firmu sa v archíve nenašiel dokument.";
 tableWrap.after(empty);
 const search=toolbar.querySelector("input"),count=toolbar.querySelector(".archive-search-count");
 const fold=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("sk").trim();
 function apply(){
  const query=fold(search.value),rows=[...body.querySelectorAll("tr")],documents=rows.filter(row=>row.cells.length>2&&!row.cells[0].hasAttribute("colspan"));
  let shown=0;
  for(const row of documents){const match=!query||fold(row.cells[2].textContent).includes(query);row.hidden=!match;if(match)shown++}
  empty.hidden=!query||shown>0||!documents.length;
  count.textContent=query?`${shown} z ${documents.length} dokumentov`:`${documents.length} dokumentov`;
 }
 search.addEventListener("input",apply);
 new MutationObserver(apply).observe(body,{childList:true});
 apply();
})();
