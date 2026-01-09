/* ================================
   CLEAN NARRATIVE FORMATTER
   Remove qualquer meta-resposta da IA
================================ */

// Padrões de frases completas da IA (removem até encontrar quebra de parágrafo)
const FORBIDDEN_BLOCK_PATTERNS = [
  /^entendido[\s\S]*?\n\n/gi,
  /^confirmo[\s\S]*?\n\n/gi,
  /^an[aá]lise[\s\S]*?\n\n/gi,
  /^palavras[-\s]?chave[\s\S]*?\n\n/gi,
  /^estrutura[\s\S]*?\n\n/gi,
  /^planejamento[\s\S]*?\n\n/gi,
  /^resumo[\s\S]*?\n\n/gi,
  /^observa[cç][aã]o[\s\S]*?\n\n/gi,
  /^segue\s+(o\s+)?(seu\s+)?roteiro[\s\S]*?\n\n/gi,
  /^aqui\s+est[aá]\s+(o\s+)?(seu\s+)?roteiro[\s\S]*?\n\n/gi,
  /^segue\s+abaixo[\s\S]*?\n\n/gi,
  /^aqui\s+est[aá][\s\S]*?\n\n/gi,
  /^pronto[\s\S]*?\n\n/gi,
  /^ok[\s\S]*?\n\n/gi,
  /^vou\s+come[cç]ar[\s\S]*?\n\n/gi,
  /^come[cç]ando[\s\S]*?\n\n/gi,
  /^iniciando[\s\S]*?\n\n/gi,
  /^baseado\s+no\s+t[ií]tulo[\s\S]*?\n\n/gi,
  /^com\s+base\s+no[\s\S]*?\n\n/gi,
  /^a\s+partir\s+do\s+t[ií]tulo[\s\S]*?\n\n/gi,
];

// Padrões de linhas individuais que devem ser removidas
const FORBIDDEN_LINE_PATTERNS = [
  /^segue\s+(o\s+)?(seu\s+)?roteiro.*$/gim,
  /^aqui\s+est[aá]\s+(o\s+)?(seu\s+)?roteiro.*$/gim,
  /^segue\s+abaixo.*$/gim,
  /^aqui\s+est[aá].*$/gim,
  /^pronto.*$/gim,
  /^estou\s+pronto.*$/gim,
  /^entendido.*$/gim,
  /^confirmo.*$/gim,
  /^an[aá]lise.*$/gim,
  /^palavras[-\s]?chave.*$/gim,
  /^estrutura.*$/gim,
  /^planejamento.*$/gim,
  /^resumo.*$/gim,
  /^observa[cç][aã]o.*$/gim,
  /^vou\s+come[cç]ar.*$/gim,
  /^come[cç]ando.*$/gim,
  /^iniciando.*$/gim,
  /^baseado\s+no\s+t[ií]tulo.*$/gim,
  /^com\s+base\s+no.*$/gim,
  /^a\s+partir\s+do\s+t[ií]tulo.*$/gim,
  /^este\s+roteiro.*$/gim,
  /^o\s+roteiro.*$/gim,
  /^a\s+introdu[cç][aã]o.*$/gim,
  /^introdu[cç][aã]o:.*$/gim,
  /^final:.*$/gim,
  /^ato\s+\d+.*$/gim,
  /^parte\s+\d+.*$/gim,
  /^cap[ií]tulo\s+\d+.*$/gim,
  /^perfeito.*$/gim,
  /^pode\s+mandar.*$/gim,
  /^por\s+favor.*envie.*t[ií]tulo.*$/gim,
  /^por\s+favor.*envie.*roteiro.*$/gim,
  /^envie\s+o\s+t[ií]tulo.*$/gim,
  /^envie\s+o\s+roteiro.*$/gim,
  /.*\d+\s+palavras.*$/gim, // Remove linhas que mencionam contagem de palavras
  /.*ato\s+\d+.*palavras.*$/gim,
];

