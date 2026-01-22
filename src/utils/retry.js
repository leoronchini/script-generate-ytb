/* ================================
   RETRY LOGIC COM BACKOFF EXPONENCIAL
   Valores padrão fixos para erros temporários da API
================================ */

// Configurações padrão (não configuráveis)
const MAX_RETRIES = 5;
const INITIAL_DELAY = 2000; // 2 segundos
const MAX_DELAY = 30000; // 30 segundos máximo
const REQUEST_TIMEOUT = 180000; // 3 minutos de timeout por requisição (API pode demorar)
const RETRYABLE_ERRORS = [503, 429, 500, 502, 504]; // Códigos HTTP retentáveis

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Adiciona timeout a uma promise com logs de progresso
 * @param {Promise} promise - Promise a ser executada
 * @param {number} timeoutMs - Timeout em milissegundos
 * @param {string} errorMessage - Mensagem de erro em caso de timeout
 * @param {Function} logFn - Função de log (opcional)
 * @returns {Promise} Promise com timeout
 */
function withTimeout(promise, timeoutMs, errorMessage = "Timeout na requisição", logFn = null) {
  let timeoutId;
  let progressInterval;
  let elapsed = 0;
  const progressIntervalMs = 30000; // Log a cada 30 segundos (menos poluído)
  
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      if (progressInterval) clearInterval(progressInterval);
      reject(new Error(errorMessage));
    }, timeoutMs);
    
    // Log de progresso periódico (apenas se demorar muito)
    if (logFn) {
      progressInterval = setInterval(() => {
        elapsed += progressIntervalMs;
        const remaining = Math.max(0, timeoutMs - elapsed);
        if (remaining > 0) {
          logFn("RETRY", `Aguardando resposta... (${Math.floor(elapsed/1000)}s)`);
        }
      }, progressIntervalMs);
    }
  });
  
  return Promise.race([
    promise.then(result => {
      if (timeoutId) clearTimeout(timeoutId);
      if (progressInterval) clearInterval(progressInterval);
      return result;
    }).catch(error => {
      if (timeoutId) clearTimeout(timeoutId);
      if (progressInterval) clearInterval(progressInterval);
      throw error;
    }),
    timeoutPromise
  ]);
}

/**
 * Executa uma função com retry automático em caso de erros temporários
 * @param {Function} fn - Função assíncrona a ser executada
 * @param {Function} logFn - Função de log para mensagens (opcional)
 * @param {string} context - Contexto descritivo para logs (opcional)
 * @returns {Promise} Resultado da função ou lança o último erro
 */
export async function retryWithBackoff(fn, logFn = null, context = "") {
  let lastError;
  let delay = INITIAL_DELAY;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await withTimeout(
        fn(),
        REQUEST_TIMEOUT,
        `Requisição excedeu o timeout de ${REQUEST_TIMEOUT}ms`,
        logFn
      );
      
      if (logFn && attempt > 0) {
        logFn("RETRY", `Sucesso na tentativa ${attempt + 1}`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Verifica se é um erro retentável (incluindo timeout)
      const errorCode = error?.error?.code;
      const errorMessage = error?.message || "";
      const isTimeout = errorMessage.toLowerCase().includes("timeout");
      const isRetryable = (errorCode && RETRYABLE_ERRORS.includes(errorCode)) || isTimeout;
      
      if (!isRetryable || attempt === MAX_RETRIES) {
        // Erro não retentável ou esgotaram as tentativas
        if (logFn) {
          if (isTimeout) {
            logFn("ERRO", `Timeout após ${attempt + 1} tentativa(s)`);
          } else {
            const errorMsg = error?.error?.message || error?.message || "Erro desconhecido";
            logFn("ERRO", `Falha após ${attempt + 1} tentativa(s): ${errorMsg}`);
          }
        }
        throw error;
      }

      // Log da tentativa apenas se necessário
      if (logFn && attempt === 0) {
        const errorMsg = error?.error?.message || error?.message || "Erro desconhecido";
        const errorType = isTimeout ? "Timeout" : `Erro ${errorCode || "desconhecido"}`;
        logFn("RETRY", `Tentativa ${attempt + 1}/${MAX_RETRIES + 1} falhou (${errorType}). Tentando novamente...`);
      }
      
      await sleep(delay);
      
      // Backoff exponencial com jitter
      delay = Math.min(delay * 2 + Math.random() * 1000, MAX_DELAY);
    }
  }

  throw lastError;
}
