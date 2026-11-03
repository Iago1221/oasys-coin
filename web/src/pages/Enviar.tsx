import { useMemo, useState } from 'react';
import { calcularIdTransacao, criarTransferencia, type Transacao } from '../../../shared/chain.ts';
import { api, curto, ir, lerCarteira, useApi, type Participante, type TxPublica } from '../lib.ts';
import { Aviso, Botao, Cartao, Titulo } from '../ui.tsx';

export function Enviar({ para: paraInicial }: { para: string | null }) {
  const carteira = lerCarteira();
  const { dados: participantes } = useApi<Participante[]>('/participantes');
  const [para, setPara] = useState<string | null>(paraInicial);
  const [busca, setBusca] = useState('');
  const [valor, setValor] = useState('10');
  const [taxa, setTaxa] = useState('0');
  const [erro, setErro] = useState<string | null>(null);
  const [enviada, setEnviada] = useState<TxPublica | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [carimbo] = useState(() => Date.now());

  const destino = participantes?.find((p) => p.endereco === para);
  const outros = (participantes ?? []).filter(
    (p) => p.endereco !== carteira?.endereco && p.apelido.toLowerCase().includes(busca.trim().toLowerCase()),
  );
  const v = Math.floor(Number(valor));
  const tx = Math.floor(Number(taxa));

  // prévia do que vai ser assinado: o ID muda na hora se o valor muda
  const previa = useMemo(() => {
    if (!carteira || !para) return null;
    const dados: Omit<Transacao, 'id' | 'assinatura'> = {
      tipo: 'transferencia',
      de: carteira.endereco,
      para,
      valor: v || 0,
      taxa: tx || 0,
      timestamp: carimbo,
    };
    return { ...dados, id: calcularIdTransacao(dados) };
  }, [carteira, para, v, tx, carimbo]);

  if (!carteira) {
    return (
      <Cartao className="mt-4 space-y-3 text-center">
        <p>Para enviar, você precisa de uma carteira.</p>
        <Botao className="w-full" onClick={() => ir('/cadastro')}>
          Criar carteira
        </Botao>
      </Cartao>
    );
  }

  async function enviar() {
    if (!carteira || !para) return;
    setErro(null);
    setEnviando(true);
    try {
      const assinada = criarTransferencia(carteira.chavePrivada, para, v, tx, Date.now() - carimbo > 5 * 60_000 ? Date.now() : carimbo);
      setEnviada(await api<TxPublica>('/transacoes', { corpo: assinada }));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (enviada)
    return (
      <div className="space-y-4 pt-2">
        <Cartao className="entrar space-y-3 text-center">
          <div className="text-5xl">✅</div>
          <h2 className="text-xl font-bold">
            {enviada.valor} OAS a caminho de {enviada.apelidoPara}
          </h2>
          <p className="text-sm text-slate-400">
            A transação foi assinada no seu celular e está na <b>mempool</b>, a fila de espera. Ela vira definitiva quando entrar num bloco.
          </p>
          <Botao className="w-full" onClick={() => ir(`/tx/${enviada.id}`)}>
            Acompanhar a transação
          </Botao>
          <Botao tipo="secundario" className="w-full" onClick={() => ir('/carteira')}>
            Voltar para a carteira
          </Botao>
        </Cartao>
      </div>
    );

  return (
    <div className="space-y-4 pt-2">
      <Titulo sub="Escolha um colega, defina o valor e assine com a sua chave privada.">Enviar OAS</Titulo>

      <Cartao>
        <div className="mb-2 text-sm text-slate-400">Para quem?</div>
        {destino ? (
          <div className="flex items-center justify-between rounded-xl bg-fundo p-3">
            <div>
              <b>{destino.apelido}</b> <span className="hash text-xs text-slate-500">{curto(destino.endereco)}</span>
            </div>
            <button className="text-sm text-ouro" onClick={() => setPara(null)}>
              trocar
            </button>
          </div>
        ) : (
          <>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar pelo apelido"
              className="mb-2 w-full rounded-xl border border-borda bg-fundo px-4 py-3 outline-none focus:border-ouro"
            />
            <div className="max-h-64 overflow-y-auto">
              {outros.map((p) => (
                <button
                  key={p.endereco}
                  onClick={() => setPara(p.endereco)}
                  className="flex w-full items-center justify-between border-b border-borda/60 px-1 py-2.5 text-left last:border-0 hover:bg-white/5"
                >
                  <span>{p.apelido}</span>
                  <span className="hash text-xs text-slate-500">{curto(p.endereco)}</span>
                </button>
              ))}
              {participantes && outros.length === 0 && <p className="py-2 text-sm text-slate-500">Ninguém encontrado.</p>}
            </div>
          </>
        )}
      </Cartao>

      <Cartao className="grid grid-cols-2 gap-3">
        <label>
          <span className="text-sm text-slate-400">Valor (OAS)</span>
          <input
            inputMode="numeric"
            value={valor}
            onChange={(e) => setValor(e.target.value.replace(/\D/g, ''))}
            className="mt-1 w-full rounded-xl border border-borda bg-fundo px-4 py-3 text-xl outline-none focus:border-ouro"
          />
        </label>
        <label>
          <span className="text-sm text-slate-400">Taxa para o minerador</span>
          <input
            inputMode="numeric"
            value={taxa}
            onChange={(e) => setTaxa(e.target.value.replace(/\D/g, ''))}
            className="mt-1 w-full rounded-xl border border-borda bg-fundo px-4 py-3 text-xl outline-none focus:border-ouro"
          />
        </label>
      </Cartao>

      {previa && (
        <Cartao>
          <div className="mb-2 text-sm font-semibold">O que vai ser assinado</div>
          <pre className="hash overflow-x-auto rounded-lg bg-fundo p-3 text-xs whitespace-pre-wrap text-slate-300">
            {JSON.stringify({ de: curto(previa.de), para: curto(previa.para), valor: previa.valor, taxa: previa.taxa, timestamp: previa.timestamp }, null, 1)}
          </pre>
          <div className="mt-2 text-xs text-slate-400">
            ID (SHA-256 desses dados): <span className="hash text-slate-300">{curto(previa.id, 12, 8)}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Mude o valor e veja o ID mudar por completo. A assinatura vale só para este ID.</p>
        </Cartao>
      )}

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Botao className="w-full text-lg" desativado={!para || !v || enviando} onClick={enviar}>
        {enviando ? 'Assinando…' : `Assinar e enviar ${v || 0} OAS`}
      </Botao>
    </div>
  );
}
