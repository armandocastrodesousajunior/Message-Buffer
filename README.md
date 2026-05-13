<p align="center">
  <img src="server/public/foto.jpeg" width="100" height="100" style="border-radius:50%;border:3px solid #e5e5e5" alt="Armando Castro">
</p>

<h1 align="center">📬 Message Buffer Manager</h1>

<p align="center">
  <strong>Sistema de bufferizaçao de mensagens com janelamento temporal e entrega em lote via webhook</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js" alt="Node">
  <img src="https://img.shields.io/badge/Express-4.19-000?logo=express" alt="Express">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/SQLite-003B57?logo=sqlite" alt="SQLite">
  <img src="https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript" alt="TypeScript">
</p>

---

## 📖 Sobre

O **Message Buffer Manager** é um sistema que recebe mensagens via API REST, as agrupa por um **identificador** dentro de uma **janela de tempo** configurável e, quando a janela expira, entrega **todas as mensagens daquele grupo em um único lote** para um webhook configurado.

Isso é útil para cenários onde voce quer **reduzir o número de chamadas** ao seu sistema de destino, agrupando eventos relacionados que ocorrem em um curto intervalo de tempo.

> **Exemplo prático:** Se voce tem um sistema de eventos do usuário e 10 eventos ocorrem em 30 segundos para o mesmo usuário, em vez de 10 chamadas ao webhook, o Message Buffer envia **1 chamada** com os 10 eventos agrupados.

---

## 🔄 Logica de Funcionamento

O Message Buffer é composto por **4 componentes principais** que trabalham juntos:

### 1. Buffer

É a configuração base. Cada buffer possui:

| Campo | Descrição |
|-------|-----------|
| `name` | Nome identificador do buffer |
| `window_time` | Tempo da janela em segundos (ex: 30) |
| `webhook_url` | URL para onde as mensagens agrupadas serao enviadas |
| `max_concurrent_windows` | Limite maximo de janelas simultaneas (opcional, null = ilimitado) |
| `require_consumption` | Se `true`, exige confirmação de consumo antes de liberar o identificador |
| `consumption_timeout` | Tempo em ms para expiração automática da confirmação (null = sem prazo) |
| `webhook_timeout` | Timeout da requisição ao webhook em ms (padrão: 30000) |
| `api_key` | Chave de API unica gerada automaticamente (UUID) |

### 2. Janela (Window)

Uma janela é criada quando a primeira mensagem de um determinado `identifier` chega. Cada janela tem um ciclo de vida de **5 estados**:

| Estado | Descrição |
|--------|-----------|
| ✅ `open` | Janela aberta recebendo mensagens. Um timer interno conta o `window_time` |
| 🔄 `processing` | Janela expirou. As mensagens estao sendo agrupadas e enviadas ao webhook |
| ⏳ `closed` | Webhook chamado. Aguardando confirmação de consumo (se habilitado) |
| ✅ `consumed` | Consumo confirmado. Ciclo encerrado |
| ⌛ `expired` | Tempo de confirmação expirou. Identificador desbloqueado automaticamente |

Enquanto a janela está **open**, todas as mensagens que chegam com o mesmo `identifier` sao adicionadas a ela. Quando o timer dispara, a janela transita para **processing**, as mensagens sao consolidadas em um payload JSON e enviadas via POST para o webhook configurado. Apos a resposta (sucesso ou erro), a janela é marcada como **closed**.

### 3. Mensagens

Cada mensagem possui:
- **identifier** — para agrupamento na janela
- **content** — o conteudo (string, number, boolean, objeto JSON ou array)
- **type** — define como o conteudo deve ser interpretado: `string`, `number`, `boolean` ou `json`
- **received_at** — timestamp de recebimento (gerado automaticamente)

### 4. Fila de Espera (Waiting Queue)

