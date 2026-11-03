import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { ErroValidacao, No, type EstadoPersistido } from './no.ts';
import type { Bloco, Transacao } from '../shared/chain.ts';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = (k: string, padrao: string) => process.env[k] ?? padrao;

const PORTA = Number(env('PORT', '3000'));
const DADOS = resolve(env('DATA_DIR', join(raiz, 'data')));
const ADMIN_TOKEN = env('ADMIN_TOKEN', 'oasys');
const INTERVALO_BLOCO_MS = Number(env('BLOCK_INTERVAL_SECONDS', '20')) * 1000;
const URL_PUBLICA = env('PUBLIC_URL', '');

const arquivoEstado = join(DADOS, 'estado.json');
mkdirSync(DADOS, { recursive: true });
const estadoSalvo: EstadoPersistido | undefined = existsSync(arquivoEstado)
  ? JSON.parse(readFileSync(arquivoEstado, 'utf8'))
  : undefined;

const no = new No(
  {
    dificuldade: Number(env('DIFFICULTY', '4')),
    hashesPorSegundo: Number(env('HASHES_PER_SECOND', '25000')),
    faucet: Number(env('FAUCET', '100')),
    recompensa: Number(env('BLOCK_REWARD', '10')),
    maxTransacoesPorBloco: 100,
  },
  estadoSalvo,
);

// ---------- persistência (gravação atômica, agrupada) ----------
let gravacaoPendente: NodeJS.Timeout | null = null;
function salvar() {
  if (gravacaoPendente) return;
  gravacaoPendente = setTimeout(() => {
    gravacaoPendente = null;
    const tmp = `${arquivoEstado}.tmp`;
    writeFileSync(tmp, JSON.stringify(no.exportar()));
    renameSync(tmp, arquivoEstado);
  }, 300);
}
if (!estadoSalvo) salvar();

// ---------- visões públicas (nunca expõem chaves privadas) ----------
const comApelidos = (t: Transacao) => ({ ...t, apelidoDe: no.apelido(t.de), apelidoPara: no.apelido(t.para) });
const blocoPublico = (b: Bloco) => ({ ...b, transacoes: b.transacoes.map(comApelidos) });
const resumoBloco = (b: Bloco) => ({
  indice: b.indice,
  hash: b.hash,
  hashAnterior: b.hashAnterior,
  timestamp: b.timestamp,
  nonce: b.nonce,
  modo: b.modo,
  validador: b.validador?.nome ?? null,
  quantidade: b.transacoes.length,
});

function estadoGeral() {
  return {
    modo: no.modo,
    dificuldade: no.config.dificuldade,
    altura: no.topo.indice,
    participantes: no.participantes.size,
    intervaloBlocoSegundos: INTERVALO_BLOCO_MS / 1000,
    urlPublica: URL_PUBLICA || null,
    mineracao: no.mineracao,
    mempool: no.mempool.map(comApelidos),
    ultimosBlocos: no.cadeia.slice(-12).map(resumoBloco),
    validadores: no.validadores.map((v) => ({ nome: v.nome, chavePublica: v.chavePublica })),
    minerador: { nome: no.minerador.nome, chavePublica: no.minerador.chavePublica },
    ranking: ranking(),
  };
}

function ranking() {
  const contagem = new Map<string, number>();
  for (const t of [...no.cadeia.flatMap((b) => b.transacoes), ...no.mempool])
    if (t.tipo === 'transferencia') contagem.set(t.de, (contagem.get(t.de) ?? 0) + 1);
  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([endereco, transacoes]) => ({ apelido: no.apelido(endereco), transacoes }));
}

// ---------- servidor ----------
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb' }));

// Limite simples contra abuso. Atenção: na faculdade, a turma toda costuma sair pelo MESMO IP
// (Wi-Fi com NAT), então o limite por IP é folgado e o de transações é por carteira.
function limite(maximo: number, janelaMs: number, chave: (req: Request) => string = (req) => req.ip ?? '?') {
  const hits = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction) => {
    const agora = Date.now();
    const ip = chave(req);
    const lista = (hits.get(ip) ?? []).filter((t) => agora - t < janelaMs);
    if (lista.length >= maximo) return res.status(429).json({ erro: 'Muitas tentativas. Espere alguns segundos.' });
    lista.push(agora);
    hits.set(ip, lista);
    next();
  };
}

function admin(req: Request, res: Response, next: NextFunction) {
  if (req.get('x-admin-token') !== ADMIN_TOKEN) return res.status(401).json({ erro: 'Senha de administrador incorreta.' });
  next();
}

const api = express.Router();

api.get('/estado', (_req, res) => res.json(estadoGeral()));

api.get('/cadeia', (_req, res) =>
  res.json({ cadeia: no.cadeia.map(blocoPublico), validadoresAutorizados: no.validadoresAutorizados }),
);

