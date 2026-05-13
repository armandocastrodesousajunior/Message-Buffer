import { Router, Request, Response } from 'express';

export function createDocsRoutes(): Router {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documentação - Message Buffer Manager</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{
      --black:#000;--white:#fff;--gray-50:#fafafa;--gray-100:#f5f5f5;
      --gray-200:#e5e5e5;--gray-300:#d4d4d4;--gray-400:#a3a3a3;
      --gray-500:#737373;--gray-600:#525252;--gray-700:#404040;
      --gray-800:#262626;--gray-900:#171717;
      --red:#dc2626;--red-light:#fef2f2;
      --green:#059669;--green-light:#ecfdf5;
      --blue:#2563eb;--blue-light:#eff6ff;
      --amber:#d97706;--amber-light:#fffbeb;
      --font:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
      --radius:8px;--radius-sm:4px;--sidebar-w:240px
    }
    html{font-size:16px;-webkit-font-smoothing:antialiased;scroll-behavior:smooth}
    body{
      font-family:var(--font);background:var(--gray-50);color:var(--gray-900);
      line-height:1.6;min-height:100vh
    }
    code,pre{font-family:'SF Mono','Fira Code','Fira Mono','Roboto Mono',monospace;font-size:.875em}
    a{color:inherit;text-decoration:none}

    .layout{min-height:100vh;display:flex;flex-direction:column}
    .header{background:var(--white);border-bottom:1px solid var(--gray-200);position:sticky;top:0;z-index:100}
    .header-content{max-width:1200px;margin:0 auto;padding:0 24px;height:60px;display:flex;align-items:center;justify-content:space-between}
    .header-title{font-size:1.125rem;font-weight:700;color:var(--black);cursor:pointer;letter-spacing:-.02em}
    .nav{display:flex;gap:4px}
    .nav-link{
      background:none;border:none;padding:8px 16px;font-size:.875rem;font-family:var(--font);
      color:var(--gray-600);cursor:pointer;border-radius:var(--radius-sm);transition:all .15s;
      display:inline-flex;align-items:center;text-decoration:none
    }
    .nav-link:hover{background:var(--gray-100);color:var(--black)}
    .nav-link.active{background:var(--gray-100);color:var(--black);font-weight:600}

    .wrapper{display:flex;max-width:1200px;margin:0 auto;padding:0;flex:1;width:100%}

    .sidebar{
      width:var(--sidebar-w);flex-shrink:0;position:sticky;top:60px;
      height:calc(100vh - 60px);overflow-y:auto;padding:24px 16px 24px 24px;
      border-right:1px solid var(--gray-200);background:var(--white)
    }
    .sidebar details summary{list-style:none;display:flex;align-items:center;gap:6px;cursor:pointer;padding:6px 8px;margin-bottom:8px;border-radius:var(--radius-sm);user-select:none;transition:background .15s}
    .sidebar details summary::-webkit-details-marker{display:none}
    .sidebar details summary:hover{background:var(--gray-100)}
    .sidebar details summary::before{content:"▶";font-size:.55rem;color:var(--gray-400);transition:transform .15s;flex-shrink:0}
    .sidebar details[open] summary::before{transform:rotate(90deg)}
    .sidebar-label{font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--gray-500)}
    .sidebar-links{display:flex;flex-direction:column;gap:2px;padding-left:20px;margin-bottom:12px}
    .sidebar-link{
      display:flex;align-items:center;gap:8px;padding:8px 10px;font-size:.8125rem;
      color:var(--gray-600);border-radius:var(--radius-sm);transition:all .15s;
      cursor:pointer;border:none;background:none;font-family:var(--font);width:100%;text-align:left
    }
    .sidebar-link:hover{background:var(--gray-100);color:var(--black)}
    .sidebar-link .ico{font-size:1rem;width:20px;text-align:center;flex-shrink:0}

    .main-content{flex:1;min-width:0;padding:32px 32px 48px}
    .page-header h2{font-size:1.5rem;font-weight:700;margin-bottom:24px}

    .detail-card{background:var(--white);border:1px solid var(--gray-200);border-radius:var(--radius);padding:24px;margin-bottom:20px}
    .detail-card h3{font-size:1rem;font-weight:600;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--gray-100)}
    .detail-card h4{font-size:.9375rem;font-weight:600;margin-bottom:12px;color:var(--gray-800);margin-top:20px}
    .detail-card h4:first-child{margin-top:0}
    .detail-card p{color:var(--gray-600);margin-bottom:12px}
    .detail-card p strong{color:var(--gray-900)}
    .detail-card ol,.detail-card ul{padding-left:20px;margin-bottom:12px;color:var(--gray-600)}
    .detail-card li{margin-bottom:6px}
    .detail-card li strong{color:var(--gray-900)}

    .endpoint-box{background:var(--gray-900);color:var(--white);padding:12px 16px;border-radius:var(--radius-sm);margin-bottom:8px}
    .endpoint-box code{font-size:.9375rem;color:var(--white)}
    .endpoint-desc{font-size:.875rem;color:var(--gray-500);margin-bottom:16px}
    .endpoint-desc code{font-size:.8125rem;background:var(--gray-100);padding:1px 4px;border-radius:2px}

    table{width:100%;border-collapse:collapse;margin:12px 0}
    th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--gray-200);font-size:.875rem}
    th{color:var(--gray-500);font-weight:600;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em}
    td{color:var(--gray-900)}
    td code{font-size:.8125rem;background:var(--gray-100);padding:1px 4px;border-radius:2px;color:var(--gray-800)}

    .method-badge{
      display:inline-block;background:var(--black);color:var(--white);
      font-weight:700;padding:3px 10px;border-radius:var(--radius-sm);
      font-size:.75rem;text-transform:uppercase;letter-spacing:.03em
    }
    .type-badge{
      display:inline-block;padding:2px 8px;border-radius:9999px;
      font-size:.75rem;font-weight:600;margin-right:4px
    }
    .type-badge.string{background:#e0f2fe;color:#0369a1}
    .type-badge.number{background:#fef3c7;color:#92400e}
    .type-badge.boolean{background:#ede9fe;color:#5b21b6}
    .type-badge.json{background:#fce7f3;color:#9d174d}

    .status-badge{
      display:inline-block;padding:2px 8px;border-radius:9999px;
      font-size:.75rem;font-weight:600
    }
    .status-badge.open{background:var(--green-light);color:var(--green)}
    .status-badge.processing{background:var(--blue-light);color:var(--blue)}
    .status-badge.closed{background:#fffbeb;color:#d97706}
    .status-badge.consumed{background:var(--green-light);color:var(--green)}
    .status-badge.expired{background:var(--gray-100);color:var(--gray-500)}

    pre{background:var(--gray-900);color:var(--gray-100);padding:16px;border-radius:var(--radius-sm);overflow-x:auto;margin:12px 0;line-height:1.5;font-size:.8125rem}
    pre .cm{color:#94a3b8}
    pre .hl{color:#fbbf24}
    pre .str{color:#34d399}
    pre .kwd{color:#818cf8}

    .example-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:12px 0}
    @media(max-width:960px){.example-grid{grid-template-columns:1fr}}

    .card{background:var(--white);border:1px solid var(--gray-200);border-radius:var(--radius);padding:20px}
    .card h4{font-size:.8125rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--gray-500);margin-bottom:8px;margin-top:0}
    .card code{font-size:.8125rem;color:var(--gray-100)}

    .note{
      background:var(--gray-100);border-left:4px solid var(--black);
      border-radius:0 var(--radius-sm) var(--radius-sm) 0;padding:16px;margin:16px 0
    }
    .note strong{color:var(--black)}
    .note code{font-size:.8125rem;background:var(--white);padding:1px 4px;border-radius:2px}

    .diagram{
      display:flex;flex-direction:column;align-items:center;gap:0;margin:24px 0;overflow-x:auto;padding:8px 0
    }
    .diagram-row{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap}
    .diagram-box{
      background:var(--white);border:2px solid var(--gray-300);border-radius:var(--radius);
      padding:12px 16px;font-size:.8125rem;text-align:center;min-width:100px;max-width:160px;
      font-weight:500;color:var(--gray-800);line-height:1.3
    }
    .diagram-box.highlight{border-color:var(--black);background:var(--gray-100)}
    .diagram-box.green{border-color:var(--green);background:var(--green-light);color:var(--green)}
    .diagram-box.blue{border-color:var(--blue);background:var(--blue-light);color:var(--blue)}
    .diagram-box.amber{border-color:var(--amber);background:var(--amber-light);color:var(--amber)}
    .diagram-box.small{padding:8px 12px;min-width:80px;font-size:.75rem}
    .diagram-arrow{font-size:1.25rem;color:var(--gray-400);flex-shrink:0}
    .diagram-label{font-size:.6875rem;color:var(--gray-500);text-align:center;margin-top:2px}
    .diagram-branch{display:flex;flex-direction:column;align-items:center;gap:6px}
    .diagram-sub{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;padding:4px 0}

    .text-muted{color:var(--gray-400);font-size:.875rem}
    .mt-16{margin-top:16px}
    .mt-24{margin-top:24px}
    .mb-8{margin-bottom:8px}
    .mb-16{margin-bottom:16px}

    @media(max-width:900px){
      .sidebar{display:none}
      .main-content{padding:24px 16px}
    }
    @media(max-width:768px){
      .header-content{padding:0 16px}
    }
  </style>
</head>
<body>
  <div class="layout">
    <header class="header">
      <div class="header-content">
        <h1 class="header-title" onclick="location.href='/'">Message Buffer Manager</h1>
        <nav class="nav">
          <a href="/" class="nav-link">Buffers</a>
          <a href="/docs" class="nav-link active">Documentação</a>
        </nav>
      </div>
    </header>
    <div class="wrapper">
      <aside class="sidebar">
        <details>
          <summary><span class="sidebar-label">Documentação</span></summary>
          <div class="sidebar-links">
            <a href="#desenvolvedor" class="sidebar-link"><span class="ico">👤</span> Desenvolvedor</a>
            <a href="#visao-geral" class="sidebar-link"><span class="ico">📖</span> Visão Geral</a>
            <a href="#logica" class="sidebar-link"><span class="ico">🔄</span> Lógica de Funcionamento</a>
            <a href="#mapa-mental" class="sidebar-link"><span class="ico">🧠</span> Mapa Mental</a>
            <a href="#fila-espera" class="sidebar-link"><span class="ico">⏳</span> Fila de Espera</a>
            <a href="#webhook" class="sidebar-link"><span class="ico">🔗</span> Payload do Webhook</a>
            <a href="#confirmacao" class="sidebar-link"><span class="ico">✅</span> Confirmação de Consumo</a>
            <a href="#tipos" class="sidebar-link"><span class="ico">📦</span> Tipos de Conteúdo</a>
            <a href="#exemplos" class="sidebar-link"><span class="ico">📝</span> Exemplos</a>
            <a href="#respostas" class="sidebar-link"><span class="ico">✅</span> Respostas</a>
          </div>
        </details>
        <details>
          <summary><span class="sidebar-label">API Reference</span></summary>
          <div class="sidebar-links">
            <a href="#api-ingest" class="sidebar-link"><span class="ico">📤</span> Ingerir Mensagem</a>
            <a href="#api-pending" class="sidebar-link"><span class="ico">📋</span> Listar Janelas</a>
            <a href="#api-confirm" class="sidebar-link"><span class="ico">✅</span> Confirmar Consumo</a>
          </div>
        </details>
      </aside>
      <main class="main-content">
        <div class="page-header">
          <h2>Documentação da API</h2>
        </div>

        <div class="detail-card" id="desenvolvedor">
          <h3>Desenvolvido por</h3>
          <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
            <img src="${baseUrl}/public/foto.jpeg" alt="Armando Castro" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid var(--gray-200)">
            <div>
              <p style="font-size:1.125rem;font-weight:700;color:var(--black)">Armando Castro de Sousa Junior</p>
              <p style="color:var(--gray-500);font-size:.875rem;margin-top:4px">Criador do Message Buffer Manager</p>
              <a href="https://github.com/armandocastrodesousajunior/Message-Buffer" target="_blank" style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;color:var(--gray-600);font-size:.875rem;text-decoration:underline">github.com/armandocastrodesousajunior/Message-Buffer</a>
            </div>
          </div>
          <div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--gray-200)">
            <h4 style="margin-bottom:8px">Contribua com o projeto</h4>
            <p style="color:var(--gray-600);font-size:.875rem;margin-bottom:16px">
              Se você gostou do projeto e quer ajudar, faça um PIX para:
            </p>
            <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
              <img src="${baseUrl}/public/qrcode-pix.png" alt="PIX QR Code" style="width:150px;height:150px;border-radius:var(--radius-sm);border:1px solid var(--gray-200)">
              <div>
                <p style="font-size:.875rem;font-weight:600;color:var(--black)">Chave PIX</p>
                <code style="display:inline-block;margin-top:4px;padding:8px 12px;background:var(--gray-100);border-radius:var(--radius-sm);font-size:.875rem;color:var(--gray-800);word-break:break-all">armandocastrodesousajunior@gmail.com</code>
              </div>
            </div>
          </div>
        </div>

        <div class="detail-card" id="visao-geral">
          <h3>O que é o Message Buffer?</h3>
          <p>
            O <strong>Message Buffer</strong> é um sistema de <strong>bufferização de mensagens</strong> com
            <strong>janelamento temporal</strong>. Ele recebe mensagens via API REST, as agrupa por um identificador
            dentro de uma janela de tempo configurável e, quando a janela expira, entrega <strong>todas as mensagens
            daquele grupo em um único lote</strong> para um webhook.
          </p>
          <p>
            Isso é útil para cenários onde você quer <strong>reduzir o número de chamadas</strong> ao seu sistema de
            destino, agrupando eventos relacionados que ocorrem em um curto intervalo de tempo.
          </p>
          <div class="note">
            <strong>Exemplo prático:</strong> Se você tem um sistema de eventos do usuário e 10 eventos ocorrem em 30
            segundos para o mesmo usuário, em vez de 10 chamadas ao webhook, o Message Buffer envia <strong>1
            chamada</strong> com os 10 eventos agrupados.
          </div>
        </div>

        <div class="detail-card" id="logica">
          <h3>Lógica de Funcionamento</h3>
          <p>
            O Message Buffer é composto por <strong>4 componentes principais</strong> que trabalham juntos:
          </p>

          <h4>1. Buffer</h4>
          <p>
            É a configuração base. Cada buffer possui um <strong>nome</strong>, um <strong>tempo de janela</strong>
            (<code>window_time</code> em segundos), uma <strong>URL de webhook</strong> para onde as mensagens serão
            enviadas, e um limite opcional de <strong>janelas concorrentes</strong> (<code>max_concurrent_windows</code>).
            Cada buffer tem uma <strong>API Key</strong> única gerada automaticamente.
          </p>

          <h4>2. Janela (Window)</h4>
          <p>
            Uma janela é criada quando a primeira mensagem de um determinado <strong>identificador</strong> chega.
            Cada janela tem um ciclo de vida de 4 estados:
          </p>
          <table>
            <thead><tr><th>Estado</th><th>Descrição</th></tr></thead>
            <tbody>
              <tr><td><span class="status-badge open">open</span></td><td>Janela aberta recebendo mensagens. Um timer interno conta o <code>window_time</code></td></tr>
              <tr><td><span class="status-badge processing">processing</span></td><td>Janela expirou. As mensagens estão sendo agrupadas e enviadas ao webhook</td></tr>
              <tr><td><span class="status-badge closed">closed</span></td><td>Webhook chamado. Aguardando confirmação de consumo (se habilitado)</td></tr>
              <tr><td><span class="status-badge consumed">consumed</span></td><td>Consumo confirmado. Ciclo encerrado.</td></tr>
              <tr><td><span class="status-badge expired">expired</span></td><td>Tempo de confirmação expirou. Identificador desbloqueado automaticamente.</td></tr>
            </tbody>
          </table>
          <p>
            Enquanto a janela está <strong>open</strong>, todas as mensagens que chegam com o mesmo
            <code>identifier</code> são adicionadas a ela. Quando o timer dispara, a janela transita para
            <strong>processing</strong>, as mensagens são consolidadas em um payload JSON e enviadas via POST para
            o webhook configurado. Após a resposta (sucesso ou erro), a janela é marcada como <strong>closed</strong>.
          </p>

          <h4>3. Mensagens</h4>
          <p>
            Cada mensagem possui um <strong>identificador</strong> (para agrupamento), um <strong>conteúdo</strong>
            (que pode ser string, number, boolean, objeto JSON ou array) e um <strong>tipo</strong> que define como
            o conteúdo deve ser interpretado. As mensagens são armazenadas com timestamp de recebimento.
          </p>

          <h4>4. Fila de Espera (Waiting Queue)</h4>
          <p>
            Para evitar sobrecarga, cada buffer pode ter um <strong>limite máximo de janelas concorrentes</strong>
            (<code>max_concurrent_windows</code>). Se esse limite for atingido, as novas mensagens não são perdidas
            — elas vão para uma <strong>fila de espera</strong> no banco de dados. Quando uma janela é fechada, o
            sistema automaticamente verifica se há mensagens na fila e cria uma nova janela para processá-las.
          </p>
          <p>Se o limite for <code>null</code> (ilimitado), todas as mensagens são processadas imediatamente.</p>
        </div>

        <div class="detail-card" id="mapa-mental">
          <h3>Mapa Mental do Fluxo</h3>
          <p>Veja abaixo o fluxo completo de uma mensagem desde o envio até a entrega ao webhook:</p>

          <div class="diagram">
            <div class="diagram-row">
              <div class="diagram-box highlight">Cliente<br><span style="font-weight:400;font-size:.75rem;color:var(--gray-500)">Envia mensagem</span></div>
              <div class="diagram-arrow">→</div>
              <div class="diagram-box blue">POST /api/ingest<br><span style="font-weight:400;font-size:.75rem;color:var(--gray-500)">:bufferId</span></div>
              <div class="diagram-arrow">→</div>
              <div class="diagram-box">Valida<br>API Key</div>
              <div class="diagram-arrow" style="color:var(--red)">✕</div>
              <div class="diagram-box small" style="border-color:var(--red);color:var(--red)">401 / 404</div>
            </div>
            <div class="diagram-label">Validação da requisição</div>

            <div style="margin:8px 0;font-size:1.5rem;color:var(--gray-300)">↓</div>
            <div class="diagram-label" style="font-weight:600;color:var(--gray-700)">Requisição válida</div>

            <div class="diagram-row" style="gap:16px">
              <div class="diagram-box green">Janela aberta<br>existe para este<br>identifier?</div>
              <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
                <div style="display:flex;align-items:center;gap:8px">
                  <span class="diagram-arrow">→</span>
                  <span style="font-size:.75rem;font-weight:600;color:var(--green)">SIM</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                  <span class="diagram-arrow">→</span>
                  <span style="font-size:.75rem;font-weight:600;color:var(--blue)">NÃO</span>
                </div>
              </div>
              <div style="display:flex;flex-direction:column;gap:10px">
                <div class="diagram-box small" style="border-color:var(--green);color:var(--green);background:var(--green-light)">Adiciona mensagem<br>à janela existente</div>

                <div class="diagram-sub">
                  <div class="diagram-box small">Conta janelas<br>concorrentes</div>
                  <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
                    <div style="display:flex;align-items:center;gap:6px">
                      <span class="diagram-arrow" style="font-size:1rem">→</span>
                      <span style="font-size:.6875rem;font-weight:600;color:var(--green)">ABAIXO DO LIMITE</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px">
                      <span class="diagram-arrow" style="font-size:1rem">→</span>
                      <span style="font-size:.6875rem;font-weight:600;color:var(--amber)">NO LIMITE</span>
                    </div>
                  </div>
                  <div style="display:flex;flex-direction:column;gap:6px">
                    <div class="diagram-box small green">Cria nova janela<br>+ inicia timer</div>
                    <div class="diagram-box small amber">Enfileira mensagem<br>na fila de espera</div>
                  </div>
                </div>
              </div>
            </div>

            <div style="margin:8px 0;font-size:1.5rem;color:var(--gray-300)">↓</div>
            <div class="diagram-label" style="font-weight:600;color:var(--gray-700)">Timer expira (window_time)</div>

            <div class="diagram-row">
              <div class="diagram-box highlight">Janela → processing<br>Agrupa mensagens</div>
              <div class="diagram-arrow">→</div>
              <div class="diagram-box blue">POST para<br>webhook_url</div>
              <div class="diagram-arrow">→</div>
              <div class="diagram-box" style="min-width:120px">Registra log<br>da entrega</div>
              <div class="diagram-arrow">→</div>
              <div class="diagram-box small green">Janela → closed<br>✓</div>
            </div>

            <div style="margin:8px 0;font-size:1.5rem;color:var(--gray-300)">↓</div>
            <div class="diagram-label" style="font-weight:600;color:var(--gray-700)">Pós-fechamento</div>

            <div class="diagram-row">
              <div class="diagram-box amber">Fila de espera<br>tem mensagens?</div>
              <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
                <div style="display:flex;align-items:center;gap:6px">
                  <span class="diagram-arrow">→</span>
                  <span style="font-size:.75rem;font-weight:600;color:var(--green)">SIM</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px">
                  <span class="diagram-arrow">→</span>
                  <span style="font-size:.75rem;font-weight:600;color:var(--gray-400)">NÃO</span>
                </div>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px">
                <div class="diagram-box small green">Desenfileira TODAS as<br>msgs do identifier<br>+ cria única janela</div>
                <div class="diagram-box small" style="border-color:var(--gray-300);color:var(--gray-500)">Fim</div>
              </div>
            </div>
          </div>
        </div>

        <div class="detail-card" id="fila-espera">
          <h3>Fila de Espera (Waiting Queue)</h3>
          <p>
            A fila de espera é um dos mecanismos mais importantes do Message Buffer. Ela garante que nenhuma
            mensagem seja perdida quando o limite de janelas concorrentes é atingido.
          </p>
          <p><strong>Como funciona na prática:</strong></p>
          <ol>
            <li>Um buffer é configurado com <code>max_concurrent_windows: 3</code></li>
            <li>3 janelas já estão abertas para 3 identifiers diferentes</li>
            <li>Uma 4ª mensagem com um novo identifier chega → ela vai para a <strong>fila de espera</strong></li>
            <li>A resposta tem <code>queued: true</code> e <code>window_id: ""</code></li>
            <li>Assim que uma das 3 janelas for fechada, o sistema pega <strong>TODAS as mensagens da fila com aquele identificador</strong> e cria uma única janela com todas elas</li>
          </ol>

          <h4>Quando o servidor reinicia?</h4>
          <p>
            Tanto as janelas abertas quanto a fila de espera são armazenadas no banco de dados SQLite.
            Ao reiniciar, o servidor <strong>recupera automaticamente</strong> todas as janelas que estavam
            abertas e reativa os timers. Se alguma janela já deveria ter expirado, ela é processada imediatamente.
          </p>
          <div class="note">
            <strong>Importante:</strong> Os timers são mantidos em memória. Se o servidor cair, o tempo restante
            das janelas é perdido, mas na reinicialização o sistema verifica o <code>expires_at</code> de cada
            janela e dispara imediatamente as que já passaram do prazo.
          </div>
        </div>

        <div class="detail-card" id="webhook">
          <h3>Payload enviado ao webhook</h3>
          <p>
            Quando a janela expira, o buffer envia um POST para a <code>webhook_url</code> configurada
            com o seguinte payload:
          </p>
          <pre>{
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
}</pre>
          <p>
            O webhook tem <strong>30 segundos</strong> para responder. Se a requisição falhar (timeout, erro de
            rede, status 5xx), o erro é registrado nos logs, mas a janela ainda é fechada. O sistema não faz
            retentativas automáticas.
          </p>
        </div>

        <div class="detail-card" id="confirmacao">
          <h3>Confirmação de Consumo</h3>
          <p>
            Quando um buffer possui a opção <strong>"Requerer confirmação de consumo"</strong> ativada,
            as janelas passam pelo estado <span class="status-badge closed">closed</span> após o envio ao webhook
            e só transitam para <span class="status-badge consumed">consumed</span> quando o consumo é confirmado.
          </p>

          <h4>Formas de confirmar</h4>
          <ol>
            <li><strong>Automática (retorno 200):</strong> Se o webhook de destino responder com HTTP <code>200</code>, a janela é marcada como <code>consumed</code> automaticamente. Retorno <code>202</code> mantém como <code>closed</code>.</li>
            <li><strong>Timer de expiração:</strong> Se um <code>consumption_timeout</code> foi definido, ao expirar sem confirmação, o sistema considera automaticamente como <code>consumed</code>.</li>
            <li><strong>Rota da API:</strong> Use a rota <code>POST /api/confirm/:windowId</code> com o header <code>X-Api-Key</code> para confirmar manualmente.</li>
            <li><strong>Interface:</strong> Na tela de detalhes do buffer, clique em "Confirmar Consumo" nas janelas pendentes.</li>
          </ol>

          <h4>Bloqueio por identificador</h4>
          <p>
            Enquanto uma janela do identificador <strong>A</strong> estiver <code>closed</code> (não consumida),
            novas mensagens do identificador <strong>A</strong> são enfileiradas. Os demais identificadores não
            são afetados — apenas <strong>A</strong> fica bloqueado até que sua janela anterior seja confirmada.
          </p>
        </div>

        <div class="detail-card" id="tipos">
          <h3>Tipos de Conteúdo</h3>
          <p>O campo <code>type</code> define como o <code>content</code> será interpretado e armazenado. Veja todos os formatos aceitos:</p>

          <div class="example-grid">
            <div class="card">
              <h4><span class="type-badge string">string</span> Texto</h4>
              <pre>{
  "identifier": "user-123",
  "type": "string",
  "content": "Olá, mundo!"
}</pre>
            </div>
            <div class="card">
              <h4><span class="type-badge number">number</span> Número</h4>
              <pre>{
  "identifier": "metric-456",
  "type": "number",
  "content": 42
}</pre>
            </div>
            <div class="card">
              <h4><span class="type-badge boolean">boolean</span> Booleano</h4>
              <pre>{
  "identifier": "flag-789",
  "type": "boolean",
  "content": true
}</pre>
            </div>
            <div class="card">
              <h4><span class="type-badge json">json</span> Objeto</h4>
              <pre>{
  "identifier": "order-001",
  "type": "json",
  "content": {
    "id": 1,
    "produto": "Camiseta",
    "qtd": 3,
    "preco": 59.90
  }
}</pre>
            </div>
            <div class="card">
              <h4><span class="type-badge json">json</span> Array</h4>
              <pre>{
  "identifier": "cart-002",
  "type": "json",
  "content": [
    {"item": "Camiseta", "qty": 2},
    {"item": "Calça", "qty": 1}
  ]
}</pre>
            </div>
            <div class="card">
              <h4><span class="type-badge json">json</span> Array misto</h4>
              <pre>{
  "identifier": "log-003",
  "type": "json",
  "content": [
    42, "texto",
    true,
    {"chave": "valor"}
  ]
}</pre>
            </div>
          </div>
        </div>

        <div class="detail-card" id="exemplos">
          <h3>Exemplo completo</h3>
          <h4>Requisição com curl</h4>
          <pre><span class="cm"># curl</span>
curl -X POST ${baseUrl}/api/ingest/SEU-BUFFER-ID \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: SUA-API-KEY" \\
  -d '{
    "identifier": "sessao-usuario-123",
    "type": "json",
    "content": {
      "evento": "clique",
      "elemento": "botao-comprar",
      "timestamp": 1715000000
    }
  }'</pre>

          <h4 class="mt-24">Requisição com fetch (JavaScript)</h4>
          <pre><span class="cm">// JavaScript (navegador / Node 18+)</span>
const response = await fetch('<span class="str">${baseUrl}/api/ingest/SEU-BUFFER-ID</span>', {
  method: '<span class="str">POST</span>',
  headers: {
    '<span class="str">Content-Type</span>': '<span class="str">application/json</span>',
    '<span class="str">X-Api-Key</span>': '<span class="str">SUA-API-KEY</span>'
  },
  body: JSON.stringify({
    identifier: '<span class="str">sessao-usuario-123</span>',
    type: '<span class="str">json</span>',
    content: {
      evento: '<span class="str">clique</span>',
      elemento: '<span class="str">botao-comprar</span>'
    }
  })
});
const data = await response.json();
console.log(data);</pre>

          <h4 class="mt-24">Requisição com axios</h4>
          <pre><span class="cm">// axios</span>
const axios = require('<span class="str">axios</span>');
const response = await axios.post(
  '<span class="str">${baseUrl}/api/ingest/SEU-BUFFER-ID</span>',
  {
    identifier: '<span class="str">sessao-usuario-123</span>',
    type: '<span class="str">json</span>',
    content: { evento: '<span class="str">clique</span>' }
  },
  {
    headers: { '<span class="str">X-Api-Key</span>': '<span class="str">SUA-API-KEY</span>' }
  }
);
console.log(response.data);</pre>
        </div>

        <div class="detail-card" id="respostas">
          <h3>Respostas da API</h3>
          <table>
            <thead><tr><th>Código</th><th>Significado</th></tr></thead>
            <tbody>
              <tr><td><strong>200</strong></td><td>Mensagem aceita e alocada em uma janela (ou fila de espera)</td></tr>
              <tr><td><strong>400</strong></td><td>Campos obrigatórios ausentes ou <code>type</code> inválido</td></tr>
              <tr><td><strong>401</strong></td><td>Header <code>X-Api-Key</code> ausente</td></tr>
              <tr><td><strong>404</strong></td><td>Buffer não encontrado ou API Key inválida</td></tr>
            </tbody>
          </table>

          <h4>Campos da resposta (200)</h4>
          <table>
            <thead><tr><th>Campo</th><th>Tipo</th><th>Descrição</th></tr></thead>
            <tbody>
              <tr><td><code>accepted</code></td><td><code>boolean</code></td><td>Sempre <code>true</code> quando a mensagem é válida</td></tr>
              <tr><td><code>window_id</code></td><td><code>string</code></td><td>ID da janela onde a mensagem foi alocada (vazio se <code>queued: true</code>)</td></tr>
              <tr><td><code>queued</code></td><td><code>boolean</code></td><td><code>true</code> se o limite de janelas concorrentes foi atingido e a mensagem foi para a fila de espera</td></tr>
              <tr><td><code>queue_position</code></td><td><code>number</code></td><td>Posição na fila de espera (presente apenas quando <code>queued: true</code>)</td></tr>
              <tr><td><code>blocked</code></td><td><code>boolean</code></td><td><code>true</code> se o identificador possui uma janela anterior aguardando confirmação de consumo</td></tr>
            </tbody>
          </table>
        </div>

        <div class="detail-card section-divider">
          <div style="text-align:center;padding:8px 0">
            <span style="display:inline-block;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--gray-400);background:var(--gray-50);padding:4px 20px;border-radius:9999px;border:1px solid var(--gray-200)">API Reference</span>
          </div>
        </div>

        <div class="detail-card" id="api-ingest">
          <h3>📤 Ingerir Mensagem</h3>
          <p>Envia uma mensagem para o buffer. A mensagem é alocada em uma janela (ou enfileirada se o limite de janelas concorrentes foi atingido).</p>

          <div class="endpoint-box">
            <code><span class="method-badge" style="margin-right:8px">POST</span> ${baseUrl}/api/ingest/:bufferId</code>
          </div>

          <h4>Cabeçalhos</h4>
          <table>
            <thead><tr><th>Header</th><th>Obrigatório</th><th>Descrição</th></tr></thead>
            <tbody>
              <tr><td><code>X-Api-Key</code></td><td>Sim</td><td>Chave de API do buffer (gerada na criação)</td></tr>
              <tr><td><code>Content-Type</code></td><td>Sim</td><td><code>application/json</code></td></tr>
            </tbody>
          </table>

          <h4>Corpo da requisição</h4>
          <table>
            <thead><tr><th>Campo</th><th>Tipo</th><th>Obrigatório</th><th>Descrição</th></tr></thead>
            <tbody>
              <tr><td><code>identifier</code></td><td><code>string</code></td><td>Sim</td><td>Identificador para agrupar mensagens na mesma janela</td></tr>
              <tr><td><code>type</code></td><td><code>string</code></td><td>Sim</td><td>Tipo do conteúdo: <code>string</code>, <code>number</code>, <code>boolean</code> ou <code>json</code></td></tr>
              <tr><td><code>content</code></td><td><code>any</code></td><td>Sim</td><td>Conteúdo da mensagem (string, number, boolean, objeto ou array)</td></tr>
            </tbody>
          </table>

          <h4>Exemplo com curl</h4>
          <pre><span class="cm"># curl</span>
curl -X POST ${baseUrl}/api/ingest/SEU-BUFFER-ID \\
  -H "<span class="str">Content-Type: application/json</span>" \\
  -H "<span class="str">X-Api-Key: SUA-API-KEY</span>" \\
  -d '{
    "<span class="hl">identifier</span>": "<span class="str">sessao-usuario-123</span>",
    "<span class="hl">type</span>": "<span class="str">json</span>",
    "<span class="hl">content</span>": {
      "evento": "clique",
      "elemento": "botao-comprar"
    }
  }'</pre>

          <h4>Resposta (200) — alocada na janela</h4>
          <pre>{
  "accepted": true,
  "window_id": "550e8400-e29b-41d4-a716-446655440000",
  "queued": false,
  "blocked": false
}</pre>

          <h4>Resposta (200) — enfileirada (limite de janelas)</h4>
          <pre>{
  "accepted": true,
  "window_id": "",
  "queued": true,
  "queue_position": 3,
  "blocked": false
}</pre>

          <h4>Resposta (200) — enfileirada (identificador bloqueado)</h4>
          <pre>{
  "accepted": true,
  "window_id": "",
  "queued": true,
  "queue_position": 2,
  "blocked": true
}</pre>

          <h4>Respostas de erro</h4>
          <table>
            <thead><tr><th>Código</th><th>Significado</th></tr></thead>
            <tbody>
              <tr><td><strong>400</strong></td><td>Campos obrigatórios ausentes ou <code>type</code> inválido</td></tr>
              <tr><td><strong>401</strong></td><td>Header <code>X-Api-Key</code> ausente</td></tr>
              <tr><td><strong>404</strong></td><td>Buffer não encontrado ou API Key inválida</td></tr>
            </tbody>
          </table>
        </div>

        <div class="detail-card" id="api-pending">
          <h3>📋 Listar Janelas</h3>
          <p>Retorna todas as janelas de um buffer. Opcionalmente filtra por status para consultar apenas janelas abertas, em processamento, pendentes, consumidas ou expiradas.</p>

          <div class="endpoint-box">
            <code><span class="method-badge" style="margin-right:8px">GET</span> ${baseUrl}/api/windows?bufferId=SEU-BUFFER-ID<span style="color:var(--gray-500)">&amp;status=closed</span></code>
          </div>

          <h4>Cabeçalhos</h4>
          <table>
            <thead><tr><th>Header</th><th>Obrigatório</th><th>Descrição</th></tr></thead>
            <tbody>
              <tr><td><code>X-Api-Key</code></td><td>Sim</td><td>Chave de API do buffer</td></tr>
            </tbody>
          </table>

          <h4>Parâmetros de query</h4>
          <table>
            <thead><tr><th>Parâmetro</th><th>Tipo</th><th>Obrigatório</th><th>Descrição</th></tr></thead>
            <tbody>
              <tr><td><code>bufferId</code></td><td><code>string</code></td><td>Sim</td><td>ID do buffer (UUID) para consultar as janelas</td></tr>
              <tr><td><code>status</code></td><td><code>string</code></td><td>Não</td><td>Filtro opcional: <code>open</code>, <code>processing</code>, <code>closed</code>, <code>consumed</code> ou <code>expired</code></td></tr>
            </tbody>
          </table>

          <h4>Exemplo com curl</h4>
          <pre><span class="cm"># curl  todas as janelas</span>
curl "${baseUrl}/api/windows?bufferId=SEU-BUFFER-ID" \\
  -H "<span class="str">X-Api-Key: SUA-API-KEY</span>"

<span class="cm"># curl  filtrando por status</span>
curl "${baseUrl}/api/windows?bufferId=SEU-BUFFER-ID<span class="hl">&status=closed</span>" \\
  -H "<span class="str">X-Api-Key: SUA-API-KEY</span>"</pre>

          <h4>Resposta (200)</h4>
          <pre>{
  "windows": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "buffer_id": "uuid-do-buffer",
      "identifier": "sessao-usuario-123",
      "status": "closed",
      "expires_at": "2026-05-12T23:37:06.630Z",
      "created_at": "2026-05-12T23:36:51.590Z",
      "webhook_response_status": 200,
      "webhook_sent_at": "2026-05-12T23:37:07.000Z"
    }
  ]
}</pre>
          <p style="color:var(--gray-500);font-size:.875rem">Os campos <code>webhook_response_status</code> e <code>webhook_sent_at</code> trazem o status HTTP retornado pelo webhook de destino e o momento em que foi enviado (presentes apenas quando há log da janela).</p>
        </div>

        <div class="detail-card" id="api-confirm">
          <h3>✅ Confirmar Consumo</h3>
          <p>Confirma manualmente o consumo de uma janela com status <span class="status-badge closed">closed</span>, transitando-a para <span class="status-badge consumed">consumed</span>. Isso desbloqueia o identificador para novas janelas (quando <code>require_consumption</code> está ativo).</p>

          <div class="endpoint-box">
            <code><span class="method-badge" style="margin-right:8px">POST</span> ${baseUrl}/api/confirm/:windowId</code>
          </div>

          <h4>Cabeçalhos</h4>
          <table>
            <thead><tr><th>Header</th><th>Obrigatório</th><th>Descrição</th></tr></thead>
            <tbody>
              <tr><td><code>X-Api-Key</code></td><td>Sim</td><td>API Key do buffer dono da janela</td></tr>
            </tbody>
          </table>

          <h4>Exemplo com curl</h4>
          <pre><span class="cm"># curl</span>
curl -X POST ${baseUrl}/api/confirm/ID-DA-JANELA \\
  -H "<span class="str">X-Api-Key: SUA-API-KEY</span>"</pre>

          <h4>Resposta (200)</h4>
          <pre>{
  "status": "consumed"
}</pre>

          <h4>Respostas de erro</h4>
          <table>
            <thead><tr><th>Código</th><th>Significado</th></tr></thead>
            <tbody>
              <tr><td><strong>400</strong></td><td>Janela não está com status <code>closed</code></td></tr>
              <tr><td><strong>401</strong></td><td>Header <code>X-Api-Key</code> ausente</td></tr>
              <tr><td><strong>404</strong></td><td>Janela não encontrada ou API Key inválida</td></tr>
            </tbody>
          </table>
        </div>

        <div style="text-align:center;padding:24px 0;color:var(--gray-400);font-size:.875rem">
          Message Buffer Manager &mdash; Documentação completa da API de ingestão
        </div>
      </main>
    </div>
  </div>
</body>
</html>`);
  });

  return router;
}