Para evitar sobrecarga, cada buffer pode ter um **limite maximo de janelas concorrentes** (`max_concurrent_windows`). Se esse limite for atingido, as novas mensagens **nao sao perdidas** — elas vao para uma **fila de espera** no banco de dados. Quando uma janela é fechada, o sistema automaticamente verifica se há mensagens na fila e cria uma nova janela para processá-las.

Se o limite for `null` (ilimitado), todas as mensagens sao processadas imediatamente.

---

## 🧠 Mapa Mental do Fluxo

```
                     ┌──────────────┐
                     │   Cliente    │
                     │ Envia msg    │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ POST /api/   │
                     │ ingest/:id   │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ Valida API   │
                     │    Key       │
                     └──┬───────┬───┘
                   SIM  │       │  NAO
                        ▼       ▼
                 ┌──────────┐  ┌──────┐
                 │  Janela  │  │ 401  │
                 │  existe? │  │ 404  │
                 └──┬───┬───┘  └──────┘
               SIM  │   │  NAO
                    ▼   ▼
          ┌──────────┐  ┌─────────────────────┐
          │ Adiciona │  │ Conta janelas       │
          │ na janela│  │ concorrentes        │
          └──────────┘  └──┬────────────┬─────┘
                      ABAIXO │            │ NO LIMITE
                             ▼            ▼
                      ┌──────────┐  ┌──────────┐
                      │ Cria jan.│  │ Enfileira│
                      │ + timer  │  │ na fila  │
                      └────┬─────┘  └──────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Timer expira │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Janela →     │
                    │ processing   │
                    │ Agrupa msgs  │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ POST para    │
                    │ webhook_url  │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Registra log │
                    │ Janela →     │
                    │ closed       │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Fila tem     │
                    │ mensagens?   │
                    └──┬───────┬───┘
                  SIM  │       │  NAO
                       ▼       ▼
                ┌──────────┐  ┌──────┐
                │ Cria     │  │ Fim  │
                │ nova jan.│  └──────┘
                └──────────┘
```

---

## ⏳ Fila de Espera em Detalhes

A fila de espera garante que **nenhuma mensagem seja perdida** quando o limite de janelas concorrentes é atingido.

**Como funciona na prática:**

1. Um buffer é configurado com `max_concurrent_windows: 3`
2. 3 janelas já estao abertas para 3 identifiers diferentes
3. Uma 4ª mensagem com um novo identifier chega → ela vai para a **fila de espera**
4. A resposta tem `queued: true` e `window_id: ""`
5. Assim que uma das 3 janelas for fechada, o sistema pega **TODAS as mensagens da fila com aquele identificador** e cria uma única janela com todas elas

### Confirmação de Consumo

Quando um buffer possui **"Requerer confirmação de consumo"** ativado, as janelas passam por um estado adicional `closed → consumed`:

- **Webhook retorna `200`:** janela vai direto para `consumed`
- **Webhook retorna outro status (ex: `202`):** janela fica `closed` até confirmação manual ou timeout
- **Timer de expiração:** se `consumption_timeout` foi definido, ao expirar o sistema confirma automaticamente
- **Confirmação manual:** via rota `POST /api/confirm/:windowId` com `X-Api-Key`, ou pela interface em "Confirmar Consumo"

Enquanto uma janela do identificador **A** estiver `closed`, novas mensagens de **A** vão para a fila de espera — outros identificadores não são bloqueados.

### Comportamento em reinicializaçao

Tanto as janelas abertas quanto a fila de espera sao armazenadas no banco de dados SQLite. Ao reiniciar, o servidor **recupera automaticamente** todas as janelas que estavam abertas e reativa os timers. Se alguma janela já deveria ter expirado, ela é processada imediatamente.

> **Importante:** Os timers sao mantidos em memória. Se o servidor cair, o tempo restante das janelas é perdido, mas na reinicialização o sistema verifica o `expires_at` de cada janela e dispara imediatamente as que já passaram do prazo.

---

## 📡 API Pública