// Padrões de conteúdo que indicam que é uma frase da IA (não apenas início de linha)
const FORBIDDEN_CONTENT_PATTERNS = [
  /perfeito.*estou\s+pronto.*por\s+favor.*envie.*t[ií]tulo/gi,
  /perfeito.*pronto.*por\s+favor.*envie/gi,
  /pode\s+mandar.*t[ií]tulo/gi,
  /pode\s+mandar\s+o\s+t[ií]tulo/gi,
  /por\s+favor.*envie.*t[ií]tulo.*para.*come[cç]ar/gi,
  /por\s+favor.*envie.*t[ií]tulo.*escrever.*roteiro/gi,
  /por\s+favor.*envie.*t[ií]tulo.*come[cç]ar.*escrever/gi,
  /envie.*t[ií]tulo.*ato\s+\d+/gi,
  /envie.*t[ií]tulo.*\d+\s+palavras/gi,
  /envie\s+o\s+t[ií]tulo.*para.*come[cç]ar/gi,
  /envie\s+o\s+t[ií]tulo.*escrever/gi,
  /.*\d+\s+palavras.*em\s+romeno/gi,
  /.*ato\s+\d+.*\d+\s+palavras/gi,
];

export function cleanNarrative(text) {
  if (!text) return "";

  let output = text.trim();

  // Remove blocos completos de texto da IA
  for (const pattern of FORBIDDEN_BLOCK_PATTERNS) {
    output = output.replace(pattern, "");
  }

  // Remove linhas individuais que são frases da IA
  output = output
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line; // Mantém linhas vazias
      
      // Verifica se a linha inteira é uma frase proibida
      const isForbidden = FORBIDDEN_LINE_PATTERNS.some((pattern) => {
        const match = trimmed.match(pattern);
        return match && match[0].trim() === trimmed;
      });
      
      return isForbidden ? "" : line;
    })
    .filter((line, index, array) => {
      // Remove linhas vazias duplicadas, mas mantém parágrafos
      if (!line.trim()) {
        // Se a linha anterior também está vazia, remove esta
        return index === 0 || array[index - 1].trim() !== "";
      }
      return true;
    })
    .join("\n");

  // Remove headings e formatação markdown
  output = output.replace(/^\*\*.*?\*\*\s*/gm, "");
  output = output.replace(/^#+\s.*$/gm, "");
  output = output.replace(/\*\*+/g, ""); // Remove negrito restante

  // Remove frases típicas de IA no início (mais agressivo)
  output = output.replace(
    /^(analis|basead|o\s+t[ií]tulo|este\s+roteiro|a\s+introdu[cç][aã]o|segue|aqui\s+est[aá]|pronto|entendido|confirmo).*\n+/gim,
    ""
  );

  // Remove parágrafos que começam com frases da IA
  const paragraphs = output.split("\n\n").map((p) => p.trim()).filter(Boolean);
  
  const cleanParagraphs = paragraphs.filter((p) => {
    const firstLine = p.split("\n")[0].trim().toLowerCase();
    const fullText = p.toLowerCase();
    
    // Verifica se começa com frase proibida
    const startsWithForbidden = FORBIDDEN_LINE_PATTERNS.some((pattern) => {
      const match = firstLine.match(pattern);
      return match && match[0].trim() === firstLine;
    });
    
    // Verifica se contém conteúdo proibido
    const containsForbidden = FORBIDDEN_CONTENT_PATTERNS.some((pattern) => {
      return pattern.test(fullText);
    });
    
    return !startsWithForbidden && !containsForbidden;
  });

  // Remove parágrafos no final que são claramente da IA
  // Verifica os últimos parágrafos e remove se forem frases da IA
  while (cleanParagraphs.length > 0) {
    const lastPara = cleanParagraphs[cleanParagraphs.length - 1].toLowerCase();
    const firstLine = lastPara.split("\n")[0].trim();
    
    const isAIParagraph = 
      // Verifica padrões de conteúdo proibido
      FORBIDDEN_CONTENT_PATTERNS.some(p => p.test(lastPara)) ||
      // Verifica se começa com frase proibida
      FORBIDDEN_LINE_PATTERNS.some(p => {
        const match = firstLine.match(p);
        return match && match[0].trim() === firstLine;
      }) ||
      // Verifica padrões específicos no início
      /^(perfeito|pronto|estou\s+pronto|pode\s+mandar|por\s+favor.*envie|envie.*t[ií]tulo)/i.test(firstLine) ||
      // Verifica se contém referências a palavras/ato (indicam instruções da IA)
      (/\d+\s+palavras/i.test(lastPara) && /(ato|roteiro|escrever|come[cç]ar)/i.test(lastPara)) ||
      // Verifica se é uma solicitação de título
      (/envie.*t[ií]tulo/i.test(lastPara) && /(para|come[cç]ar|escrever)/i.test(lastPara)) ||
      // Verifica se menciona "pode mandar" ou "por favor envie"
      /(pode\s+mandar|por\s+favor.*envie).*t[ií]tulo/i.test(lastPara);
    
    if (isAIParagraph) {
      cleanParagraphs.pop();
    } else {
      break;
    }
  }

  output = cleanParagraphs.join("\n\n");

  // Remove também linhas soltas no final que são da IA
  const lines = output.split("\n");
  while (lines.length > 0) {
    const lastLine = lines[lines.length - 1].trim().toLowerCase();
    if (!lastLine) {
      lines.pop();
      continue;
    }
    
    const isAILine = 
      // Verifica padrões de linha proibida
      FORBIDDEN_LINE_PATTERNS.some((pattern) => {
        const match = lastLine.match(pattern);
        return match && match[0].trim() === lastLine;
      }) || 
      // Verifica padrões de conteúdo proibido
      FORBIDDEN_CONTENT_PATTERNS.some(p => p.test(lastLine)) ||
      // Verifica padrões específicos
      /^(perfeito|pronto|estou\s+pronto|pode\s+mandar|por\s+favor.*envie|envie.*t[ií]tulo)/i.test(lastLine) ||
      // Verifica se contém referências a palavras/ato
      (/\d+\s+palavras/i.test(lastLine) && /(ato|roteiro|escrever|come[cç]ar)/i.test(lastLine)) ||
      // Verifica se é uma solicitação de título
      (/envie.*t[ií]tulo/i.test(lastLine) && /(para|come[cç]ar|escrever)/i.test(lastLine)) ||
      // Verifica "pode mandar" ou "por favor envie"
      /(pode\s+mandar|por\s+favor.*envie).*t[ií]tulo/i.test(lastLine);
    
    if (isAILine) {
      lines.pop();
    } else {
      break;
    }
  }
  
  output = lines.join("\n");

  // Normaliza espaçamento (máximo 2 quebras de linha)
  output = output.replace(/\n{3,}/g, "\n\n");

  // Remove espaços em branco no início e fim
  output = output.trim();

  return output;
}

