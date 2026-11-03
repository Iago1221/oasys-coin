// O "nó" da OasysCoin: guarda a cadeia, a mempool e os participantes, valida transações
// e fecha blocos (prova de trabalho no modo cripto, assinatura de validador no modo DREX).

import { EventEmitter } from 'node:events';
import {
  type Bloco,
  type Transacao,
  HASH_ZERO,
  assinarComoValidador,
  calcularHashBloco,
  calcularSaldos,
  chavePublicaDe,
  criarEmissao,
  enderecoValido,
  minerarPasso,
  novaChavePrivada,
  problemaNaTransacao,
  raizMerkle,
  verificarCadeia,
} from '../shared/chain.ts';

export interface Participante {
  apelido: string;
  endereco: string;
  criadoEm: number;
}

interface Conta {
  nome: string;
  chavePrivada: string;
  chavePublica: string;
}

export interface EstadoPersistido {
  cadeia: Bloco[];
  mempool: Transacao[];
  participantes: Participante[];
  modo: 'cripto' | 'drex';
  congelados: string[];
  validadores: Conta[];
  minerador: Conta;
}

export interface ProgressoMineracao {
  indice: number;
  nonce: number;
  hash: string;
  dificuldade: number;
  inicio: number;
}

export interface Config {
  dificuldade: number; // zeros hex no começo do hash
  hashesPorSegundo: number; // limite de velocidade, para dar para ver o nonce subindo
  faucet: number;
  recompensa: number;
  maxTransacoesPorBloco: number;
}

export class ErroValidacao extends Error {}

function conta(nome: string): Conta {
  const chavePrivada = novaChavePrivada();
  return { nome, chavePrivada, chavePublica: chavePublicaDe(chavePrivada) };
}

export class No extends EventEmitter {
  cadeia: Bloco[] = [];
  mempool: Transacao[] = [];
  participantes = new Map<string, Participante>();
  modo: 'cripto' | 'drex' = 'cripto';
  congelados = new Set<string>();
  validadores: Conta[] = [];
  minerador!: Conta;
  mineracao: ProgressoMineracao | null = null;
  private idsConhecidos = new Set<string>();
  private proximoValidador = 0;

  constructor(
    readonly config: Config,
    estado?: EstadoPersistido,
  ) {
    super();
    if (estado) this.carregar(estado);
    else this.reiniciar();
  }

  // ---------- estado ----------

  reiniciar() {
    this.mempool = [];
    this.participantes.clear();
    this.congelados.clear();
    this.modo = 'cripto';
    this.minerador ??= conta('Nó Oasys (minerador)');
    if (this.validadores.length === 0)
      this.validadores = [conta('Banco Central do Brasil'), conta('Banco Alfa'), conta('Banco Beta')];
    this.cadeia = [this.criarGenese()];
    this.reindexar();
    this.emit('mudou');
  }

  private carregar(e: EstadoPersistido) {
    this.cadeia = e.cadeia;
    this.mempool = e.mempool;
    this.participantes = new Map(e.participantes.map((p) => [p.endereco, p]));
    this.modo = e.modo;
    this.congelados = new Set(e.congelados);
    this.validadores = e.validadores;
    this.minerador = e.minerador;
    this.reindexar();
  }

  exportar(): EstadoPersistido {
    return {
      cadeia: this.cadeia,
      mempool: this.mempool,
      participantes: [...this.participantes.values()],
      modo: this.modo,
      congelados: [...this.congelados],
      validadores: this.validadores,
      minerador: this.minerador,
    };
  }

  private reindexar() {
    this.idsConhecidos = new Set([...this.cadeia.flatMap((b) => b.transacoes), ...this.mempool].map((t) => t.id));
  }

  private criarGenese(): Bloco {
    const cab = {
      indice: 0,
      timestamp: Date.now(),
      hashAnterior: HASH_ZERO,
      raizMerkle: raizMerkle([]),
      nonce: 0,
      dificuldade: this.config.dificuldade,
      modo: 'cripto' as const,
    };
    let inicio = 0;
    for (;;) {
      const r = minerarPasso(cab, inicio, 100_000);
      if (r.encontrado) return { ...cab, nonce: r.nonce, hash: r.hash, validador: null, transacoes: [] };
      inicio += 100_000;
    }
  }

  get validadoresAutorizados() {
    return this.validadores.map((v) => v.chavePublica);
  }

  get topo() {
    return this.cadeia[this.cadeia.length - 1];
  }

