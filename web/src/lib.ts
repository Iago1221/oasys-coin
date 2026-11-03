import { useEffect, useState, useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Bloco, Transacao } from '../../shared/chain.ts';

// ---------- tipos que vêm da API ----------
export type TxPublica = Transacao & { apelidoDe: string | null; apelidoPara: string | null };
export type BlocoPublico = Omit<Bloco, 'transacoes'> & { transacoes: TxPublica[] };
export interface ResumoBloco {
  indice: number;
  hash: string;
  hashAnterior: string;
  timestamp: number;
  nonce: number;
  modo: 'cripto' | 'drex';
  validador: string | null;
  quantidade: number;
}
export interface Mineracao {
  indice: number;
  nonce: number;
  hash: string;
  dificuldade: number;
  inicio: number;
}
export interface EstadoGeral {
  modo: 'cripto' | 'drex';
  dificuldade: number;
  altura: number;
  participantes: number;
  intervaloBlocoSegundos: number;
  urlPublica: string | null;
  mineracao: Mineracao | null;
  mempool: TxPublica[];
  ultimosBlocos: ResumoBloco[];
  validadores: { nome: string; chavePublica: string }[];
  minerador: { nome: string; chavePublica: string };
  ranking: { apelido: string | null; transacoes: number }[];
}
export interface Participante {
  apelido: string;
  endereco: string;
  saldo: number;
  congelado: boolean;
}

// ---------- API ----------
export async function api<T>(caminho: string, opcoes?: { metodo?: string; corpo?: unknown; admin?: string }): Promise<T> {
  const headers: Record<string, string> = {};
  if (opcoes?.corpo !== undefined) headers['content-type'] = 'application/json';
  if (opcoes?.admin) headers['x-admin-token'] = opcoes.admin;
  const r = await fetch(`/api${caminho}`, {
    method: opcoes?.metodo ?? (opcoes?.corpo !== undefined ? 'POST' : 'GET'),
    headers,
    body: opcoes?.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(dados.erro ?? `Erro ${r.status}`);
  return dados as T;
}

/** Busca e refaz a busca quando chega um bloco novo ou algo muda. */
export function useApi<T>(caminho: string | null, dependeDoEstado = true) {
  const estado = useEstado();
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const gatilho = dependeDoEstado ? `${estado?.altura}-${estado?.mempool.length}-${estado?.modo}-${estado?.participantes}` : '';
  useEffect(() => {
    if (!caminho) return;
    let vivo = true;
    api<T>(caminho)
      .then((d) => vivo && (setDados(d), setErro(null)))
      .catch((e) => vivo && setErro(e.message));
    return () => {
      vivo = false;
    };
  }, [caminho, gatilho]);
  return { dados, erro };
}

// ---------- estado ao vivo via WebSocket ----------
let socket: Socket | null = null;
let estadoAtual: EstadoGeral | null = null;
let mineracaoAtual: Mineracao | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

function conectar() {
  if (socket) return;
  socket = io({ transports: ['websocket', 'polling'] });
  socket.on('estado', (e: EstadoGeral) => {
    estadoAtual = e;
    mineracaoAtual = e.mineracao;
    avisar();
  });
  socket.on('mineracao', (m: Mineracao) => {
    mineracaoAtual = m;
    avisar();
  });
}

function assinar(f: () => void) {
  conectar();
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

export const useEstado = () => useSyncExternalStore(assinar, () => estadoAtual);
export const useMineracao = () => useSyncExternalStore(assinar, () => mineracaoAtual);

// ---------- carteira no navegador ----------
const CHAVE = 'oasys.carteira';
export interface CarteiraLocal {
  apelido: string;
  chavePrivada: string;
  endereco: string;
}
export function lerCarteira(): CarteiraLocal | null {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as CarteiraLocal) : null;
  } catch {
    return null;
  }
}
export function salvarCarteira(c: CarteiraLocal | null) {
  try {
    if (c) localStorage.setItem(CHAVE, JSON.stringify(c));
    else localStorage.removeItem(CHAVE);
  } catch {
    /* modo privado: a carteira vive só nesta aba */
  }
}

// ---------- roteador por hash (#/caminho?x=y) ----------
function lerRota() {
  const bruto = location.hash.replace(/^#/, '') || '/';
  const [caminho, busca = ''] = bruto.split('?');
  return { caminho, params: new URLSearchParams(busca) };
}
export function useRota() {
  const [rota, setRota] = useState(lerRota);
  useEffect(() => {
    const f = () => {
      setRota(lerRota());
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return rota;
}
export const ir = (caminho: string) => (location.hash = caminho);

// ---------- formatação ----------
export const curto = (h: string, ini = 6, fim = 4) => (h.length > ini + fim + 1 ? `${h.slice(0, ini)}…${h.slice(-fim)}` : h);
export const dataHora = (ms: number) =>
  new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const hora = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR');
export const urlBase = () => `${location.origin}${location.pathname}`;