export function cleanScript(text) {
  if (!text) return "";

  let cleaned = text;

  cleaned = cleaned.replace(/\*\*+/g, "");
  cleaned = cleaned.replace(/#+\s?.*/g, "");

  const forbiddenPatterns = [
    /^analisei/i,
    /^o tom da narrativa/i,
    /^a estrutura narrativa/i,
    /^a introdu[cç][aã]o ser[aá]/i,
    /^os ganchos de reten[cç][aã]o/i,
    /^as palavras[-\s]?chave/i,
    /^tudo est[aá] planejado/i,
    /^aguardo sua confirma[cç][aã]o/i,
    /^confirmo/i,
    /^estou pronto/i,
    /^aqui est[aá]/i,
    /^resumo das regras/i,
    /^planejamento/i,
    /^ato\s+\d+/i,
    /^parte\s+\d+/i,
    /^cap[ií]tulo/i,
    /^final:/i,
    /^introdu[cç][aã]o:/i,
  ];

  cleaned = cleaned
    .split("\n")
    .filter((line) => {
      const l = line.trim();
      if (!l) return true;
      return !forbiddenPatterns.some((rx) => rx.test(l));
    })
    .join("\n");


  const paragraphs = cleaned
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean);

  const narrativeStartIndex = paragraphs.findIndex((p) => {
    const isMetaText = /narrativa|estrutura|tom|planejado|palavras[-\s]?chave|seguirá|será|modelo|introdução|roteiro|segue|aqui\s+est[aá]|pronto|entendido|confirmo|baseado|come[cç]ando|iniciando/i.test(p);
    
    const hasNarrativeContent = /[a-záàâãéèêíïóôõöúç]/i.test(p) && p.length > 60;
    
    const firstWords = p.split(/\s+/).slice(0, 3).join(" ").toLowerCase();
    const startsWithAI = /^(segue|aqui\s+est[aá]|pronto|entendido|confirmo|baseado|come[cç]ando|iniciando|este\s+roteiro|o\s+roteiro)/i.test(firstWords);
    
    return !isMetaText && !startsWithAI && hasNarrativeContent;
  });

  if (narrativeStartIndex > 0) {
    paragraphs.splice(0, narrativeStartIndex);
  }

  cleaned = paragraphs.join("\n\n");

  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return cleaned.trim();
}