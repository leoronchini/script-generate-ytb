/* ================================
   RETRY LOGIC COM BACKOFF EXPONENCIAL
   Valores padrão fixos para erros temporários da API
================================ */

// Configurações padrão (não configuráveis)
const MAX_RETRIES = 5;
const INITIAL_DELAY = 2000; // 2 segundos
const MAX_DELAY = 30000; // 30 segundos máximo
const RETRYABLE_ERRORS = [503, 429, 500, 502, 504]; // Códigos HTTP retentáveis

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Verifica se é um erro retentável
      const errorCode = error?.error?.code;
      const isRetryable = errorCode && RETRYABLE_ERRORS.includes(errorCode);
      
      if (!isRetryable || attempt === MAX_RETRIES) {
        // Erro não retentável ou esgotaram as tentativas
        throw error;
      }

      // Log da tentativa (se função de log fornecida)
      if (logFn) {
        const errorMsg = error?.error?.message || error?.message || "Erro desconhecido";
        const contextMsg = context ? `${context} - ` : "";
        logFn("RETRY", `${contextMsg}Tentativa ${attempt + 1}/${MAX_RETRIES + 1} falhou (${errorCode}): ${errorMsg}. Aguardando ${delay}ms...`);
      }
      
      await sleep(delay);
      
      // Backoff exponencial com jitter
      delay = Math.min(delay * 2 + Math.random() * 1000, MAX_DELAY);
    }
  }

  throw lastError;
}