Todas as rotas públicas são autenticadas pelo header `X-Api-Key` (a chave gerada na criação do buffer).

### Ingerir Mensagem

```
POST /api/ingest/:bufferId
```

| Header | Obrigatório | Descrição |
|--------|-------------|-----------|
| `X-Api-Key` | Sim | Chave de API do buffer |
| `Content-Type` | Sim | `application/json` |

**Corpo da Requisição**

```json
{
  "identifier": "sessao-usuario-123",
  "type": "json",
  "content": { "evento": "clique", "elemento": "botao-comprar" }
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `identifier` | `string` | Sim | Identificador para agrupar mensagens na mesma janela |
| `type` | `string` | Sim | Tipo do conteudo: `string`, `number`, `boolean` ou `json` |
| `content` | `any` | Sim | Conteudo da mensagem |

---

## 📦 Tipos de Conteúdo

### string
```json
{
  "identifier": "user-123",
  "type": "string",
  "content": "Ola, mundo!"
}
```

### number
```json
{
  "identifier": "metric-456",
  "type": "number",
  "content": 42
}
```

### boolean
```json
{
  "identifier": "flag-789",
  "type": "boolean",
  "content": true
}
```

### json — Objeto
```json
{
  "identifier": "order-001",
  "type": "json",
  "content": {
    "id": 1,
    "produto": "Camiseta",
    "qtd": 3,
    "preco": 59.90
  }
}
```

### json — Array
```json
{
  "identifier": "cart-002",
  "type": "json",
  "content": [
    { "item": "Camiseta", "qty": 2 },
    { "item": "Calça", "qty": 1 }
  ]
}
```

### json — Array misto
```json
{
  "identifier": "log-003",
  "type": "json",
  "content": [
    42,
    "texto",
    true,
    { "chave": "valor" }
  ]
}
```

---

## 📝 Exemplos de Uso

### curl

```bash
curl -X POST http://localhost:3000/api/ingest/SEU-BUFFER-ID \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: SUA-API-KEY" \
  -d '{
    "identifier": "sessao-usuario-123",
    "type": "json",
    "content": {
      "evento": "clique",
      "elemento": "botao-comprar"
    }
  }'
```

### JavaScript (fetch)

```js
const response = await fetch('http://localhost:3000/api/ingest/SEU-BUFFER-ID', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': 'SUA-API-KEY'
  },
  body: JSON.stringify({
    identifier: 'sessao-usuario-123',
    type: 'json',
    content: { evento: 'clique', elemento: 'botao-comprar' }
  })
});
const data = await response.json();
```

### Node.js (axios)

```js
const axios = require('axios');

const response = await axios.post(
  'http://localhost:3000/api/ingest/SEU-BUFFER-ID',
  {
    identifier: 'sessao-usuario-123',
    type: 'json',
    content: { evento: 'clique' }
  },
  {
    headers: { 'X-Api-Key': 'SUA-API-KEY' }
  }
);
console.log(response.data);
```

---

### Listar Janelas Pendentes

Retorna todas as janelas de um buffer com status `closed` aguardando confirmação de consumo.

```
GET /api/windows/pending?bufferId=SEU-BUFFER-ID
```

| Header | Obrigatório | Descrição |
|--------|-------------|-----------|
| `X-Api-Key` | Sim | Chave de API do buffer |

**Exemplo com curl:**

```bash
curl "http://localhost:3000/api/windows/pending?bufferId=SEU-BUFFER-ID" \
  -H "X-Api-Key: SUA-API-KEY"
