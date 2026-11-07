const $ = (id) => document.getElementById(id);
const uploadTab = $("uploadTab"), downloadTab = $("downloadTab");
const uploadPane = $("uploadPane"), downloadPane = $("downloadPane");
const form = $("uploadForm"), fileInput = $("fileInput"), uploadButton = $("uploadButton");
const dropzone = $("dropzone"), errorBox = $("errorMessage");

function showError(message) { errorBox.textContent = message; errorBox.classList.remove("hidden"); }
function clearError() { errorBox.textContent = ""; errorBox.classList.add("hidden"); }
function switchTab(which) {
  const upload = which === "upload";
  uploadPane.classList.toggle("hidden", !upload);
  downloadPane.classList.toggle("hidden", upload);
  uploadTab.classList.toggle("active", upload);
  downloadTab.classList.toggle("active", !upload);
  clearError();
}
uploadTab.addEventListener("click", () => switchTab("upload"));
downloadTab.addEventListener("click", () => switchTab("download"));

function prettySize(bytes) {
  if (bytes < 1024) return `${bytes} Б`;
  const units = ["КБ", "МБ", "ГБ", "ТБ"];
  let value = bytes / 1024, i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value.toFixed(1)} ${units[i]}`;
}
function selectFile(file) {
  if (!file) return;
  fileInput.files = (() => {
    const dt = new DataTransfer(); dt.items.add(file); return dt.files;
  })();
  $("filePicked").textContent = `${file.name} · ${prettySize(file.size)}`;
  $("filePicked").classList.remove("hidden");
  uploadButton.disabled = false;
  $("uploadResult").classList.add("hidden");
  clearError();
}
fileInput.addEventListener("change", () => selectFile(fileInput.files[0]));
["dragenter", "dragover"].forEach(type => dropzone.addEventListener(type, e => {
  e.preventDefault(); dropzone.classList.add("drag");
}));
["dragleave", "drop"].forEach(type => dropzone.addEventListener(type, e => {
  e.preventDefault(); dropzone.classList.remove("drag");
}));
dropzone.addEventListener("drop", e => selectFile(e.dataTransfer.files[0]));

form.addEventListener("submit", e => {
  e.preventDefault(); clearError();
  const file = fileInput.files[0]; if (!file) return;
  const data = new FormData(); data.append("file", file);
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/upload");
  uploadButton.disabled = true;
  $("progressWrap").classList.remove("hidden");
  $("progressLabel").textContent = "Загрузка файла…";
  xhr.upload.onprogress = event => {
    if (event.lengthComputable) {
      const percent = Math.round(event.loaded / event.total * 100);
      $("progressBar").style.width = percent + "%";
      $("progressPercent").textContent = percent + "%";
    }
  };
  xhr.onload = () => {
    $("progressWrap").classList.add("hidden"); uploadButton.disabled = false;
    let result;
    try { result = JSON.parse(xhr.responseText); } catch { result = {}; }
    if (xhr.status < 200 || xhr.status >= 300) return showError(result.error || "Не удалось загрузить файл.");
    $("resultCode").textContent = result.code;
    $("expiryText").textContent = "Файл будет доступен 24 часа.";
    $("uploadResult").classList.remove("hidden");
    $("qrcode").innerHTML = "";
    if (window.QRCode) new QRCode($("qrcode"), { text: `${location.origin}/?code=${result.code}`, width: 112, height: 112 });
    $("uploadButton").classList.add("hidden");
  };
  xhr.onerror = () => { $("progressWrap").classList.add("hidden"); uploadButton.disabled = false; showError("Ошибка соединения. Попробуй ещё раз."); };
  xhr.send(data);
});

$("copyCode").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("resultCode").textContent);
    $("copyCode").textContent = "Скопировано ✓";
  } catch { showError("Не удалось скопировать код. Выдели его вручную."); }
});
$("sendAnother").addEventListener("click", () => {
  $("uploadResult").classList.add("hidden");
  $("uploadButton").classList.remove("hidden");
  $("filePicked").classList.add("hidden");
  fileInput.value = ""; uploadButton.disabled = true; $("copyCode").textContent = "Скопировать код";
});

$("codeInput").addEventListener("input", e => e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6));
$("downloadForm").addEventListener("submit", async e => {
  e.preventDefault(); clearError(); $("downloadResult").classList.add("hidden");
  const code = $("codeInput").value.trim();
  if (!/^\d{6}$/.test(code)) return showError("Введи 6 цифр.");
  try {
    const response = await fetch(`/api/files/${code}`);
    const data = await response.json();
    if (!response.ok) return showError(data.error || "Файл не найден.");
    $("downloadName").textContent = data.name;
    $("downloadSize").textContent = prettySize(data.size);
    $("downloadLink").href = `/api/download/${code}`;
    $("downloadResult").classList.remove("hidden");
  } catch { showError("Не удалось связаться с сервером."); }
});

// QR-код сразу открывает вкладку скачивания и подставляет код файла.
const sharedCode = new URLSearchParams(location.search).get("code");
if (sharedCode && /^\\d{6}$/.test(sharedCode)) {
  switchTab("download");
  $("codeInput").value = sharedCode;
  $("downloadForm").requestSubmit();
}
