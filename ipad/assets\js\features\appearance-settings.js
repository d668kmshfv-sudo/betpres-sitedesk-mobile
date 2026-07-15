// BETPRES SiteDesk – používateľské nastavenie vzhľadu
(function(){
 "use strict";
 var KEY="betpres-sitedesk-appearance-v1";
 var defaults={theme:"system",fontScale:"1",contrast:45,compact:false,transparentHeader:true};
 var settings=load();
 function load(){try{return Object.assign({},defaults,JSON.parse(localStorage.getItem(KEY)||"{}"))}catch(error){return Object.assign({},defaults)}}
 function save(){localStorage.setItem(KEY,JSON.stringify(settings));apply();showSaved()}
 function isDark(){return settings.theme==="dark"||(settings.theme==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches)}
 function apply(){
  var root=document.documentElement;
  root.dataset.sitedeskTheme=settings.theme||"system";
  root.style.setProperty("--sitedesk-font-scale",settings.fontScale||"1");
  root.classList.toggle("sitedesk-compact",Boolean(settings.compact));
  root.classList.toggle("sitedesk-high-contrast",Number(settings.contrast)>=68);
  root.classList.toggle("sitedesk-solid-header",!settings.transparentHeader);
  var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=isDark()?"#0c1724":"#0b2b4f";
  document.querySelectorAll("[data-desktop-theme]").forEach(function(button){button.classList.toggle("active",button.dataset.desktopTheme===settings.theme)});
  var font=document.getElementById("desktopFontScale"),contrast=document.getElementById("desktopContrast"),output=document.getElementById("desktopContrastValue"),compact=document.getElementById("desktopCompact"),transparent=document.getElementById("desktopTransparentHeader");
  if(font)font.value=settings.fontScale;if(contrast)contrast.value=String(settings.contrast);if(output)output.value=String(settings.contrast);if(compact)compact.checked=Boolean(settings.compact);if(transparent)transparent.checked=Boolean(settings.transparentHeader)
 }
 function showSaved(){var badge=document.getElementById("appearanceSaved");if(!badge)return;badge.textContent="Uložené";clearTimeout(showSaved.timer);showSaved.timer=setTimeout(function(){badge.textContent="Automaticky uložené"},1400)}
 function bind(){
  document.querySelectorAll("[data-desktop-theme]").forEach(function(button){button.onclick=function(){settings.theme=button.dataset.desktopTheme;save()}});
  var font=document.getElementById("desktopFontScale"),contrast=document.getElementById("desktopContrast"),compact=document.getElementById("desktopCompact"),transparent=document.getElementById("desktopTransparentHeader"),reset=document.getElementById("appearanceReset");
  if(font)font.onchange=function(){settings.fontScale=font.value;save()};
  if(contrast)contrast.oninput=function(){settings.contrast=Number(contrast.value);save()};
  if(compact)compact.onchange=function(){settings.compact=compact.checked;save()};
  if(transparent)transparent.onchange=function(){settings.transparentHeader=transparent.checked;save()};
  if(reset)reset.onclick=function(){settings=Object.assign({},defaults);save();if(typeof toast==="function")toast("BETPRES vzhľad bol obnovený.")};
  var media=window.matchMedia("(prefers-color-scheme: dark)");if(media.addEventListener)media.addEventListener("change",apply)
 }
 apply();
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){bind();apply()});else{bind();apply()}
})();