```

**Resposta (200):**

```json
{
  "windows": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "buffer_id": "uuid-do-buffer",
      "identifier": "sessao-usuario-123",
      "status": "closed",
      "expires_at": "2026-05-12T23:37:06.630Z",
      "created_at": "2026-05-12T23:36:51.590Z"
    }
  ]
}
```

---

### Confirmar Consumo

Confirma manualmente o consumo de uma janela, transitando de `closed` para `consumed`. Desbloqueia o identificador para novas janelas.

```
POST /api/confirm/:windowId
```

| Header | Obrigatório | Descrição |
|--------|-------------|-----------|
| `X-Api-Key` | Sim | Chave de API do buffer dono da janela |

**Exemplo com curl:**

```bash
curl -X POST http://localhost:3000/api/confirm/ID-DA-JANELA \
  -H "X-Api-Key: SUA-API-KEY"
```

**Resposta (200):**

```json
{
  "status": "consumed"
}
```

---

## ✅ Respostas da API

### Códigos HTTP

| Código | Significado |
|--------|-------------|
| **200** | Mensagem aceita e alocada em uma janela (ou fila de espera) |
| **400** | Campos obrigatórios ausentes ou `type` inválido |
| **401** | Header `X-Api-Key` ausente |
| **404** | Buffer nao encontrado ou API Key inválida |

### Corpo da resposta (200)

**Mensagem alocada na janela:**
```json
{
  "accepted": true,
  "window_id": "550e8400-e29b-41d4-a716-446655440000",
  "queued": false
}
```

**Mensagem enfileirada (limite de janelas atingido):**
```json
{
  "accepted": true,
  "window_id": "",
  "queued": true,
  "queue_position": 3
}
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `accepted` | `boolean` | Sempre `true` quando a mensagem é válida |
| `window_id` | `string` | ID da janela onde a mensagem foi alocada (vazio se `queued: true`) |
| `queued` | `boolean` | `true` se o limite de janelas concorrentes foi atingido e a mensagem foi para a fila de espera |
| `queue_position` | `number` | Posição na fila de espera (presente apenas quando `queued: true`) |

---

## 🔗 Payload enviado ao webhook

Quando a janela expira, o buffer envia um POST para a `webhook_url` configurada com o seguinte payload:

```json
{
  "identifier": "sessao-usuario-123",
  "buffer_id": "uuid-do-buffer",
  "messages": [
    {
      "type": "string",
      "content": "Primeira mensagem",
      "received_at": "2025-05-10T16:00:00.000Z"
    },
    {
      "type": "number",
      "content": 42,
      "received_at": "2025-05-10T16:00:05.000Z"
    },
    {
      "type": "json",
      "content": { "evento": "clique" },
      "received_at": "2025-05-10T16:00:10.000Z"
    }
  ]
}
```

O webhook tem **30 segundos** para responder. Se a requisição falhar (timeout, erro de rede, status 5xx), o erro é registrado nos logs, mas a janela ainda é fechada. O sistema **nao faz retentativas automaticas**.

---

## 🚀 Instalação e Uso

### Pré-requisitos

- Node.js 18+
- npm

### Passo a passo

```bash
# 1. Clone o repositório
git clone https://github.com/armandocastrodesousajunior/Message-Buffer.git
cd Message-Buffer

# 2. Instale todas as dependências
npm run install:all

# 3. Configure o ambiente
cp .env.example .env
# Edite o .env se necessario

# 4. Execute em desenvolvimento
npm run dev
```

Acesse:
- **Frontend + API:** http://localhost:3000
- **Documentação:** http://localhost:3000/docs

### Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Builda o client e inicia o servidor em modo desenvolvimento |
| `npm run build` | Compila o servidor e o client para produção |
| `npm run start` | Inicia o servidor em produção |
| `npm run install:all` | Instala dependências do server e client |

### Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `3000` | Porta do servidor |
| `ACCESS_TOKEN` | (vazio) | Token Bearer para acesso a API administrativa |
| `DATABASE_URL` | `sqlite://../data/message-buffer.db` | Conexao com o banco (SQLite ou PostgreSQL) |

---

## 🐳 Docker

### Pré-requisitos

- Docker
- Docker Compose

### Executando com Docker Compose

