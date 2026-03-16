# Script Generate - Gerador de Roteiros para YouTube

Gerador automático de roteiros narrativos longos usando Google Gemini AI. A partir de um título, o sistema gera um resumo, um prompt para thumbnail e um roteiro completo — salvando tudo em arquivos `.txt` e `.srt` prontos para uso.

## O que este projeto faz

1. Gera um **resumo/descrição** do roteiro a partir do título
2. Gera um **prompt para thumbnail** baseado no título e no resumo
3. Gera o **roteiro narrativo completo** no idioma configurado por canal
4. Limpa metatexto e formatações indesejadas da IA
5. Exporta um arquivo **info** (título + thumbnail prompt + descrição + roteiro) e um arquivo **.srt** (legendas)
6. Suporta **processamento em lote** de múltiplos títulos

---

## Pré-requisitos

- **Node.js** 18 ou superior
- Uma **chave de API do Google Gemini** — obtenha em [Google AI Studio](https://aistudio.google.com/app/apikey)

---

## Instalação

```bash
# 1. Acesse a pasta do projeto
cd script-generate-ytb

# 2. Instale as dependências
npm install
```

---

## Configuração

Toda a configuração é feita no arquivo `config.js`.

### 1. Adicione sua chave de API

```js
export const config = {
  geminiKey: "SUA_CHAVE_AQUI",
  // ...
};
```

### 2. Selecione o canal

O projeto usa o conceito de **canais** — cada canal tem seu próprio agente (prompt), idioma e pasta de saída.

```js
// Canal ativo (altere para o canal desejado)
export const selectedChannel = "ytb-west";
```

Os canais disponíveis estão no array `channels`:

| Nome | Idioma | Pasta de saída |
|------|--------|----------------|
| `ytb-west` | Romeno | `C:/Users/leoro/Videos/ytb-west` |
| `guadalupe` | Espanhol | `C:/Users/leoro/Videos/guadalupe` |
| `mexico` | Espanhol | `C:/Users/leoro/Videos/mexico-videos` |

Para adicionar um novo canal, inclua uma entrada no array `channels` em `config.js`:

```js
{
  name: "meu-canal",
  displayName: "Meu Canal",
  agentFile: "agent-meu-canal.txt",
  outputPath: "C:/Users/SeuNome/Videos/meu-canal",
  language: "português",
  generateThumbnailPrompt: true,
  generateBlockImagePrompts: false,
}
```

### 3. Defina o(s) título(s)

**Um único título:**
```js
export const config = {
  title: "Meu título aqui",
  // ...
};
```

**Múltiplos títulos (processamento em lote):**
```js
export const config = {
  title: [
    "Primeiro título",
    "Segundo título",
    "Terceiro título",
  ],
  // ...
};
```

### 4. Outras opções do `config`

| Opção | Padrão | Descrição |
|-------|--------|-----------|
| `model` | `"gemini-3-flash-preview"` | Modelo do Gemini a usar |
| `okTurns` | `3` | Número de continuações do roteiro (mais = roteiro mais longo) |
| `summaryAgentFile` | `"agent-summary.txt"` | Arquivo de prompt para o agente de resumo |
| `thumbnailAgentFile` | `"agent-thumbnail.txt"` | Arquivo de prompt para o agente de thumbnail |

---

## Como executar

### Usando as configurações do `config.js`

```bash
npm start
```

### Sobrescrevendo o título pela linha de comando

```bash
npm start -- --title "Título do vídeo"
```

### Sobrescrevendo o canal

```bash
npm start -- --channel guadalupe
```

### Combinando parâmetros

```bash
npm start -- --title "Meu título" --channel mexico --okTurns 5 --model "gemini-3-pro-preview"
```

### Todos os parâmetros disponíveis

| Parâmetro | Descrição |
|-----------|-----------|
| `--title "texto"` | Título do vídeo (sobrescreve o do `config.js`) |
| `--channel nome` | Canal a usar (sobrescreve `selectedChannel`) |
| `--okTurns N` | Número de continuações do roteiro |
| `--model "nome"` | Modelo do Gemini |
| `--agentFile "arquivo"` | Arquivo de prompt do agente principal |
| `--summaryAgentFile "arquivo"` | Arquivo de prompt do agente de resumo |
| `--thumbnailAgentFile "arquivo"` | Arquivo de prompt do agente de thumbnail |
| `--language "idioma"` | Idioma do roteiro (sobrescreve o do canal) |
| `--outputPath "caminho"` | Pasta de saída (sobrescreve o do canal) |
| `--geminiKey "chave"` | Chave da API (sobrescreve o do `config.js`) |

---

## Arquivos gerados

Para cada título processado, é criada uma subpasta dentro do `outputPath` do canal:

```
outputPath/
└── primeiros 20 chars do titulo.../
    ├── info-primeiros 20 chars.txt   (título + thumbnail prompt + descrição + roteiro)
    └── roteiro primeiros 20 chars.srt (legendas para o vídeo)
```

**Exemplo:**
```
C:/Users/leoro/Videos/ytb-west/
└── au izgonit mama cu cop.../
    ├── info-au izgonit mama cu cop.txt
    └── roteiro au izgonit mama cu cop.srt
```

### Arquivo `info-*.txt`

Contém todas as informações do roteiro em um único arquivo:

```
TITULO:
<título completo>
-------------
PROMPT THUMBNAIL:
<prompt gerado para a thumbnail>
--------------
DESCRIÇÃO
<resumo/descrição do roteiro>
--------------
ROTEIRO
<roteiro narrativo completo>
```

### Arquivo `.srt` (Legendas)

Arquivo de legendas no formato SRT padrão, com:
- Blocos de até 500 caracteres / máximo 100 palavras
- Duração de 30 segundos por bloco
- Intervalo de 10 segundos entre blocos

---

## Como funciona internamente

```
título
  │
  ├─► [Etapa 1] Agente de resumo  → descrição do roteiro
  │
  ├─► [Etapa 2] Agente de thumbnail → prompt para thumbnail
  │
  └─► [Etapa 3] Agente principal (okTurns repetições)
        │
        ├─ limpeza do texto (metatexto, formatações)
        ├─ info-*.txt
        └─ *.srt
```

---

## Solução de problemas

**`GEMINI_API_KEY não definida`**
- Defina `geminiKey` em `config.js` ou passe via `--geminiKey "sua_chave"`

**`Canal "X" não encontrado`**
- Verifique o valor de `selectedChannel` ou do parâmetro `--channel`
- Canais disponíveis: `ytb-west`, `guadalupe`, `mexico`

**`Título não informado`**
- Defina `title` em `config.js` ou use `--title "..."` na linha de comando

**`Prompt do agente está vazio`**
- Verifique se os arquivos `.txt` dos agentes existem e não estão vazios

**Arquivos não são salvos**
- Confirme que o `outputPath` do canal existe e que você tem permissão de escrita

**Roteiro muito curto**
- Aumente `okTurns` (ex: `--okTurns 5`); recomendado entre 3 e 6

**Erro 503 / 429 da API**
- O serviço está sobrecarregado ou o limite de taxa foi atingido; aguarde alguns minutos e tente novamente

---

## Licença

ISC
