// Simula colegas usando a OasysCoin: cria carteiras e manda transferências aleatórias.
// Uso: npm run simular -- [url] [carteiras] [rodadas]
// Ex.: npm run simular -- http://localhost:3000 30 3
import { chavePublicaDe, criarTransferencia, novaChavePrivada } from '../shared/chain.ts';

const [url = 'http://localhost:3000', nStr = '30', rodadasStr = '3'] = process.argv.slice(2);
const N = Number(nStr);
const RODADAS = Number(rodadasStr);
const NOMES = ['Ana', 'Bruno', 'Carla', 'Davi', 'Elisa', 'Fábio', 'Gabi', 'Heitor', 'Iara', 'João', 'Lia', 'Marcos', 'Nina', 'Otávio', 'Paula'];

async function post(caminho: string, corpo: unknown) {
  const r = await fetch(`${url}/api${caminho}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}` },
    body: JSON.stringify(corpo),
  });
  return { status: r.status, corpo: await r.json() };
}

const carteiras = Array.from({ length: N }, (_, i) => {
  const priv = novaChavePrivada();
  return { apelido: `${NOMES[i % NOMES.length]} ${Math.floor(Math.random() * 900) + 100}`, priv, end: chavePublicaDe(priv) };
});

const t0 = Date.now();
const cadastros = await Promise.all(carteiras.map((c) => post('/cadastro', { apelido: c.apelido, endereco: c.end })));
console.log(`cadastros: ${cadastros.filter((r) => r.status === 201).length}/${N} em ${Date.now() - t0} ms`);

let ok = 0;
let falhas = 0;
for (let r = 0; r < RODADAS; r++) {
  const res = await Promise.all(
    carteiras.map((c) => {
      let destino = carteiras[Math.floor(Math.random() * N)];
      if (destino === c) destino = carteiras[(carteiras.indexOf(c) + 1) % N];
      return post('/transacoes', criarTransferencia(c.priv, destino.end, 1 + Math.floor(Math.random() * 15), Math.random() < 0.3 ? 1 : 0));
    }),
  );
  ok += res.filter((x) => x.status === 201).length;
  falhas += res.filter((x) => x.status !== 201).length;
  for (const f of res.filter((x) => x.status !== 201).slice(0, 3)) console.log('  rejeitada:', f.status, f.corpo.erro);
}
console.log(`transferências aceitas: ${ok}, rejeitadas: ${falhas}, tempo total ${Date.now() - t0} ms`);
