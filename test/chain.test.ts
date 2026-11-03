import { describe, expect, it } from 'vitest';
import {
  calcularHashBloco,
  calcularIdTransacao,
  criarTransferencia,
  novaChavePrivada,
  chavePublicaDe,
  problemaNaTransacao,
  raizMerkle,
  verificarCadeia,
} from '../shared/chain.ts';
import { No, ErroValidacao } from '../server/no.ts';

const config = { dificuldade: 2, hashesPorSegundo: 1_000_000, faucet: 100, recompensa: 10, maxTransacoesPorBloco: 50 };

function carteira() {
  const priv = novaChavePrivada();
  return { priv, end: chavePublicaDe(priv) };
}

describe('transações', () => {
  it('assinatura válida passa e adulteração é detectada', () => {
    const a = carteira();
    const b = carteira();
    const t = criarTransferencia(a.priv, b.end, 10);
    expect(problemaNaTransacao(t)).toBeNull();
    expect(problemaNaTransacao({ ...t, valor: 100 })).toMatch(/ID não confere/);
    const c = carteira();
    const forjada = criarTransferencia(c.priv, b.end, 10);
    expect(problemaNaTransacao({ ...forjada, de: a.end })).not.toBeNull();
  });

  it('raiz Merkle muda quando uma transação muda', () => {
    expect(raizMerkle(['a', 'b', 'c'])).not.toBe(raizMerkle(['a', 'b', 'd']));
  });
});

describe('nó', () => {
  it('cadastra, transfere, minera e valida a cadeia', async () => {
    const no = new No(config);
    const a = carteira();
    const b = carteira();
    no.cadastrar('Ana', a.end);
    no.cadastrar('Bruno', b.end);
    expect(no.saldoDisponivel(a.end)).toBe(100);
    no.enviar(criarTransferencia(a.priv, b.end, 30, 1));
    expect(no.saldoDisponivel(a.end)).toBe(69);
    const bloco = await no.fecharBloco();
    expect(bloco?.indice).toBe(1);
    expect(bloco?.hash.startsWith('00')).toBe(true);
    expect(no.saldoConfirmado(a.end)).toBe(69);
    expect(no.saldoConfirmado(b.end)).toBe(130);
    expect(no.saldoConfirmado(no.minerador.chavePublica)).toBe(11);
    expect(no.mempool).toHaveLength(0);
    expect(verificarCadeia(no.cadeia, no.validadoresAutorizados).flat()).toEqual([]);
  });

  it('bloqueia saldo insuficiente, repetição e apelido repetido', () => {
    const no = new No(config);
    const a = carteira();
    const b = carteira();
    no.cadastrar('Ana', a.end);
    no.cadastrar('Bruno', b.end);
    expect(() => no.enviar(criarTransferencia(a.priv, b.end, 101))).toThrow(/Saldo insuficiente/);
    const t = criarTransferencia(a.priv, b.end, 5);
    no.enviar(t);
    expect(() => no.enviar(t)).toThrow(/repetição/);
    expect(() => no.cadastrar('ana', carteira().end)).toThrow(ErroValidacao);
  });

  it('modo DREX: validador assina e carteira congelada não envia', async () => {
    const no = new No(config);
    const a = carteira();
    const b = carteira();
    no.cadastrar('Ana', a.end);
    no.cadastrar('Bruno', b.end);
    await no.fecharBloco();
    no.definirModo('drex');
    no.enviar(criarTransferencia(a.priv, b.end, 10));
    const bloco = await no.fecharBloco();
    expect(bloco?.validador?.nome).toBe('Banco Central do Brasil');
    expect(bloco?.dificuldade).toBe(0);
    no.congelar(a.end, true);
    expect(() => no.enviar(criarTransferencia(a.priv, b.end, 1))).toThrow(/congelada/);
    expect(verificarCadeia(no.cadeia, no.validadoresAutorizados).flat()).toEqual([]);
  });

  it('adulterar um bloco antigo quebra o elo com o seguinte', async () => {
    const no = new No(config);
    const a = carteira();
    const b = carteira();
    no.cadastrar('Ana', a.end);
    no.cadastrar('Bruno', b.end);
    await no.fecharBloco();
    no.enviar(criarTransferencia(a.priv, b.end, 10));
    await no.fecharBloco();
    const copia = structuredClone(no.cadeia);
    const tx = copia[2].transacoes[1];
    tx.valor = 1000;
    expect(verificarCadeia(copia)[2]).toEqual(['transacao']); // ID não confere
    tx.id = calcularIdTransacao(tx); // o fraudador recalcula o ID: a assinatura deixa de valer
    expect(verificarCadeia(copia)[2]).toEqual(['transacao', 'merkle']);
    copia[2].raizMerkle = raizMerkle(copia[2].transacoes.map((t) => t.id));
    expect(verificarCadeia(copia)[2]).toEqual(['transacao', 'hash']);
    copia[2].hash = calcularHashBloco(copia[2]);
    expect(verificarCadeia(copia)[2]).toContain('dificuldade');
  });

  it('reminerar um bloco adulterado quebra o elo com o seguinte', async () => {
    const no = new No(config);
    const a = carteira();
    const b = carteira();
    no.cadastrar('Ana', a.end);
    no.cadastrar('Bruno', b.end);
    await no.fecharBloco();
    no.enviar(criarTransferencia(a.priv, b.end, 10));
    await no.fecharBloco();
    const copia = structuredClone(no.cadeia);
    copia[1].transacoes[1].valor = 1000;
    copia[1].transacoes[1].id = calcularIdTransacao(copia[1].transacoes[1]);
    copia[1].raizMerkle = raizMerkle(copia[1].transacoes.map((t) => t.id));
    copia[1].hash = calcularHashBloco(copia[1]);
    expect(verificarCadeia(copia)[2]).toContain('elo');
  });
});
