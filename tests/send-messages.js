const BASE_URL = 'http://localhost:3000';
const BUFFER_ID = 'a872fa6b-c439-4cae-b5b1-4724da37d086';  // preencher
const API_KEY = '13ae07d8-b477-468b-a426-e23eef393f1c';    // preencher

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

async function sendMessage(identifier, type, index) {
  const content = generateContent(type, index);
  const res = await fetch(`${BASE_URL}/api/ingest/${BUFFER_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
    body: JSON.stringify({ identifier, content, type }),
  });
  const data = await res.json();
  console.log(`[${String(index + 1).padStart(2, '0')}] id=${identifier} type=${type} => ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  console.log('=== Enviando 10 mensagens com o mesmo identificador ===');
  for (let i = 0; i < 10; i++) {
    const type = types[i % types.length];
    await sendMessage('test-mesmo-id', type, i);
  }

  console.log('\n✅ Teste concluído!');
}

main().catch(console.error);