  apelido(endereco: string): string | null {
    if (endereco === this.minerador.chavePublica) return this.minerador.nome;
    const v = this.validadores.find((x) => x.chavePublica === endereco);
    if (v) return v.nome;
    return this.participantes.get(endereco)?.apelido ?? null;
  }

  // ---------- saldos ----------

  saldosConfirmados() {
    return calcularSaldos(this.cadeia);
  }

  saldoConfirmado(endereco: string) {
    return this.saldosConfirmados().get(endereco) ?? 0;
  }

  /** O que a pessoa pode gastar agora: confirmado, menos saídas pendentes, mais o faucet pendente. */
  saldoDisponivel(endereco: string) {
    let saldo = this.saldoConfirmado(endereco);
    for (const t of this.mempool) {
      if (t.de === endereco) saldo -= t.valor + t.taxa;
      if (t.para === endereco && t.tipo === 'faucet') saldo += t.valor;
    }
    return saldo;
  }

  // ---------- participantes e transações ----------

  cadastrar(apelidoBruto: string, endereco: string): Participante {
    const apelido = String(apelidoBruto ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (apelido.length < 2 || apelido.length > 24) throw new ErroValidacao('O apelido precisa ter de 2 a 24 caracteres.');
    if (!enderecoValido(endereco)) throw new ErroValidacao('Endereço de carteira inválido.');
    const existente = this.participantes.get(endereco);
    if (existente) return existente;
    const emUso = [...this.participantes.values()].some((p) => p.apelido.toLowerCase() === apelido.toLowerCase());
    if (emUso) throw new ErroValidacao('Esse apelido já está em uso. Tente outro.');

    const p: Participante = { apelido, endereco, criadoEm: Date.now() };
    this.participantes.set(endereco, p);
    this.adicionarNaMempool(criarEmissao('faucet', endereco, this.config.faucet));
    return p;
  }

  enviar(t: Transacao): Transacao {
    if (!t || typeof t !== 'object') throw new ErroValidacao('Transação vazia.');
    const tx: Transacao = {
      id: String(t.id),
      tipo: t.tipo,
      de: String(t.de),
      para: String(t.para),
      valor: Number(t.valor),
      taxa: Number(t.taxa ?? 0),
      timestamp: Number(t.timestamp),
      assinatura: t.assinatura ? String(t.assinatura) : null,
    };
    if (tx.tipo !== 'transferencia') throw new ErroValidacao('Só transferências podem ser enviadas.');
    const problema = problemaNaTransacao(tx);
    if (problema) throw new ErroValidacao(problema);
    if (Math.abs(Date.now() - tx.timestamp) > 10 * 60_000) throw new ErroValidacao('Horário da transação fora do aceitável.');
    if (this.idsConhecidos.has(tx.id)) throw new ErroValidacao('Essa transação já foi enviada (tentativa de repetição).');
    if (!this.participantes.has(tx.de)) throw new ErroValidacao('Carteira de origem não cadastrada.');
    if (!this.participantes.has(tx.para)) throw new ErroValidacao('Carteira de destino não cadastrada.');
    if (this.modo === 'drex' && this.congelados.has(tx.de))
      throw new ErroValidacao('Carteira congelada pelo regulador (modo DREX).');
    const disponivel = this.saldoDisponivel(tx.de);
    if (disponivel < tx.valor + tx.taxa)
      throw new ErroValidacao(`Saldo insuficiente: você tem ${disponivel} OAS disponíveis.`);
    this.adicionarNaMempool(tx);
    return tx;
  }

  private adicionarNaMempool(t: Transacao) {
    this.mempool.push(t);
    this.idsConhecidos.add(t.id);
    this.emit('mudou');
  }

  // ---------- modo DREX ----------

  definirModo(modo: 'cripto' | 'drex') {
    if (modo !== 'cripto' && modo !== 'drex') throw new ErroValidacao('Modo inválido.');
    this.modo = modo;
    this.emit('mudou');
  }

  congelar(endereco: string, congelado: boolean) {
    if (!this.participantes.has(endereco)) throw new ErroValidacao('Carteira não encontrada.');
    if (congelado) this.congelados.add(endereco);
    else this.congelados.delete(endereco);
    this.emit('mudou');
  }

  // ---------- fechamento de blocos ----------

  /** Seleciona da mempool o que ainda é válido, na ordem de chegada, aplicando os saldos em sequência. */
  private selecionarTransacoes(): { escolhidas: Transacao[]; descartadas: Set<string> } {
    const saldos = this.saldosConfirmados();
    const escolhidas: Transacao[] = [];
    const descartadas = new Set<string>();
    for (const t of this.mempool) {
      if (escolhidas.length >= this.config.maxTransacoesPorBloco) break;
      if (t.tipo === 'transferencia') {
        if (this.modo === 'drex' && this.congelados.has(t.de)) continue; // fica esperando o descongelamento
        const s = saldos.get(t.de) ?? 0;
        if (s < t.valor + t.taxa) {
          descartadas.add(t.id);
          continue;
        }
        saldos.set(t.de, s - t.valor - t.taxa);
      }
      saldos.set(t.para, (saldos.get(t.para) ?? 0) + t.valor);
      escolhidas.push(t);
    }
    return { escolhidas, descartadas };
  }

  get ocupado() {
    return this.mineracao !== null;
  }

  /** Fecha um bloco com o que estiver na mempool. Resolve com o bloco, ou null se não havia nada. */
  async fecharBloco(): Promise<Bloco | null> {
    if (this.ocupado || this.mempool.length === 0) return null;
    const { escolhidas: selecionadas, descartadas } = this.selecionarTransacoes();
    if (selecionadas.length === 0) {
      if (descartadas.size > 0) {
        this.mempool = this.mempool.filter((t) => !descartadas.has(t.id));
        this.emit('mudou');
      }
      return null;
    }
    const taxas = selecionadas.reduce((s, t) => s + t.taxa, 0);
    const modo = this.modo;
    const anterior = this.topo;
    let transacoes = selecionadas;
    let validador: Bloco['validador'] = null;
    let conta: Conta = this.minerador;

    if (modo === 'cripto') {
      transacoes = [criarEmissao('recompensa', this.minerador.chavePublica, this.config.recompensa + taxas), ...selecionadas];
    } else {
      conta = this.validadores[this.proximoValidador++ % this.validadores.length];
      if (taxas > 0) transacoes = [criarEmissao('recompensa', conta.chavePublica, taxas), ...selecionadas];
    }

    const cab = {
      indice: anterior.indice + 1,
      timestamp: Date.now(),
      hashAnterior: anterior.hash,
      raizMerkle: raizMerkle(transacoes.map((t) => t.id)),
      nonce: 0,
      dificuldade: modo === 'cripto' ? this.config.dificuldade : 0,
      modo,
    };

    let nonce = 0;
    let hash: string;
    if (modo === 'cripto') {
      this.mineracao = { indice: cab.indice, nonce: 0, hash: '', dificuldade: cab.dificuldade, inicio: Date.now() };
      hash = await this.provaDeTrabalho(cab, (n) => (nonce = n));
    } else {
      this.mineracao = { indice: cab.indice, nonce: 0, hash: '', dificuldade: 0, inicio: Date.now() };
      hash = calcularHashBloco(cab);
      validador = { nome: conta.nome, chavePublica: conta.chavePublica, assinatura: assinarComoValidador(hash, conta.chavePrivada) };
    }

    const bloco: Bloco = { ...cab, nonce, hash, validador, transacoes };
    const problemas = verificarCadeia([anterior, bloco], this.validadoresAutorizados)[1];
    this.mineracao = null;
    if (problemas.length > 0 || this.topo !== anterior) {
      this.emit('mudou');
      throw new Error(`Bloco inválido gerado: ${problemas.join(', ')}`);
    }
    this.cadeia.push(bloco);
    const incluidas = new Set(transacoes.map((t) => t.id));
    this.mempool = this.mempool.filter((t) => !incluidas.has(t.id) && !descartadas.has(t.id));
    for (const id of incluidas) this.idsConhecidos.add(id); // ids descartados continuam conhecidos: impede reenvio
    this.emit('bloco', bloco);
    this.emit('mudou');
    return bloco;
  }

  private provaDeTrabalho(cab: Parameters<typeof calcularHashBloco>[0], aoAvancar: (n: number) => void): Promise<string> {
    const intervaloMs = 100;
    const porPasso = Math.max(1, Math.round((this.config.hashesPorSegundo * intervaloMs) / 1000));
    return new Promise((resolve) => {
      let inicio = 0;
      const passo = () => {
        const r = minerarPasso(cab, inicio, porPasso);
        aoAvancar(r.nonce);
        this.mineracao = { ...this.mineracao!, nonce: r.nonce, hash: r.hash };
        this.emit('mineracao', this.mineracao);
        if (r.encontrado) return resolve(r.hash);
        inicio += porPasso;
        setTimeout(passo, intervaloMs);
      };
      passo();
    });
  }
}
