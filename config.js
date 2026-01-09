// ================================
// CONFIGURAÇÕES DO GERADOR DE ROTEIROS
// ================================

export const config = {
  // Título do vídeo (obrigatório se não for passado por parâmetro)
  title: "Au umilit văduva și i-au furat pământul. Dar Cowboy-ul misterios s-a întors pentru răzbunare!",

  // Path onde os arquivos serão salvos
  // Se vazio ou null, será usado o diretório atual/script-bot
  // Exemplo: "C:/Users/user/Videos/roteiros"
  outputPath: "C:/Users/leoro/Videos/ytb west",

  // Modelo do Gemini a ser usado
  // Padrão: gemini-3-pro-preview
  model: "gemini-3-pro-preview",

  // Arquivo do agente (prompt)
  agentFile: "agent.txt",

  // Número de turnos "OK" após a primeira mensagem
  okTurns: 3,
};
