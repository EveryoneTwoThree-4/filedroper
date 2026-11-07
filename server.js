const express = require("express");
const multer = require("multer");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "files.json");
const MAX_FILE_BYTES = Number(process.env.MAX_FILE_BYTES || 1024 * 1024 * 1024);
const TTL_MS = 24 * 60 * 60 * 1000;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]");

function readFiles() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { return []; }
}
function writeFiles(files) {
  const temp = DB_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(files, null, 2));
  fs.renameSync(temp, DB_FILE);
}
function makeCode(files) {
  let code;
  do { code = String(crypto.randomInt(0, 1000000)).padStart(6, "0"); }
  while (files.some(f => f.code === code));
  return code;
}
function cleanExpired() {
  const now = Date.now();
  const files = readFiles();
  const keep = [];
  for (const file of files) {
    if (file.expiresAt <= now) {
      try { fs.unlinkSync(path.join(UPLOAD_DIR, file.diskName)); } catch {}
    } else keep.push(file);
  }
  if (keep.length !== files.length) writeFiles(keep);
}
setInterval(cleanExpired, 10 * 60 * 1000).unref();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/", rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, _file, cb) => cb(null, crypto.randomUUID())
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: 1 }
});

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Выберите файл." });
  const files = readFiles();
  const now = Date.now();
  const record = {
    id: crypto.randomUUID(),
    code: makeCode(files),
    diskName: req.file.filename,
    originalName: path.basename(req.file.originalname).slice(0, 240) || "file",
    mimeType: req.file.mimetype || "application/octet-stream",
    size: req.file.size,
    createdAt: now,
    expiresAt: now + TTL_MS
  };
  files.push(record);
  writeFiles(files);
  res.status(201).json({
    code: record.code,
    name: record.originalName,
    size: record.size,
    expiresAt: record.expiresAt
  });
});

app.get("/api/files/:code", (req, res) => {
  const code = String(req.params.code || "");
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: "Код должен состоять из 6 цифр." });
  const file = readFiles().find(f => f.code === code && f.expiresAt > Date.now());
  if (!file) return res.status(404).json({ error: "Файл не найден. Возможно, срок хранения истёк." });
  res.json({ name: file.originalName, size: file.size, expiresAt: file.expiresAt });
});

app.get("/api/download/:code", (req, res) => {
  const code = String(req.params.code || "");
  const file = readFiles().find(f => f.code === code && f.expiresAt > Date.now());
  if (!file) return res.status(404).send("Файл не найден или срок хранения истёк.");
  const diskPath = path.join(UPLOAD_DIR, file.diskName);
  if (!fs.existsSync(diskPath)) return res.status(404).send("Файл больше недоступен.");
  res.download(diskPath, file.originalName);
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE"
      ? `Файл слишком большой. Максимум: ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} МБ.`
      : "Не удалось загрузить файл.";
    return res.status(400).json({ error: message });
  }
  console.error(err);
  res.status(500).json({ error: "Внутренняя ошибка сервера." });
});

app.listen(PORT, () => console.log(`File Transfer is running on port ${PORT}`));
