# Script Generate - Gerador de Roteiros para YouTube

Um gerador automático de roteiros narrativos longos usando inteligência artificial. Este projeto cria roteiros completos em romeno a partir de um título, gerando arquivos de texto e legendas (SRT) prontos para uso em vídeos do YouTube.

## 📋 O que este projeto faz?

Este projeto automatiza a criação de roteiros narrativos longos para vídeos. Você fornece apenas um **título** e o sistema:

1. ✅ Gera um roteiro narrativo completo no idioma desejado
2. ✅ Limpa automaticamente metatexto e formatações indesejadas
3. ✅ Cria arquivo de roteiro em texto (.txt)
4. ✅ Gera arquivo de legendas (.srt) para vídeos
5. ✅ Organiza tudo em pastas nomeadas automaticamente

## 🚀 Como usar

### Pré-requisitos

Antes de começar, você precisa ter:

- **Node.js** instalado (versão 16 ou superior)
- Uma **chave de API do Google Gemini** (obtenha em [Google AI Studio](https://makersuite.google.com/app/apikey))

### Instalação

1. **Clone ou baixe este projeto** para seu computador

2. **Abra o terminal** na pasta do projeto e instale as dependências:
   ```bash
   npm install
   ```

3. **Configure sua chave de API**:
   - Crie um arquivo chamado `.env` na raiz do projeto
   - Adicione sua chave do Gemini:
     ```
     GEMINI_API_KEY=sua_chave_aqui
     ```

### Configuração

Abra o arquivo `config.js` e ajuste as configurações:

```javascript
export const config = {
  // Título do vídeo (pode ser sobrescrito por parâmetro)
  title: "Seu título aqui",
  
  // Pasta onde os arquivos serão salvos
  outputPath: "C:/caminho/para/suas/pastas",
  
  // Modelo do Gemini (padrão: gemini-3-pro-preview)
  model: "gemini-3-pro-preview",
  
  // Arquivo do agente (prompt)
  agentFile: "agent.txt",
  
  // Número de turnos "OK" após a primeira mensagem
  okTurns: 3,

  // Idioma do roteiro gerado
  // Exemplos: "romeno", "português", "espanhol", "inglês", "francês", etc.
  language: "romeno",
};
```

**Configurações importantes:**

- **`title`**: O título do vídeo que será usado para gerar o roteiro
- **`outputPath`**: Caminho completo onde os arquivos serão salvos (ex: `"C:/Users/SeuNome/Videos/roteiros"`)
- **`okTurns`**: Quantas vezes o sistema pedirá "continuação" ao gerar o roteiro (padrão: 3)
- **`language`**: Idioma em que o roteiro será gerado (padrão: "romeno"). Pode ser qualquer idioma suportado pelo modelo

### Executando o gerador

**Opção 1: Usar o título do config.js**
```bash
npm start
```

**Opção 2: Especificar título na linha de comando**
```bash
npm start -- --title "Seu título aqui"
```

**Opção 3: Personalizar outras opções**
```bash
npm start -- --title "Título" --okTurns 5 --model "gemini-3-pro-preview" --language "português"
```

### Parâmetros disponíveis

Você pode passar os seguintes parâmetros na linha de comando:

- `--title "texto"` - Título do vídeo
- `--okTurns 3` - Número de continuações (padrão: 3)
- `--model "nome"` - Modelo do Gemini a usar
- `--agentFile "arquivo.txt"` - Arquivo de prompt personalizado
- `--language "idioma"` - Idioma do roteiro gerado (padrão: "romeno")

## 📁 Estrutura de arquivos gerados

Após a execução, os arquivos serão salvos em:

```
outputPath/
└── nome-do-titulo/
    ├── roteiro nome-do-titulo.txt  (roteiro completo)
    ├── info-nome-do-titulo.txt     (apenas o título)
    └── roteiro nome-do-titulo.srt  (legendas para vídeo)
```

**Exemplo:**
```
C:/Users/leoro/Videos/ytb west/
└── au umilit vadva si i/
    ├── roteiro au umilit vadva si i.txt
    ├── info-au umilit vadva si i.txt
    └── roteiro au umilit vadva si i.srt
```

## 📝 Formato dos arquivos gerados

### Arquivo .txt (Roteiro)
Contém o roteiro narrativo completo, limpo e formatado, pronto para narração.

### Arquivo .srt (Legendas)
Arquivo de legendas no formato padrão SRT, com:
- Blocos de até 500 caracteres
- Máximo de 100 palavras por bloco
- Duração de 30 segundos por bloco
- Intervalo de 10 segundos entre blocos

## ⚙️ Como funciona

1. **Inicialização**: O sistema lê o título e o arquivo de prompt (`agent.txt`)
2. **Geração**: Envia o título para o Gemini e solicita o roteiro
3. **Continuação**: Faz múltiplas solicitações de continuação (conforme `okTurns`)
4. **Limpeza**: Remove metatexto, formatações e textos indesejados da IA
5. **Exportação**: Gera os arquivos .txt e .srt na pasta configurada

## 🔧 Solução de problemas

### Erro: "GEMINI_API_KEY não definida"
- Verifique se o arquivo `.env` existe na raiz do projeto
- Confirme que a chave está escrita corretamente: `GEMINI_API_KEY=sua_chave`

### Erro: "Título não informado"
- Configure o título no `config.js` ou use `--title` na linha de comando

### Erro: "Prompt do agente está vazio"
- Verifique se o arquivo `agent.txt` existe e não está vazio

### Arquivos não são salvos
- Verifique se o caminho em `outputPath` está correto
- Confirme que você tem permissão de escrita na pasta especificada

### Roteiro muito curto ou incompleto
- Aumente o valor de `okTurns` no config ou via parâmetro (ex: `--okTurns 5`)

## 📌 Dicas de uso

1. **Títulos descritivos**: Use títulos que descrevam bem a história para melhores resultados
2. **Ajuste okTurns**: Para roteiros mais longos, aumente `okTurns` (3-5 é recomendado)
3. **Organize pastas**: Configure `outputPath` para uma pasta dedicada aos seus roteiros
4. **Revisão**: Sempre revise o roteiro gerado antes de usar em produção

## 📄 Licença

ISC

## 🤝 Suporte

Se encontrar problemas ou tiver dúvidas:
1. Verifique se todas as dependências estão instaladas (`npm install`)
2. Confirme que sua chave de API do Gemini está válida
3. Verifique os logs no terminal para mensagens de erro específicas

---

**Desenvolvido para facilitar a criação de roteiros narrativos para conteúdo de vídeo.**
