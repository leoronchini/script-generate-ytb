import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { converterParaSRT } from "./srt/textToSrt.js";
import { cleanNarrative } from "./formatter/cleanNarrative.js";
import { cleanScript } from "./formatter/cleanNarrative.js";
import { retryWithBackoff } from "./utils/retry.js";
import { config as configFile, channels, selectedChannel } from "../config.js";

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

// Função que processa um único título
async function processTitle(title, config) {
  const {
    apiKey,
    summaryAgentFile,
    thumbnailAgentFile,
    agentFile,
    model,
    okTurns,
    language,
    outputPath,
    summaryAgentPrompt,
    thumbnailAgentPrompt,
    agentPrompt,
    ai,
    generateThumbnailPrompt,
    generateBlockImagePrompts,
  } = config;

  log("TITLE", `Processando título: "${title}"`);

  /* ===== PASTAS ===== */
  const ROOT_DIR = outputPath
    ? path.resolve(outputPath)
    : path.resolve(process.cwd(), "script-bot");
  fs.mkdirSync(ROOT_DIR, { recursive: true });

  const rawFolderName = title.slice(0, 20).trim() + "...";
  const safeFolderName = rawFolderName
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, " ")
    .trim();

  const jobDir = path.join(ROOT_DIR, safeFolderName);
  fs.mkdirSync(jobDir, { recursive: true });

  log("FS", `Pasta criada: ${jobDir}`);

  /* ===== ETAPA 1: GERAR DESCRIÇÃO/RESUMO ===== */
  log("SUMMARY", "Gerando descrição do roteiro...");
  
  let summaryChat;
  try {
    summaryChat = ai.chats.create({
      model,
      config: {
        systemInstruction: summaryAgentPrompt,
        temperature: 0.7,
      },
    });
  } catch (error) {
    log("ERRO", `Falha ao criar sessão de chat: ${error?.message || error}`);
    throw error;
  }
  
  let summaryResponse;
  try {
    summaryResponse = await retryWithBackoff(
      () => summaryChat.sendMessage({ message: title }),
      log,
      "Gerando descrição"
    );
  } catch (error) {
    log("ERRO", `Falha ao gerar descrição: ${error?.message || error}`);
    throw error;
  }
  
  // Extrai o texto da resposta
  let description = "";
  if (summaryResponse) {
    try {
      description = summaryResponse.text?.trim() || "";
    } catch (error) {
      // Silencioso - tenta outras formas
    }
    
    // Fallback: tenta acessar diretamente os parts
    if (!description && summaryResponse.candidates?.[0]?.content?.parts) {
      const parts = summaryResponse.candidates[0].content.parts;
      const textParts = parts
        .filter(part => part.text)
        .map(part => part.text)
        .join("");
      description = textParts.trim();
    }
    
    // Último fallback
    if (!description) {
      description = summaryResponse.response?.text?.trim() || 
                    summaryResponse.content?.trim() || 
                    (typeof summaryResponse === 'string' ? summaryResponse.trim() : "") || 
                    "";
    }
  }
  
  if (!description) {
    const errorDetails = [];
    if (summaryResponse?.candidates?.[0]?.finishReason) {
      errorDetails.push(`finishReason: ${summaryResponse.candidates[0].finishReason}`);
    }
    if (summaryResponse?.usageMetadata?.thoughtsTokenCount > 0) {
      errorDetails.push(`${summaryResponse.usageMetadata.thoughtsTokenCount} tokens de "thoughts" sem texto visível`);
    }
    
    const errorMsg = "A API retornou uma resposta vazia. " +
      (errorDetails.length > 0 ? `Detalhes: ${errorDetails.join(", ")}. ` : "") +
      "Isso pode ser um problema com o modelo. Tente usar outro modelo ou verifique a API.";
    log("ERRO", errorMsg);
    throw new Error(errorMsg);
  }
  
  must(description, "Descrição do roteiro não foi gerada");
  log("SUMMARY", `Descrição gerada (${description.length} caracteres)`);

  /* ===== ETAPA 2: GERAR PROMPT PARA THUMBNAIL ===== */
  let thumbnailPrompt = "";
  let thumbnailChat = null;
  
  if (generateThumbnailPrompt) {
    log("THUMBNAIL", "Gerando prompt da thumbnail...");
    
    try {
      thumbnailChat = ai.chats.create({
        model,
        config: {
          systemInstruction: thumbnailAgentPrompt,
          temperature: 0.8,
        },
      });
    } catch (error) {
      log("ERRO", `Falha ao criar sessão de chat: ${error?.message || error}`);
      throw error;
    }

    // Delay para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 3000));

    const thumbnailMessage = `Título: ${title}\n\nDescrição do roteiro:\n${description}`;
    
    let thumbnailResponse;
    try {
      thumbnailResponse = await retryWithBackoff(
        () => thumbnailChat.sendMessage({ message: thumbnailMessage }),
        log,
        "Gerando prompt da thumbnail"
      );
    } catch (error) {
      log("ERRO", `Falha ao gerar prompt da thumbnail: ${error?.message || error}`);
      throw error;
    }

    thumbnailPrompt = thumbnailResponse.text?.trim() || "";
    must(thumbnailPrompt, "Prompt da thumbnail não foi gerado");
    log("THUMBNAIL", `Prompt gerado (${thumbnailPrompt.length} caracteres)`);
  } else {
    log("THUMBNAIL", "Geração de prompt da thumbnail desabilitada");
  }

  /* ===== ETAPA 3: GERAR ROTEIRO BASEADO NA DESCRIÇÃO ===== */
  log("ROTEIRO", "Gerando roteiro...");
  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction: agentPrompt,
      temperature: 0.8,
    },
  });

  const parts = [];
  const blockImagePrompts = [];

  /* ===== PRIMEIRA MENSAGEM ===== */
  const firstMessage = `Título: ${title}\n\nDescrição do roteiro:\n${description}`;
  const r1 = await retryWithBackoff(
    () => chat.sendMessage({ message: firstMessage }),
    log,
    "Gerando roteiro"
  );

  const firstClean = cleanScript(r1.text ?? "");
  parts.push(firstClean);
  log("ROTEIRO", `Parte 1 gerada (${firstClean.length} caracteres)`);

  // Gerar prompt de imagem para o bloco 1 (se habilitado)
  if (generateBlockImagePrompts && thumbnailChat) {
    log("IMAGEM", "Gerando prompt de imagem do bloco 1...");
    await new Promise(resolve => setTimeout(resolve, 3000)); // Delay para evitar rate limiting
    
    const block1Message = `Título: ${title}\n\nDescrição do roteiro:\n${description}\n\nTexto do bloco:\n${firstClean}`;
    let block1Response;
    try {
      block1Response = await retryWithBackoff(
        () => thumbnailChat.sendMessage({ message: block1Message }),
        log,
        "Gerando imagem do bloco 1"
      );
    } catch (error) {
      log("ERRO", `Falha ao gerar prompt de imagem do bloco 1: ${error?.message || error}`);
      throw error;
    }
    
    const block1Prompt = block1Response.text?.trim() || "";
    must(block1Prompt, "Prompt de imagem do bloco 1 não foi gerado");
    blockImagePrompts.push(block1Prompt);
    log("IMAGEM", `Prompt do bloco 1 gerado com sucesso (${block1Prompt.length} caracteres)`);
  } else if (!generateBlockImagePrompts) {
    log("IMAGEM", "Geração de prompts de imagem por bloco desabilitada");
  }

  /* ===== OK LOOPS ===== */
  for (let i = 0; i < okTurns; i++) {
    const r = await retryWithBackoff(
      () => chat.sendMessage({ message: "OK" }),
      log,
      `Continuando roteiro (${i + 1}/${okTurns})`
    );

    const cleaned = cleanScript(r.text ?? "");
    parts.push(cleaned);
    log("SCRIPT", `Parte ${i + 2} gerada (${cleaned.length} caracteres)`);

    // Gerar prompt de imagem para este bloco (se habilitado)
    if (generateBlockImagePrompts && thumbnailChat) {
      const blockNumber = i + 2;
      log("IMAGE", `Gerando prompt de imagem do bloco ${blockNumber}...`);
      await new Promise(resolve => setTimeout(resolve, 3000)); // Delay para evitar rate limiting
      
      const blockMessage = `Título: ${title}\n\nDescrição do roteiro:\n${description}\n\nTexto do bloco:\n${cleaned}`;
      let blockResponse;
      try {
        blockResponse = await retryWithBackoff(
          () => thumbnailChat.sendMessage({ message: blockMessage }),
          log,
          `Gerando imagem do bloco ${blockNumber}`
        );
      } catch (error) {
        log("ERROR", `Falha ao gerar prompt de imagem do bloco ${blockNumber}: ${error?.message || error}`);
        throw error;
      }
      
      const blockPrompt = blockResponse.text?.trim() || "";
      must(blockPrompt, `Prompt de imagem do bloco ${blockNumber} não foi gerado`);
      blockImagePrompts.push(blockPrompt);
      log("IMAGE", `Prompt do bloco ${blockNumber} gerado com sucesso (${blockPrompt.length} caracteres)`);
    }
  }

  /* ===== MERGE FINAL ===== */
  const fullScript = parts.join("\n\n").trim();
  log("SCRIPT", `Roteiro completo gerado com sucesso (${fullScript.length} caracteres)`);

  /* ===== FORMATAÇÃO FINAL ===== */
  log("FORMAT", "Limpando metatexto e garantindo narrativa pura...");

  const finalCleanScript = cleanNarrative(fullScript);

  /* ===== ARQUIVO INFO (TUDO EM UM) ===== */
  const shortTitle = title.slice(0, 20).trim();

  const safeShortTitle = shortTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, " ")
    .trim();

  log("INFO", "Gerando arquivo INFO com todas as informações...");
  const infoFileName = `info-${safeShortTitle}.txt`;
  const infoPath = path.join(jobDir, infoFileName);
  
  // Monta a seção de prompts (thumbnail + blocos, se gerados)
  let promptsSection = "";
  
  if (generateThumbnailPrompt && thumbnailPrompt) {
    promptsSection = `PROMPT THUMBNAIL:\n${thumbnailPrompt}\n`;
  }
  
  if (generateBlockImagePrompts && blockImagePrompts.length > 0) {
    for (let i = 0; i < blockImagePrompts.length; i++) {
      promptsSection += `${promptsSection ? '\n' : ''}-------------\nPROMPT BLOCO ${i + 1}:\n${blockImagePrompts[i]}\n`;
    }
  }
  
  // Monta o conteúdo do arquivo INFO
  let infoContent = `TITULO: 
${title}
`;
  
  if (promptsSection) {
    infoContent += `-------------
${promptsSection}`;
  }
  
  infoContent += `--------------
DESCRIÇÃO
${description}
--------------
ROTEIRO 
${finalCleanScript}
`;
  
  fs.writeFileSync(infoPath, infoContent, "utf8");
  
  const promptsCount = (generateThumbnailPrompt ? 1 : 0) + (generateBlockImagePrompts ? blockImagePrompts.length : 0);
  if (promptsCount > 0) {
    log("INFO", `Arquivo INFO gerado com sucesso! (${promptsCount} prompts de imagem)`);
  } else {
    log("INFO", `Arquivo INFO gerado com sucesso! (sem prompts de imagem)`);
  }

  /* ===== SRT ===== */
  log("SRT", "Gerando arquivo SRT a partir do texto final...");

  const srtContent = converterParaSRT(finalCleanScript);
  const srtFileName = `roteiro ${safeShortTitle}.srt`;
  const srtPath = path.join(jobDir, srtFileName);
  fs.writeFileSync(srtPath, srtContent, "utf8");

  log("SRT", `Arquivo SRT gerado com sucesso!`);
  log("DONE", `Processo concluído com sucesso para o título: "${title.slice(0, 50)}${title.length > 50 ? '...' : ''}"`);
  log("DONE", `Path dos arquivos salvos: ${jobDir}`);
  
  return jobDir;
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

  // Busca o canal selecionado (permite sobrescrever por parâmetro --channel)
  const channelName = getArg("channel") || selectedChannel;
  const channel = channels.find((c) => c.name === channelName);
  
  if (!channel) {
    log("ERRO", `Canal "${channelName}" não encontrado. Canais disponíveis: ${channels.map(c => c.name).join(", ")}`);
    process.exit(1);
  }

  log("CHANNEL", `Canal selecionado: ${channel.displayName} (${channel.name})`);

  // Lê configurações do arquivo config.js, mas permite sobrescrever por parâmetros
  // As configurações do canal têm prioridade, mas podem ser sobrescritas por parâmetros
  const titleInput = getArg("title") || configFile.title;
  const summaryAgentFile =
    getArg("summaryAgentFile") ||
    configFile.summaryAgentFile ||
    "agent-summary.txt";
  const thumbnailAgentFile =
    getArg("thumbnailAgentFile") ||
    configFile.thumbnailAgentFile ||
    "agent-thumbnail.txt";
  const agentFile = getArg("agentFile") || channel.agentFile || "agent.txt";
  const model = getArg("model") || configFile.model || "gemini-3-pro-preview";
  const okTurns = Number(getArg("okTurns") || configFile.okTurns || "3");
  const language = getArg("language") || channel.language || "romeno";
  
  // Configurações de geração de imagem do canal
  const generateThumbnailPrompt = channel.generateThumbnailPrompt ?? true;
  const generateBlockImagePrompts = channel.generateBlockImagePrompts ?? false;
  
  // Output path do canal (pode ser sobrescrito por parâmetro --outputPath)
  const outputPath = getArg("outputPath") || channel.outputPath;

  // Normaliza title para sempre ser um array
  const titles = Array.isArray(titleInput) ? titleInput : [titleInput];
  
  must(
    titles.length > 0 && titles.every(t => t && t.trim()),
    'Título não informado. Configure no config.js ou use --title "..."'
  );

  log("CONFIG", `Modelo: ${model} | Idioma: ${language} | OK turns: ${okTurns}`);
  log("CONFIG", `Thumbnail: ${generateThumbnailPrompt ? 'SIM' : 'NÃO'} | Blocos: ${generateBlockImagePrompts ? 'SIM' : 'NÃO'}`);
  log("CONFIG", `Total de títulos para processar: ${titles.length}`);

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

  /* ===== AI ===== */
  const ai = new GoogleGenAI({ apiKey });

  // Configuração compartilhada para processar cada título
  const processConfig = {
    apiKey,
    summaryAgentFile,
    thumbnailAgentFile,
    agentFile,
    model,
    okTurns,
    language,
    outputPath,
    summaryAgentPrompt,
    thumbnailAgentPrompt,
    agentPrompt,
    ai,
    generateThumbnailPrompt,
    generateBlockImagePrompts,
  };

  // Processa cada título
  const processedDirs = [];
  for (let i = 0; i < titles.length; i++) {
    const title = titles[i].trim();
    log("BATCH", `Processando título ${i + 1}/${titles.length}`);
    
    try {
      const jobDir = await processTitle(title, processConfig);
      processedDirs.push(jobDir);
    } catch (error) {
      log("ERRO", `Falha ao processar título ${i + 1}: ${error?.message || error}`);
      throw error;
    }
  }

  log("BATCH", `Todos os ${titles.length} títulos foram processados com sucesso!`);
  log("BATCH", `Diretórios criados: ${processedDirs.join(", ")}`);
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
