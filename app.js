(() => {
"use strict";
const API_URL="https://script.google.com/macros/s/AKfycbyZKLRB77GZ2S4qzbbhL-l0EL1vkqZNZuLxI19qan-2-Y0uy1hMOTiY-7Wcp9hguhm9fQ/exec";
const MAX=5*1024*1024, ALPHABET=/^[A-HJ-NP-Z2-9]{6}$/;
const $=id=>document.getElementById(id);
const fileInput=$("fileInput"),uploadButton=$("uploadButton"),error=$("errorMessage");
function err(s){error.textContent=s;error.classList.remove("hidden")}
function clearErr(){error.textContent="";error.classList.add("hidden")}
function size(n){return n<1024?n+" Б":n<1048576?(n/1024).toFixed(1)+" КБ":(n/1048576).toFixed(2)+" МБ"}
function tab(up){$("uploadTab").classList.toggle("active",up);$("downloadTab").classList.toggle("active",!up);$("uploadPane").classList.toggle("hidden",!up);$("downloadPane").classList.toggle("hidden",up);clearErr()}
$("uploadTab").onclick=()=>tab(true);$("downloadTab").onclick=()=>tab(false);
fileInput.onchange=()=>{clearErr();const f=fileInput.files[0];$("uploadResult").classList.add("hidden");$("filePicked").textContent=f?`${f.name} · ${size(f.size)}`:"";$("filePicked").classList.toggle("hidden",!f);uploadButton.disabled=!f||f.size>MAX;if(f&&f.size>MAX)err("Максимальный размер файла — 5 МБ.")};
$("dropzone").ondragover=e=>e.preventDefault();
$("dropzone").ondrop=e=>{e.preventDefault();if(e.dataTransfer.files.length){fileInput.files=e.dataTransfer.files;fileInput.dispatchEvent(new Event("change"))}};
$("uploadForm").onsubmit=async e=>{
e.preventDefault();clearErr();const file=fileInput.files[0];if(!file)return err("Сначала выбери файл.");if(file.size>MAX)return err("Максимальный размер — 5 МБ.");
uploadButton.disabled=true;$("progressWrap").classList.remove("hidden");$("progressLabel").textContent="Читаем файл…";$("progressPercent").textContent="10%";$("progressBar").style.width="10%";
let frame,form,timer;const nonce=(crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`);
try{
const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error("Не удалось прочитать файл."));r.readAsDataURL(file)});
const payload={name:file.name,mimeType:file.type||"application/octet-stream",size:file.size,data:String(dataUrl).split(",")[1],nonce};
const frameName="fd_"+Date.now();frame=document.createElement("iframe");frame.name=frameName;frame.hidden=true;document.body.append(frame);
form=document.createElement("form");form.method="POST";form.action=API_URL;form.target=frameName;form.hidden=true;
const input=document.createElement("input");input.type="hidden";input.name="payload";input.value=JSON.stringify(payload);form.append(input);document.body.append(form);
const finish=()=>{clearTimeout(timer);window.removeEventListener("message",onMessage);form.remove();frame.remove();$("progressWrap").classList.add("hidden");uploadButton.disabled=false};
function onMessage(ev){if(ev.source!==frame.contentWindow)return;const d=ev.data;if(!d||d.type!=="FILEDROP_RESULT"||d.nonce!==nonce)return;finish();if(!d.ok)return err(d.error||"Ошибка загрузки.");$("resultCode").textContent=d.code;$("uploadResult").classList.remove("hidden")}
window.addEventListener("message",onMessage);timer=setTimeout(()=>{finish();err("Сервер не ответил. Попробуй ещё раз.")},120000);
$("progressLabel").textContent="Отправляем файл…";$("progressPercent").textContent="30%";$("progressBar").style.width="30%";form.submit();
}catch(ex){if(form)form.remove();if(frame)frame.remove();$("progressWrap").classList.add("hidden");uploadButton.disabled=false;err(ex.message||"Ошибка загрузки.")}
};
$("copyCode").onclick=async()=>{try{await navigator.clipboard.writeText($("resultCode").textContent);$("copyCode").textContent="Скопировано!";setTimeout(()=>$("copyCode").textContent="Скопировать код",1500)}catch(e){err("Выдели код и скопируй вручную.")}};
$("sendAnother").onclick=()=>{$("uploadForm").reset();$("filePicked").classList.add("hidden");$("uploadResult").classList.add("hidden");uploadButton.disabled=true;clearErr()};
$("codeInput").oninput=e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g,"").slice(0,6);
$("downloadForm").onsubmit=e=>{
e.preventDefault();clearErr();$("downloadResult").classList.add("hidden");const code=$("codeInput").value.trim().toUpperCase();if(!ALPHABET.test(code))return err("Введи корректный шестисимвольный код.");
const cb="fdcb"+Date.now()+Math.floor(Math.random()*10000),script=document.createElement("script");let done=false;
const finish=()=>{if(done)return;done=true;clearTimeout(timer);delete window[cb];script.remove()};
window[cb]=data=>{finish();if(!data||!data.ok)return err(data?.error||"Файл не найден или срок хранения истёк.");$("downloadName").textContent=data.name;$("downloadSize").textContent=size(Number(data.size)||0);$("downloadLink").href=data.downloadUrl;$("downloadResult").classList.remove("hidden")};
script.onerror=()=>{finish();err("Ошибка соединения с сервером.")};const timer=setTimeout(()=>{finish();err("Сервер не ответил. Попробуй ещё раз.")},20000);
script.src=API_URL+"?code="+encodeURIComponent(code)+"&callback="+encodeURIComponent(cb)+"&t="+Date.now();document.body.append(script);
};
})();