api.get('/blocos', (_req, res) => res.json(no.cadeia.map(resumoBloco).reverse()));

api.get('/blocos/:indice', (req, res) => {
  const b = no.cadeia[Number(req.params.indice)];
  if (!b) return res.status(404).json({ erro: 'Bloco não encontrado.' });
  res.json({ bloco: blocoPublico(b), proximoHashAnterior: no.cadeia[b.indice + 1]?.hashAnterior ?? null });
});

api.get('/transacoes/:id', (req, res) => {
  const id = req.params.id;
  for (const b of no.cadeia) {
    const t = b.transacoes.find((x) => x.id === id);
    if (t) return res.json({ transacao: comApelidos(t), bloco: b.indice, confirmacoes: no.topo.indice - b.indice + 1 });
  }
  const p = no.mempool.find((x) => x.id === id);
  if (p) return res.json({ transacao: comApelidos(p), bloco: null, confirmacoes: 0 });
  res.status(404).json({ erro: 'Transação não encontrada.' });
});

api.get('/participantes', (_req, res) => {
  const saldos = no.saldosConfirmados();
  res.json(
    [...no.participantes.values()]
      .map((p) => ({ ...p, saldo: saldos.get(p.endereco) ?? 0, congelado: no.congelados.has(p.endereco) }))
      .sort((a, b) => a.apelido.localeCompare(b.apelido, 'pt-BR')),
  );
});

api.get('/carteiras/:endereco', (req, res) => {
  const end = req.params.endereco;
  const p = no.participantes.get(end);
  if (!p) return res.status(404).json({ erro: 'Carteira não cadastrada.' });
  const historico = [
    ...no.mempool.filter((t) => t.de === end || t.para === end).map((t) => ({ ...comApelidos(t), bloco: null })),
    ...no.cadeia
      .flatMap((b) => b.transacoes.filter((t) => t.de === end || t.para === end).map((t) => ({ ...comApelidos(t), bloco: b.indice })))
      .reverse(),
  ];
  res.json({
    ...p,
    saldoConfirmado: no.saldoConfirmado(end),
    saldoDisponivel: no.saldoDisponivel(end),
    congelado: no.congelados.has(end),
    historico,
  });
});

api.post('/cadastro', limite(300, 60_000), (req, res) => {
  const p = no.cadastrar(req.body?.apelido, req.body?.endereco);
  salvar();
  res.status(201).json(p);
});

api.post('/transacoes', limite(1000, 60_000), limite(30, 60_000, (req) => String(req.body?.de)), (req, res) => {
  const t = no.enviar(req.body);
  salvar();
  res.status(201).json(comApelidos(t));
});

api.post('/admin/login', admin, (_req, res) => res.json({ ok: true }));
api.post('/admin/minerar', admin, async (_req, res) => {
  const b = await no.fecharBloco();
  res.json({ bloco: b?.indice ?? null });
});
api.post('/admin/modo', admin, (req, res) => {
  no.definirModo(req.body?.modo);
  salvar();
  res.json({ modo: no.modo });
});
api.post('/admin/congelar', admin, (req, res) => {
  no.congelar(req.body?.endereco, Boolean(req.body?.congelado));
  salvar();
  res.json({ ok: true });
});
api.post('/admin/reiniciar', admin, (_req, res) => {
  no.reiniciar();
  salvar();
  res.json({ ok: true });
});

app.use('/api', api);
app.use('/api', (_req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

const dist = join(raiz, 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist, { index: 'index.html', maxAge: '1h' }));
  app.get('/{*caminho}', (_req, res) => res.sendFile(join(dist, 'index.html')));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ErroValidacao) return res.status(400).json({ erro: err.message });
  console.error(err);
  res.status(500).json({ erro: 'Erro interno no nó.' });
});

const http = createServer(app);
const io = new Server(http, { cors: { origin: true } });

// avisa todo mundo (no máximo ~4x por segundo) quando algo muda
let avisoPendente = false;
no.on('mudou', () => {
  salvar();
  if (avisoPendente) return;
  avisoPendente = true;
  setTimeout(() => {
    avisoPendente = false;
    io.emit('estado', estadoGeral());
  }, 250);
});
no.on('mineracao', (m) => io.volatile.emit('mineracao', m));
no.on('bloco', (b: Bloco) => io.emit('bloco', resumoBloco(b)));

io.on('connection', (s) => s.emit('estado', estadoGeral()));

// fecha um bloco a cada intervalo, se houver transações esperando
setInterval(() => {
  no.fecharBloco().catch((e) => console.error(e));
}, INTERVALO_BLOCO_MS);

http.listen(PORTA, () => {
  console.log(`OasysCoin rodando em http://localhost:${PORTA} (altura ${no.topo.indice}, modo ${no.modo})`);
  if (ADMIN_TOKEN === 'oasys') console.warn('Aviso: defina ADMIN_TOKEN para proteger os controles do telão.');
});
