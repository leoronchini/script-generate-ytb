import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { converterParaSRT } from "./srt/textToSrt.js";
import { cleanNarrative } from "./formatter/cleanNarrative.js";
import { cleanScript } from "./formatter/cleanNarrative.js";
import { config as configFile } from "../config.js";

/* =========================
   LOG
========================= */
function log(step, msg) {
  const time = new Date().toISOString();
  console.log(`[${time}] [${step}] ${msg}`);
}

function getArg(name, fallback = null) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function must(value, msg) {
  if (!value) {
    log("ERRO", msg);
    process.exit(1);
  }
  return value;
}




async function main() {
  log("INIT", "Iniciando geração de roteiro");

  const apiKey = process.env.GEMINI_API_KEY;
  must(apiKey, "GEMINI_API_KEY não definida no .env");

  // Lê configurações do arquivo config.js, mas permite sobrescrever por parâmetros
  const title = getArg("title") || configFile.title;
  const agentFile = getArg("agentFile") || configFile.agentFile || "agent.txt";
  const model = getArg("model") || configFile.model || "gemini-3-pro-preview";
  const okTurns = Number(getArg("okTurns") || configFile.okTurns || "3");

  must(title, 'Título não informado. Configure no config.js ou use --title "..."');

  log("CONFIG", `Modelo: ${model}`);
  log("CONFIG", `OK turns: ${okTurns}`);
  log("CONFIG", `Agent file: ${agentFile}`);

  const agentPrompt = fs.readFileSync(agentFile, "utf8");
  must(agentPrompt.trim(), "Prompt do agente está vazio");

  /* ===== PASTAS ===== */
  // Usa o path do config se informado, senão usa o diretório atual/script-bot
  const ROOT_DIR = configFile.outputPath 
    ? path.resolve(configFile.outputPath)
    : path.resolve(process.cwd(), "script-bot");
  fs.mkdirSync(ROOT_DIR, { recursive: true });
  log("CONFIG", `Output path: ${ROOT_DIR}`);

  const rawFolderName = title.slice(0, 20).trim() + "...";
  const safeFolderName = rawFolderName
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, " ")
    .trim();

  const jobDir = path.join(ROOT_DIR, safeFolderName);
  fs.mkdirSync(jobDir, { recursive: true });

  log("FS", `Pasta do job criada: ${jobDir}`);

  /* ===== AI ===== */
  log("AI", "Inicializando cliente Gemini");
  const ai = new GoogleGenAI({ apiKey });

  log("AI", "Criando sessão de chat (contexto único)");
  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction: agentPrompt,
      temperature: 0.8,
    },
  });

  const parts = [];

  /* ===== PRIMEIRA MENSAGEM ===== */
  log("CHAT", "Enviando título");
  const r1 = await chat.sendMessage({ message: title });

  const firstClean = cleanScript(r1.text ?? "");
  parts.push(firstClean);

  log("OUTPUT", `Parte 1 limpa (${firstClean.length} chars)`);

  /* ===== OK LOOPS ===== */
  for (let i = 0; i < okTurns; i++) {
    log("CHAT", `Enviando OK (${i + 1}/${okTurns})`);
    const r = await chat.sendMessage({ message: "OK" });

    const cleaned = cleanScript(r.text ?? "");
    parts.push(cleaned);

    log("OUTPUT", `Parte ${i + 2} limpa (${cleaned.length} chars)`);
  }

  /* ===== MERGE FINAL ===== */
  log("MERGE", "Unindo partes do roteiro");
  const fullScript = parts.join("\n\n").trim();

  log("MERGE", `Roteiro final com ${fullScript.length} caracteres`);

  /* ===== ARQUIVO FINAL ===== */
  const shortTitle = title.slice(0, 20).trim();

  const safeShortTitle = shortTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, " ")
    .trim();

  const finalFileName = `roteiro ${safeShortTitle}.txt`;
  const finalPath = path.join(jobDir, finalFileName);

  log("FORMAT", "Limpando metatexto e garantindo narrativa pura");

  const finalCleanScript = cleanNarrative(fullScript);

  fs.writeFileSync(finalPath, finalCleanScript, "utf8");
  log("WRITE", `Roteiro gerado com sucesso!`);

  /* ===== INFO ===== */
  log("INFO", "Gerando arquivo de informações do vídeo");
  const infoFileName = `info-${safeShortTitle}.txt`;
  const infoPath = path.join(jobDir, infoFileName);
  
  fs.writeFileSync(infoPath, title, "utf8");
  log("INFO", `Arquivo info gerado com sucesso!`);

  /* ===== SRT ===== */
  log("SRT", "Gerando arquivo SRT a partir do texto final");

  const srtContent = converterParaSRT(finalCleanScript);

  const srtFileName = finalFileName.replace(".txt", ".srt");
  const srtPath = path.join(jobDir, srtFileName);

  fs.writeFileSync(srtPath, srtContent, "utf8");

  log("SRT", `Arquivo SRT gerado com sucesso!`);
  log("DONE", "Processo concluído com sucesso");
  log("DONE", `Path dos arquivos salvos: ${jobDir}`);

}

main().catch((err) => {
  log("FATAL", err?.stack || err?.message || err);
  process.exit(1);
});
