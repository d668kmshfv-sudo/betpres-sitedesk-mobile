(function(){
 "use strict";
 const scriptUrl=document.currentScript?.src||new URL("assets/js/features/document-settings.js",document.baseURI).href;
 const defaults={accentColor:"#123b68",workAccentColor:"#0a5b91",workerAccentColor:"#0a5b91"};
 const imagePattern=/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i;
 const maxDataUrlLength=950000;
 const get=id=>document.getElementById(id);
 const validColor=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(String(value||""))?String(value).toLowerCase():fallback;
 const contrastColor=color=>{
  const rgb=[1,3,5].map(start=>parseInt(color.slice(start,start+2),16)/255).map(channel=>channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.34?"#173044":"#fff"
 };
 function theme(){
  const settings=state.documentStyle&&typeof state.documentStyle==="object"?state.documentStyle:{};
  const image=String(settings.letterheadDataUrl||"");
  return{
   letterheadImage:image.length<=maxDataUrlLength&&imagePattern.test(image)?image:DEFAULT_LETTERHEAD_IMAGE,
   accentColor:validColor(settings.accentColor,defaults.accentColor),
   workAccentColor:validColor(settings.workAccentColor,defaults.workAccentColor),
   workerAccentColor:validColor(settings.workerAccentColor,defaults.workerAccentColor)
  }
 }
 function apply(){
  const current=theme(),root=document.documentElement;
  LETTERHEAD_IMAGE=current.letterheadImage;
  root.style.setProperty("--betpres-document-accent",current.accentColor);
  root.style.setProperty("--betpres-work-accent",current.workAccentColor);
  root.style.setProperty("--betpres-worker-accent",current.workerAccentColor);
  root.style.setProperty("--betpres-work-on",contrastColor(current.workAccentColor));
  root.style.setProperty("--betpres-worker-on",contrastColor(current.workerAccentColor));
  if(get("documentLetterheadPreview")&&get("documentLetterheadPreview").src!==current.letterheadImage)get("documentLetterheadPreview").src=current.letterheadImage;
  for(const [id,key] of [["documentAccentColor","accentColor"],["documentWorkAccentColor","workAccentColor"],["documentWorkerAccentColor","workerAccentColor"]])if(get(id)&&get(id).value!==current[key])get(id).value=current[key];
  return current
 }
 function setStatus(message,error=false){const node=get("documentSettingsStatus");if(!node)return;node.textContent=message;node.classList.toggle("is-error",error)}
 function ensureSettings(){if(!state.documentStyle||typeof state.documentStyle!=="object"||Array.isArray(state.documentStyle))state.documentStyle={};return state.documentStyle}
 function fitToPage(source,width,height){
  const canvas=document.createElement("canvas");canvas.width=1600;canvas.height=2263;
  const context=canvas.getContext("2d",{alpha:false});if(!context)throw new Error("Prehliadač nevie pripraviť obrázok hlavičkového papiera.");
  context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);
  const scale=Math.min(canvas.width/width,canvas.height/height),drawWidth=width*scale,drawHeight=height*scale;
  context.drawImage(source,(canvas.width-drawWidth)/2,(canvas.height-drawHeight)/2,drawWidth,drawHeight);
  return canvas
 }
 async function imageCanvas(file){
  const url=URL.createObjectURL(file),image=new Image();
  try{
   await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error("Obrázok sa nepodarilo otvoriť."));image.src=url});
   return fitToPage(image,image.naturalWidth,image.naturalHeight)
  }finally{URL.revokeObjectURL(url)}
 }
 async function pdfCanvas(file){
  const library=await import(new URL("../vendor/pdfjs/pdf.mjs",scriptUrl).href);
  library.GlobalWorkerOptions.workerSrc=new URL("../vendor/pdfjs/pdf.worker.mjs",scriptUrl).href;
  const task=library.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true});
  let pdf;
  try{
   pdf=await task.promise;
   const page=await pdf.getPage(1),size=page.getViewport({scale:1}),scale=Math.min(1600/size.width,2263/size.height),viewport=page.getViewport({scale});
   const source=document.createElement("canvas");source.width=Math.max(1,Math.round(viewport.width));source.height=Math.max(1,Math.round(viewport.height));
   const context=source.getContext("2d",{alpha:false});if(!context)throw new Error("Prehliadač nevie vykresliť PDF.");
   context.fillStyle="#fff";context.fillRect(0,0,source.width,source.height);
   await page.render({canvasContext:context,viewport,background:"#fff"}).promise;
   const output=fitToPage(source,source.width,source.height);source.width=0;source.height=0;page.cleanup();
   return output
  }finally{if(pdf)await pdf.destroy();else await task.destroy()}
 }
 function compressedDataUrl(source){
  let canvas=source;
  for(let scaleStep=0;scaleStep<4;scaleStep++){
   for(const quality of [.84,.73,.62,.52]){
    const dataUrl=canvas.toDataURL("image/jpeg",quality);
    if(dataUrl.length<=maxDataUrlLength)return dataUrl
   }
   const smaller=document.createElement("canvas");smaller.width=Math.max(900,Math.round(canvas.width*.82));smaller.height=Math.max(1270,Math.round(canvas.height*.82));
   smaller.getContext("2d",{alpha:false}).drawImage(canvas,0,0,smaller.width,smaller.height);
   if(canvas!==source){canvas.width=0;canvas.height=0}
   canvas=smaller
  }
  throw new Error("Hlavičkový papier je príliš zložitý. Skús menší obrázok alebo PDF.")
 }
 async function upload(file){
  if(!file)return;
  if(file.size>20*1024*1024){setStatus("Súbor má viac ako 20 MB. Vyber menší obrázok alebo PDF.",true);return}
  setStatus("Pripravujem hlavičkový papier…");
  try{
   const pdf=file.type==="application/pdf"||/\.pdf$/i.test(file.name),image=/^image\/(?:jpeg|png|webp)$/i.test(file.type)||/\.(?:jpe?g|png|webp)$/i.test(file.name);
   if(!pdf&&!image)throw new Error("Vyber PDF, JPG, PNG alebo WebP.");
   const canvas=pdf?await pdfCanvas(file):await imageCanvas(file),dataUrl=compressedDataUrl(canvas);
   canvas.width=0;canvas.height=0;
   const settings=ensureSettings();settings.letterheadDataUrl=dataUrl;settings.letterheadName=file.name;settings.updatedAt=new Date().toISOString();
   apply();save("Hlavičkový papier bol zmenený a uložený.");
   setStatus(`Používa sa ${file.name}.`)
  }catch(error){setStatus(error.message||"Hlavičkový papier sa nepodarilo uložiť.",true)}
  finally{get("documentLetterheadFile").value=""}
 }
 function resetLetterhead(){const settings=ensureSettings();delete settings.letterheadDataUrl;delete settings.letterheadName;settings.updatedAt=new Date().toISOString();apply();save("Pôvodný hlavičkový papier bol obnovený.");setStatus("Používa sa pôvodný hlavičkový papier BETPRES.")}
 function changeColor(id,key){const input=get(id);if(!input)return;const settings=ensureSettings();settings[key]=validColor(input.value,defaults[key]);settings.updatedAt=new Date().toISOString();apply();save("Farba dokumentov a tabuliek bola uložená.");setStatus("Farby sú uložené a použijú sa aj v nových exportoch.")}
 window.betpresDocumentTheme=theme;
 window.applyBetpresDocumentSettings=apply;
 apply();
 get("documentLetterheadFile")?.addEventListener("change",event=>void upload(event.target.files?.[0]));
 get("documentLetterheadReset")?.addEventListener("click",resetLetterhead);
 for(const [id,key] of [["documentAccentColor","accentColor"],["documentWorkAccentColor","workAccentColor"],["documentWorkerAccentColor","workerAccentColor"]])get(id)?.addEventListener("change",()=>changeColor(id,key));
})();
