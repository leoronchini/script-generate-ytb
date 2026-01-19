import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { converterParaSRT } from "./srt/textToSrt.js";
import { cleanNarrative } from "./formatter/cleanNarrative.js";
import { cleanScript } from "./formatter/cleanNarrative.js";
import { retryWithBackoff } from "./utils/retry.js";
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

  // Lê a chave do config.js ou do .env (para compatibilidade)
  const apiKey =
    getArg("geminiKey") || configFile.geminiKey || process.env.GEMINI_API_KEY;
  must(
    apiKey,
    "GEMINI_API_KEY não definida. Configure no config.js ou use --geminiKey"
  );

  // Lê configurações do arquivo config.js, mas permite sobrescrever por parâmetros
  const title = getArg("title") || configFile.title;
  const summaryAgentFile =
    getArg("summaryAgentFile") ||
    configFile.summaryAgentFile ||
    "agent-summary.txt";
  const thumbnailAgentFile =
    getArg("thumbnailAgentFile") ||
    configFile.thumbnailAgentFile ||
    "agent-thumbnail.txt";
  const agentFile = getArg("agentFile") || configFile.agentFile || "agent.txt";
  const model = getArg("model") || configFile.model || "gemini-3-pro-preview";
  const okTurns = Number(getArg("okTurns") || configFile.okTurns || "3");
  const language = getArg("language") || configFile.language || "romeno";

  must(
    title,
    'Título não informado. Configure no config.js ou use --title "..."'
  );

  log("CONFIG", `Modelo: ${model}`);
  log("CONFIG", `OK turns: ${okTurns}`);
  log("CONFIG", `Idioma: ${language}`);
  log("CONFIG", `Summary agent file: ${summaryAgentFile}`);
  log("CONFIG", `Thumbnail agent file: ${thumbnailAgentFile}`);
  log("CONFIG", `Agent file: ${agentFile}`);

  // Lê o agente de resumo
  let summaryAgentPrompt = fs.readFileSync(summaryAgentFile, "utf8");
  must(summaryAgentPrompt.trim(), "Prompt do agente de resumo está vazio");

  // Lê o agente de thumbnail
  let thumbnailAgentPrompt = fs.readFileSync(thumbnailAgentFile, "utf8");
  must(thumbnailAgentPrompt.trim(), "Prompt do agente de thumbnail está vazio");

  // Lê o agente principal
  let agentPrompt = fs.readFileSync(agentFile, "utf8");
  must(agentPrompt.trim(), "Prompt do agente está vazio");

  // Substitui o placeholder de idioma no prompt principal
  agentPrompt = agentPrompt.replace(/\{LANGUAGE\}/g, language);

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

  /* ===== ETAPA 1: GERAR DESCRIÇÃO/RESUMO ===== */
  log("SUMMARY", "Criando sessão de chat para gerar descrição do roteiro");
  const summaryChat = ai.chats.create({
    model,
    config: {
      systemInstruction: summaryAgentPrompt,
      temperature: 0.7,
    },
  });

  log("SUMMARY", "Enviando título para gerar descrição");
  const summaryResponse = await retryWithBackoff(
    () => summaryChat.sendMessage({ message: title }),
    log,
    "Gerando descrição do roteiro"
  );

  const description = summaryResponse.text?.trim() || "";
  must(description, "Descrição do roteiro não foi gerada");

  log("SUMMARY", `Descrição gerada (${description.length} caracteres)`);

  /* ===== ETAPA 2: GERAR PROMPT PARA THUMBNAIL ===== */
  log("THUMBNAIL", "Criando sessão de chat para gerar prompt da thumbnail");
  const thumbnailChat = ai.chats.create({
    model,
    config: {
      systemInstruction: thumbnailAgentPrompt,
      temperature: 0.8,
    },
  });

  log(
    "THUMBNAIL",
    "Enviando título e descrição para gerar prompt da thumbnail"
  );
  const thumbnailMessage = `Título: ${title}\n\nDescrição do roteiro:\n${description}`;
  const thumbnailResponse = await retryWithBackoff(
    () => thumbnailChat.sendMessage({ message: thumbnailMessage }),
    log,
    "Gerando prompt da thumbnail"
  );

  const thumbnailPrompt = thumbnailResponse.text?.trim() || "";
  must(thumbnailPrompt, "Prompt da thumbnail não foi gerado");

  log(
    "THUMBNAIL",
    `Prompt da thumbnail gerado (${thumbnailPrompt.length} caracteres)`
  );

  /* ===== ETAPA 3: GERAR ROTEIRO BASEADO NA DESCRIÇÃO ===== */
  log("AI", "Criando sessão de chat para gerar roteiro final");
  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction: agentPrompt,
      temperature: 0.8,
    },
  });

  const parts = [];

  /* ===== PRIMEIRA MENSAGEM ===== */
  // Envia título + descrição para o agente principal
  const firstMessage = `Título: ${title}\n\nDescrição do roteiro:\n${description}`;
  log("CHAT", "Enviando título e descrição para gerar roteiro");
  const r1 = await retryWithBackoff(
    () => chat.sendMessage({ message: firstMessage }),
    log,
    "Enviando título e descrição"
  );

  const firstClean = cleanScript(r1.text ?? "");
  parts.push(firstClean);

  log("OUTPUT", `Parte 1 limpa (${firstClean.length} chars)`);

  /* ===== OK LOOPS ===== */
  for (let i = 0; i < okTurns; i++) {
    log("CHAT", `Enviando OK (${i + 1}/${okTurns})`);
    const r = await retryWithBackoff(
      () => chat.sendMessage({ message: "OK" }),
      log,
      `Enviando OK (${i + 1}/${okTurns})`
    );

    const cleaned = cleanScript(r.text ?? "");
    parts.push(cleaned);

    log("OUTPUT", `Parte ${i + 2} limpa (${cleaned.length} chars)`);
  }

  /* ===== MERGE FINAL ===== */
  log("MERGE", "Unindo partes do roteiro");
  const fullScript = parts.join("\n\n").trim();

  log("MERGE", `Roteiro final com ${fullScript.length} caracteres`);

  /* ===== FORMATAÇÃO FINAL ===== */
  log("FORMAT", "Limpando metatexto e garantindo narrativa pura");

  const finalCleanScript = cleanNarrative(fullScript);

  /* ===== ARQUIVO INFO (TUDO EM UM) ===== */
  const shortTitle = title.slice(0, 20).trim();

  const safeShortTitle = shortTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, " ")
    .trim();

  log("INFO", "Gerando arquivo INFO com todas as informações");
  const infoFileName = `info-${safeShortTitle}.txt`;
  const infoPath = path.join(jobDir, infoFileName);

  // Formata o conteúdo do arquivo INFO conforme especificado
  const infoContent = `TITULO: 
${title}
-------------
PROMPT:
${thumbnailPrompt}
--------------
DESCRIÇÃO
${description}
--------------
ROTEIRO 
${finalCleanScript}
`;

  fs.writeFileSync(infoPath, infoContent, "utf8");
  log("INFO", `Arquivo INFO gerado com sucesso!`);

  /* ===== SRT ===== */
  log("SRT", "Gerando arquivo SRT a partir do texto final");

  const srtContent = converterParaSRT(finalCleanScript);

  const srtFileName = `roteiro ${safeShortTitle}.srt`;
  const srtPath = path.join(jobDir, srtFileName);

  fs.writeFileSync(srtPath, srtContent, "utf8");

  log("SRT", `Arquivo SRT gerado com sucesso!`);
  log("DONE", "Processo concluído com sucesso");
  log("DONE", `Path dos arquivos salvos: ${jobDir}`);
}

main().catch((err) => {
  // Tratamento melhorado de erros
  if (err?.error) {
    const errorCode = err.error.code;
    const errorMessage = err.error.message || "Erro desconhecido";

    if (errorCode === 503) {
      log(
        "FATAL",
        `Serviço sobrecarregado (503). O modelo Gemini está temporariamente indisponível.`
      );
      log("FATAL", `Tente novamente em alguns minutos.`);
    } else if (errorCode === 429) {
      log(
        "FATAL",
        `Limite de taxa excedido (429). Muitas requisições em pouco tempo.`
      );
      log("FATAL", `Aguarde alguns minutos antes de tentar novamente.`);
    } else if (errorCode === 401 || errorCode === 403) {
      log(
        "FATAL",
        `Erro de autenticação (${errorCode}). Verifique sua chave API no config.js`
      );
    } else {
      log("FATAL", `Erro da API (${errorCode}): ${errorMessage}`);
    }
  } else {
    log("FATAL", err?.stack || err?.message || err);
  }
  process.exit(1);
});
