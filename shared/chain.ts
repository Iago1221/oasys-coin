// Núcleo da OasysCoin: estruturas e regras compartilhadas entre o servidor e o navegador.
// Tudo aqui é determinístico e sem efeitos colaterais, para poder ser testado e reutilizado
// na tela de "adulteração" (que recalcula hashes no próprio celular).

import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

export const SIMBOLO = 'OAS';
export const ENDERECO_SISTEMA = 'SISTEMA'; // origem das emissões (faucet e recompensas)

export type TipoTransacao = 'transferencia' | 'faucet' | 'recompensa';

export interface Transacao {
  id: string; // SHA-256 dos dados da transação (sem a assinatura)
  tipo: TipoTransacao;
  de: string; // endereço (chave pública) de quem envia, ou SISTEMA
  para: string; // endereço de quem recebe
  valor: number; // inteiro, em OAS
  taxa: number; // inteiro, em OAS, vai para quem fecha o bloco
  timestamp: number; // ms desde 1970
  assinatura: string | null; // ECDSA secp256k1 (hex) sobre o id; null para emissões do sistema
}

export interface Validador {
  nome: string;
  assinatura: string; // assinatura do validador sobre o hash do bloco
  chavePublica: string;
}

export interface Bloco {
  indice: number;
  timestamp: number;
  hashAnterior: string;
  raizMerkle: string;
  nonce: number;
  dificuldade: number; // quantidade de zeros (hex) exigida no começo do hash
  modo: 'cripto' | 'drex';
  hash: string;
  validador: Validador | null; // só no modo DREX
  transacoes: Transacao[];
}

export const HASH_ZERO = '0'.repeat(64);

export function sha256Hex(texto: string): string {
  return bytesToHex(sha256(utf8ToBytes(texto)));
}

// ---------- Carteira ----------

export function novaChavePrivada(): string {
  return bytesToHex(secp256k1.utils.randomSecretKey());
}

export function chavePublicaDe(chavePrivada: string): string {
  return bytesToHex(secp256k1.getPublicKey(hexToBytes(chavePrivada), true));
}

export function enderecoValido(endereco: string): boolean {
  if (!/^0[23][0-9a-f]{64}$/.test(endereco)) return false;
  try {
    secp256k1.Point.fromHex(endereco);
    return true;
  } catch {
    return false;
  }
}

export function encurtar(hexStr: string, ini = 6, fim = 4): string {
  if (hexStr.length <= ini + fim + 1) return hexStr;
  return `${hexStr.slice(0, ini)}…${hexStr.slice(-fim)}`;
}

// ---------- Transações ----------

type DadosTransacao = Omit<Transacao, 'id' | 'assinatura'>;

// Ordem fixa dos campos: o hash precisa ser o mesmo no celular e no servidor.
export function serializarTransacao(t: DadosTransacao): string {
  return JSON.stringify([t.tipo, t.de, t.para, t.valor, t.taxa, t.timestamp]);
}

export function calcularIdTransacao(t: DadosTransacao): string {
  return sha256Hex(serializarTransacao(t));
}

export function criarTransferencia(
  chavePrivada: string,
  para: string,
  valor: number,
  taxa = 0,
  timestamp = Date.now(),
): Transacao {
  const dados: DadosTransacao = {
    tipo: 'transferencia',
    de: chavePublicaDe(chavePrivada),
    para,
    valor,
    taxa,
    timestamp,
  };
  const id = calcularIdTransacao(dados);
  const assinatura = bytesToHex(
    secp256k1.sign(hexToBytes(id), hexToBytes(chavePrivada), { prehash: false }),
  );
  return { ...dados, id, assinatura };
}

export function criarEmissao(tipo: 'faucet' | 'recompensa', para: string, valor: number, timestamp = Date.now()): Transacao {
  const dados: DadosTransacao = { tipo, de: ENDERECO_SISTEMA, para, valor, taxa: 0, timestamp };
  return { ...dados, id: calcularIdTransacao(dados), assinatura: null };
}

export function assinaturaValida(t: Transacao): boolean {
  if (t.tipo !== 'transferencia') return t.assinatura === null && t.de === ENDERECO_SISTEMA;
  if (!t.assinatura || !enderecoValido(t.de)) return false;
  try {
    return secp256k1.verify(hexToBytes(t.assinatura), hexToBytes(t.id), hexToBytes(t.de), { prehash: false });
  } catch {
    return false;
  }
}

