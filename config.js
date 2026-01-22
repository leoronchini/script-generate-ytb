// ================================
// CONFIGURAÇÕES DO GERADOR DE ROTEIROS
// ================================

// Canais pré-configurados
export const channels = [
  {
    name: "guadalupe",
    displayName: "Guadalupe Mexico",
    agentFile: "agent-guadalupe.txt",
    outputPath: "C:/Users/leoro/Videos/guadalupe",
    language: "espanhol",
  },
  {
    name: "ytb-west",
    displayName: "YTB West",
    agentFile: "agent.txt",
    outputPath: "C:/Users/leoro/Videos/ytb-west",
    language: "romeno",
  },
  // Adicione mais canais aqui conforme necessário
  // {
  //   name: "outro-canal",
  //   displayName: "Outro Canal",
  //   agentFile: "agent-outro.txt",
  //   outputPath: "C:/Users/leoro/Videos/outro-canal",
  //   language: "português",
  // },
];

// Canal selecionado (use o nome do canal do array acima)
export const selectedChannel = "guadalupe";
// export const selectedChannel = "ytb-west";

// Configurações padrão (raramente alteradas)
export const config = {
  // Título(s) do vídeo (obrigatório se não for passado por parâmetro)
  // Exemplo com um título: title: "Meu título aqui"
  // Exemplo com múltiplos: title: ["Título 1", "Título 2", "Título 3"]
  title: "1Escucha con fe esta oración a San Benito y algo grande sucederá.",
  // title: [
  //   "Oración poderosa a Nuestra Señora de Guadalupe, San Benito y San Miguel. Escúchala con fe.",
  //   "Escucha esta oración a San Miguel y San Benito y prepárate para una nueva vida. Escúchala con fe.",
  // ],

  // Modelo do Gemini a ser usado
  // Padrão: gemini-3-pro-preview
  model: "gemini-3-pro-preview",
  // model: "gemini-3-flash-preview",

  // Arquivo do agente de resumo (gera descrição do roteiro)
  summaryAgentFile: "agent-summary.txt",

  // Arquivo do agente de thumbnail (gera prompt para thumbnail)
  thumbnailAgentFile: "agent-thumbnail.txt",

  // Número de turnos "OK" após a primeira mensagem
  okTurns: 3,

  // Chave da API do Google Gemini
  // Obtenha sua chave em: https://makersuite.google.com/app/apikey
  geminiKey: "api-key",
};
