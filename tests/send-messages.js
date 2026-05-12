const BASE_URL = 'http://localhost:3000';
const BUFFER_ID = 'a872fa6b-c439-4cae-b5b1-4724da37d086';
const API_KEY = '13ae07d8-b477-468b-a426-e23eef393f1c';

const types = ['string', 'number', 'boolean', 'json'];

function generateContent(type, index) {
  switch (type) {
    case 'string': return `Message number ${index}`;
    case 'number': return index * 100;
    case 'boolean': return index % 2 === 0;
    case 'json':
      return index % 2 === 0
        ? { id: index, value: `test-${index}`, active: true }
        : [index, 'test-value', true, { nested: index }];
  }
}

async function sendMessage(identifier, type, globalIndex) {
  const content = generateContent(type, globalIndex);
  const res = await fetch(`${BASE_URL}/api/ingest/${BUFFER_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
    body: JSON.stringify({ identifier, content, type }),
  });
  const data = await res.json();
  const qp = data.queue_position !== undefined ? ` | fila: #${data.queue_position}` : '';
  console.log(`[${String(globalIndex + 1).padStart(2, '0')}] id=${identifier} type=${type} => aceito=${data.accepted} janela=${data.window_id.slice(0,8)}... fila=${data.queued}${qp}`);
  return data;
}

async function main() {
  const identifiers = ['ident-1', 'ident-2', 'ident-3', 'ident-4', 'ident-5'];
  let globalIndex = 0;

  console.log('=== Enviando 5 mensagens para cada um dos 5 identificadores ===\n');

  for (const ident of identifiers) {
    console.log(`--- ${ident} ---`);
    for (let i = 0; i < 5; i++) {
      const type = types[globalIndex % types.length];
      await sendMessage(ident, type, globalIndex);
      globalIndex++;
    }
    console.log('');
  }

  const total = globalIndex;
  console.log(`\n✅ ${total} mensagens enviadas!`);
  console.log('Aguardando processamento das janelas...');
  console.log('Execute: node scripts/query-logs.js');
}

main().catch(console.error);
