import { useEffect, useMemo, useState } from 'react';
import {
  calcularHashBloco,
  calcularIdTransacao,
  minerarPasso,
  raizMerkle,
  verificarCadeia,
  type ProblemaBloco,
} from '../../../shared/chain.ts';
import { api, curto, type BlocoPublico } from '../lib.ts';
import { Aviso, Botao, Cartao, Hash, Titulo } from '../ui.tsx';

const EXPLICACAO: Record<ProblemaBloco, string> = {
  transacao: 'Assinatura não confere: só o dono da chave privada poderia autorizar esse valor.',
  merkle: 'A raiz Merkle não bate com as transações do bloco.',
  hash: 'O hash guardado não bate com o cabeçalho.',
  dificuldade: 'O hash não começa com os zeros exigidos: falta a prova de trabalho.',
  elo: 'O "hash anterior" não bate com o bloco de trás: a corrente quebrou aqui.',
  validador: 'A assinatura do validador não confere com este bloco.',
};

export function Adulterar() {
  const [original, setOriginal] = useState<{ cadeia: BlocoPublico[]; validadoresAutorizados: string[] } | null>(null);
  const [cadeia, setCadeia] = useState<BlocoPublico[]>([]);
  const [alvo, setAlvo] = useState<{ bloco: number; tx: number } | null>(null);
  const [novoValor, setNovoValor] = useState('1000');
  const [minerando, setMinerando] = useState<{ nonce: number; hash: string } | null>(null);

  const recarregar = () =>
    api<{ cadeia: BlocoPublico[]; validadoresAutorizados: string[] }>('/cadeia').then((d) => {
      setOriginal(d);
      setCadeia(structuredClone(d.cadeia));
      const b = d.cadeia.find((x) => x.transacoes.some((t) => t.tipo === 'transferencia'));
      if (b) setAlvo({ bloco: b.indice, tx: b.transacoes.findIndex((t) => t.tipo === 'transferencia') });
      else setAlvo(null);
    });
  useEffect(() => {
    recarregar();
  }, []);

  const problemas = useMemo(
    () => (original ? verificarCadeia(cadeia, original.validadoresAutorizados) : []),
    [cadeia, original],
  );

  if (!original) return <p className="pt-4 text-slate-400">Carregando a cadeia…</p>;
  if (!alvo)
    return (
      <div className="pt-2">
        <Titulo>Laboratório de adulteração</Titulo>
        <Aviso tipo="info">Ainda não há transferências na blockchain. Mande OAS para alguém e volte depois que o bloco fechar.</Aviso>
      </div>
    );

  const bloco = cadeia[alvo.bloco];
  const tx = bloco.transacoes[alvo.tx];
  const txOriginal = original.cadeia[alvo.bloco].transacoes[alvo.tx];
  const alterado = tx.valor !== txOriginal.valor;
  const primeiroQuebrado = problemas.findIndex((p) => p.length > 0);

  function mudar(f: (c: BlocoPublico[]) => void) {
    const c = structuredClone(cadeia);
    f(c);
    setCadeia(c);
  }

  function adulterar() {
    mudar((c) => {
      const t = c[alvo!.bloco].transacoes[alvo!.tx];
      t.valor = Math.max(1, Math.floor(Number(novoValor)) || 1);
      t.id = calcularIdTransacao(t); // o fraudador recalcula o ID da transação
    });
  }

  function recalcular() {
    mudar((c) => {
      const b = c[alvo!.bloco];
      b.raizMerkle = raizMerkle(b.transacoes.map((t) => t.id));
      b.hash = calcularHashBloco(b);
    });
  }

  function reminerar() {
    const b = structuredClone(cadeia[alvo!.bloco]);
    b.raizMerkle = raizMerkle(b.transacoes.map((t) => t.id));
    let inicio = 0;
    const passo = () => {
      const r = minerarPasso(b, inicio, 3000);
      setMinerando({ nonce: r.nonce, hash: r.hash });
      if (r.encontrado) {
        setMinerando(null);
        mudar((c) => {
          c[b.indice] = { ...b, nonce: r.nonce, hash: r.hash };
        });
        return;
      }
      inicio += 3000;
      setTimeout(passo, 16);
    };
    passo();
  }

  const inicioVisao = Math.max(0, alvo.bloco - 1);
  const visiveis = cadeia.slice(inicioVisao, inicioVisao + 5);

  return (
    <div className="space-y-4 pt-2">
      <Titulo sub="Tente fraudar a blockchain: mude o valor de uma transação antiga e veja o que acontece. Isso é só uma cópia no seu celular, a cadeia real não muda.">
        Laboratório de adulteração
      </Titulo>

      <Cartao className="space-y-3">
        <label className="block">
          <span className="text-sm text-slate-400">1. Escolha a transação</span>
          <select
            value={`${alvo.bloco}:${alvo.tx}`}
            onChange={(e) => {
              const [b, t] = e.target.value.split(':').map(Number);
              setCadeia(structuredClone(original.cadeia));
              setAlvo({ bloco: b, tx: t });
            }}
            className="mt-1 w-full rounded-xl border border-borda bg-fundo px-3 py-3"
          >
            {original.cadeia.flatMap((b) =>
              b.transacoes.flatMap((t, i) =>
                t.tipo === 'transferencia'
                  ? [
                      <option key={t.id} value={`${b.indice}:${i}`}>
                        Bloco #{b.indice}: {t.apelidoDe} → {t.apelidoPara}, {t.valor} OAS
                      </option>,
                    ]
                  : [],
              ),
            )}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <label className="flex-1">
            <span className="text-sm text-slate-400">2. Novo valor (era {txOriginal.valor} OAS)</span>
            <input
              inputMode="numeric"
              value={novoValor}
              onChange={(e) => setNovoValor(e.target.value.replace(/\D/g, ''))}
              className="mt-1 w-full rounded-xl border border-borda bg-fundo px-3 py-3 text-lg"
            />
          </label>
          <Botao tipo="perigo" onClick={adulterar}>
            Adulterar
          </Botao>
        </div>
        {alterado && (
          <div className="grid grid-cols-2 gap-2">
            <Botao tipo="secundario" onClick={recalcular}>
              3. Recalcular hash
            </Botao>
            <Botao tipo="secundario" onClick={reminerar} desativado={!!minerando || bloco.modo === 'drex'}>
              4. Reminerar bloco
            </Botao>
          </div>
        )}
        {minerando && (
          <div className="text-xs text-ouro">
            Minerando… nonce {minerando.nonce.toLocaleString('pt-BR')} · <span className="hash">{curto(minerando.hash, 10, 4)}</span>
          </div>
        )}
        {alterado && bloco.modo === 'drex' && (
          <Aviso tipo="info">
            Este bloco é do modo DREX: não dá para reminerar, porque quem fecha o bloco é um validador autorizado, e você não tem a chave
            dele.
          </Aviso>
        )}
        {alterado && (
          <Botao tipo="secundario" className="w-full" onClick={() => setCadeia(structuredClone(original.cadeia))}>
            Desfazer tudo
          </Botao>
        )}
      </Cartao>

      <Aviso tipo={primeiroQuebrado === -1 ? 'ok' : 'erro'}>
        {primeiroQuebrado === -1
          ? 'Cadeia íntegra: todos os blocos conferem.'
          : `Fraude detectada a partir do bloco #${primeiroQuebrado}. Qualquer nó da rede rejeitaria esta cópia.`}
      </Aviso>

      <div>
        {visiveis.map((b, i) => {
          const p = problemas[b.indice];
          const ok = p.length === 0;
          return (
            <div key={b.indice}>
              {i > 0 && <div className={`py-1 text-center ${problemas[b.indice].includes('elo') ? 'text-vermelho' : 'text-slate-500'}`}>{problemas[b.indice].includes('elo') ? '✂ elo quebrado' : '⬇'}</div>}
              <div className={`rounded-2xl border p-4 transition ${ok ? 'border-verde/40 bg-verde/5' : 'border-vermelho/60 bg-vermelho/10'}`}>
                <div className="flex justify-between">
                  <b>Bloco #{b.indice}</b>
                  <span className={ok ? 'text-verde' : 'text-vermelho'}>{ok ? '✔ válido' : '✘ inválido'}</span>
                </div>
                <div className="mt-2 text-xs text-slate-400">hash anterior</div>
                <span className="hash text-xs">{curto(b.hashAnterior, 14, 6)}</span>
                <div className="mt-1 text-xs text-slate-400">hash</div>
                <Hash valor={curto(b.hash, 14, 6)} zeros={b.dificuldade} />
                {p.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-vermelho">
                    {p.map((x) => (
                      <li key={x}>{EXPLICACAO[x]}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {alterado && (
        <Cartao className="text-sm text-slate-300">
          <b>Por que a fraude não passa:</b> mesmo reminerando este bloco, o seguinte continua apontando para o hash antigo. O fraudador
          teria que reminerar todos os blocos seguintes mais rápido que o resto da rede. E nem assim adiantaria: a assinatura da
          transação vale só para o valor original, e ele não tem a chave privada de quem enviou.
        </Cartao>
      )}
      <button className="w-full text-center text-sm text-slate-400 underline" onClick={recarregar}>
        Buscar a cadeia mais recente
      </button>
    </div>
  );
}