```bash
# 1. Clone o repositório
git clone https://github.com/armandocastrodesousajunior/Message-Buffer.git
cd Message-Buffer

# 2. Inicie o container
docker compose up -d

# 3. Acompanhe os logs
docker compose logs -f
```

Acesse:
- **Frontend + API:** http://localhost:3000
- **Documentação:** http://localhost:3000/docs

### Parando o container

```bash
docker compose down
```

Para remover também o volume com os dados do banco:

```bash
docker compose down -v
```

### Build manual da imagem

```bash
docker build -t message-buffer .
docker run -d \
  --name message-buffer \
  -p 3000:3000 \
  -e ACCESS_TOKEN=meu-token-aqui \
  -e DATABASE_URL=postgres://message_buffer:message_buffer@host.docker.internal:5432/message_buffer \
  message-buffer
```

### Estrutura dos arquivos Docker

| Arquivo | Finalidade |
|---------|------------|
| `Dockerfile` | Imagem baseada em `node:20-alpine`, instala dependências (incluindo `pg`), builda o client e inicia o servidor com `tsx` |
| `docker-compose.yml` | Orquestra o app + PostgreSQL 16, com health check, volume persistente e restart automático |
| `.dockerignore` | Exclui `node_modules/`, `.env`, `data/` e arquivos desnecessários do build |

### Serviços do docker-compose

| Serviço | Imagem | Finalidade |
|---------|--------|------------|
| `message-buffer` | Build local | Aplicação Node.js (Express + React) |
| `db` | `postgres:16-alpine` | Banco de dados PostgreSQL |

> **Persistência:** O PostgreSQL armazena os dados em um volume Docker (`message-buffer-pgdata`). Enquanto o volume existir, os dados sobrevivem a reinicializações do container.

---

## 🧪 Testes

Para testar o envio de mensagens para um buffer, utilize o script em `tests/send-messages.js`:

```bash
node tests/send-messages.js
```

Preencha as variaveis `BUFFER_ID` e `API_KEY` no topo do arquivo antes de executar.

---

## 🛠️ Stack Tecnológica

### Backend

| Tecnologia | Versão | Finalidade |
|------------|--------|------------|
| Node.js | 18+ | Runtime |
| Express | 4.19 | Servidor HTTP |
| Knex | 3.1 | Query builder |
| better-sqlite3 | 11.1 | Banco de dados SQLite |
| Axios | 1.7 | Chamadas HTTP (webhook) |
| UUID | 10.0 | Geração de IDs |
| Helmet | 7.1 | Segurança (headers) |
| TypeScript | 5.5 | Tipagem |

### Frontend

| Tecnologia | Versão | Finalidade |
|------------|--------|------------|
| React | 18.3 | UI Framework |
| React Router DOM | 6.25 | Roteamento |
| Vite | 5.3 | Build tool |
| TypeScript | 5.5 | Tipagem |

---

## 👤 Desenvolvedor

<p align="center">
  <img src="server/public/foto.jpeg" width="120" height="120" style="border-radius:50%;border:3px solid #e5e5e5" alt="Armando Castro">
</p>

<p align="center">
  <strong>Armando Castro de Sousa Junior</strong><br>
  <span style="color:#737373">Criador do Message Buffer Manager</span>
</p>

<p align="center">
  <a href="https://github.com/armandocastrodesousajunior/Message-Buffer">github.com/armandocastrodesousajunior/Message-Buffer</a>
</p>

### Contribua com o projeto

Se voce gostou do projeto e quer ajudar, faça um **PIX** para:

<p align="center">
  <img src="server/public/qrcode-pix.png" width="180" style="border:1px solid #e5e5e5;border-radius:8px" alt="QR Code PIX">
</p>

<p align="center">
  Chave PIX:<br>
  <code>armandocastrodesousajunior@gmail.com</code>
</p>

---

<p align="center">
  Message Buffer Manager &mdash; Documentação completa da API de ingestão
</p>