/** Erros de formato e assinatura (não olha saldo). Retorna null se estiver tudo certo. */
export function problemaNaTransacao(t: Transacao): string | null {
  if (!Number.isSafeInteger(t.valor) || t.valor <= 0) return 'O valor precisa ser um número inteiro maior que zero.';
  if (!Number.isSafeInteger(t.taxa) || t.taxa < 0) return 'A taxa precisa ser um número inteiro (zero ou mais).';
  if (t.id !== calcularIdTransacao(t)) return 'O ID não confere com os dados: a transação foi alterada.';
  if (t.tipo === 'transferencia') {
    if (!enderecoValido(t.para)) return 'Endereço de destino inválido.';
    if (t.de === t.para) return 'Não dá para enviar para você mesmo.';
  }
  if (!assinaturaValida(t)) return 'Assinatura inválida.';
  return null;
}

// ---------- Blocos ----------

export function raizMerkle(ids: string[]): string {
  if (ids.length === 0) return sha256Hex('');
  let nivel = ids;
  while (nivel.length > 1) {
    const proximo: string[] = [];
    for (let i = 0; i < nivel.length; i += 2) {
      const esq = nivel[i];
      const dir = nivel[i + 1] ?? esq; // número ímpar: repete o último, como no Bitcoin
      proximo.push(sha256Hex(esq + dir));
    }
    nivel = proximo;
  }
  return nivel[0];
}

type CabecalhoBloco = Pick<Bloco, 'indice' | 'timestamp' | 'hashAnterior' | 'raizMerkle' | 'nonce' | 'dificuldade' | 'modo'>;

export function serializarCabecalho(b: CabecalhoBloco): string {
  return JSON.stringify([b.indice, b.timestamp, b.hashAnterior, b.raizMerkle, b.nonce, b.dificuldade, b.modo]);
}

export function calcularHashBloco(b: CabecalhoBloco): string {
  return sha256Hex(serializarCabecalho(b));
}

export function atendeDificuldade(hash: string, dificuldade: number): boolean {
  return hash.startsWith('0'.repeat(dificuldade));
}

/** Prova de trabalho: procura um nonce a partir de `inicio`, testando no máximo `tentativas`. */
export function minerarPasso(
  cab: CabecalhoBloco,
  inicio: number,
  tentativas: number,
): { encontrado: boolean; nonce: number; hash: string } {
  let hash = '';
  for (let nonce = inicio; nonce < inicio + tentativas; nonce++) {
    hash = calcularHashBloco({ ...cab, nonce });
    if (atendeDificuldade(hash, cab.dificuldade)) return { encontrado: true, nonce, hash };
  }
  return { encontrado: false, nonce: inicio + tentativas - 1, hash };
}

export function assinarComoValidador(hash: string, chavePrivada: string): string {
  return bytesToHex(secp256k1.sign(hexToBytes(hash), hexToBytes(chavePrivada), { prehash: false }));
}

export function assinaturaValidadorValida(b: Bloco): boolean {
  if (!b.validador) return false;
  try {
    return secp256k1.verify(hexToBytes(b.validador.assinatura), hexToBytes(b.hash), hexToBytes(b.validador.chavePublica), {
      prehash: false,
    });
  } catch {
    return false;
  }
}

export type ProblemaBloco =
  | 'hash'
  | 'merkle'
  | 'elo'
  | 'dificuldade'
  | 'validador'
  | 'transacao';

/**
 * Confere cada bloco da cadeia e devolve, por índice, os problemas encontrados.
 * Usada no servidor e na demo de adulteração do navegador.
 */
export function verificarCadeia(cadeia: Bloco[], validadoresAutorizados: string[] = []): ProblemaBloco[][] {
  return cadeia.map((b, i) => {
    const problemas: ProblemaBloco[] = [];
    if (b.transacoes.some((t) => problemaNaTransacao(t) !== null)) problemas.push('transacao');
    if (raizMerkle(b.transacoes.map((t) => t.id)) !== b.raizMerkle) problemas.push('merkle');
    if (calcularHashBloco(b) !== b.hash) problemas.push('hash');
    const anterior = i === 0 ? HASH_ZERO : cadeia[i - 1].hash;
    if (b.hashAnterior !== anterior) problemas.push('elo');
    if (b.modo === 'cripto' && !atendeDificuldade(b.hash, b.dificuldade)) problemas.push('dificuldade');
    if (b.modo === 'drex') {
      if (!assinaturaValidadorValida(b) || !validadoresAutorizados.includes(b.validador!.chavePublica))
        problemas.push('validador');
    }
    return problemas;
  });
}

/** Saldos a partir da cadeia (modelo de contas). */
export function calcularSaldos(cadeia: Bloco[]): Map<string, number> {
  const saldos = new Map<string, number>();
  const somar = (end: string, v: number) => saldos.set(end, (saldos.get(end) ?? 0) + v);
  for (const b of cadeia)
    for (const t of b.transacoes) {
      if (t.tipo === 'transferencia') somar(t.de, -(t.valor + t.taxa));
      somar(t.para, t.valor);
    }
  return saldos;
}
