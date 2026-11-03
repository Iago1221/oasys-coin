import { HASH_ZERO } from '../../../shared/chain.ts';
import { curto, dataHora, useApi, useEstado, useMineracao, type BlocoPublico, type ResumoBloco } from '../lib.ts';
import { AJUDA } from './ajuda.ts';
import { Campo, Cartao, Hash, LinhaTx, Titulo } from '../ui.tsx';

export function PainelMineracao({ grande }: { grande?: boolean }) {
  const t = grande ? 'text-xl' : 'text-sm';
  const t2 = grande ? 'text-lg' : 'text-xs';
  const estado = useEstado();
  const m = useMineracao();
  if (!estado) return null;
  if (!estado.mineracao || !m)
    return (
      <div className={`${t} text-slate-400`}>
        {estado.mempool.length > 0
          ? `${estado.mempool.length} ${estado.mempool.length === 1 ? 'transação esperando' : 'transações esperando'}. O próximo bloco fecha em até ${estado.intervaloBlocoSegundos} s.`
          : 'Nenhuma transação esperando. Envie OAS para alguém!'}
      </div>
    );
  if (estado.modo === 'drex' || m.dificuldade === 0) return <div className={`${t} text-azul`}>Validador autorizado assinando o bloco #{m.indice}…</div>;
  return (
    <div>
      <div className={`${t} text-ouro`}>
        Minerando o bloco #{m.indice}: procurando um hash que comece com {'0'.repeat(m.dificuldade)}
      </div>
      <div className={`mt-1 ${t2} text-slate-400`}>
        nonce testado: <b className="text-slate-200">{m.nonce.toLocaleString('pt-BR')}</b>
      </div>
      <div className="mt-1 truncate">
        <Hash valor={m.hash || '…'} zeros={m.dificuldade} className={grande ? 'text-2xl' : 'text-sm'} />
      </div>
    </div>
  );
}

export function CartaoBloco({ b, compacto }: { b: ResumoBloco; compacto?: boolean }) {
  return (
    <a href={`#/bloco/${b.indice}`} className="entrar block rounded-2xl border border-borda bg-painel p-4 hover:border-ouro/60">
      <div className="flex items-center justify-between">
        <b className="text-lg">Bloco #{b.indice}</b>
        <span className={`text-xs ${b.modo === 'drex' ? 'text-azul' : 'text-ouro'}`}>
          {b.modo === 'drex' ? `validado por ${b.validador}` : b.indice === 0 ? 'gênese' : `nonce ${b.nonce.toLocaleString('pt-BR')}`}
        </span>
      </div>
      <div className="mt-2 text-xs text-slate-400">hash</div>
      <Hash valor={compacto ? curto(b.hash, 12, 6) : b.hash} zeros={8} />
      <div className="mt-1 text-xs text-slate-400">hash anterior</div>
      <span className="hash text-xs text-slate-400">{curto(b.hashAnterior, 12, 6)}</span>
      <div className="mt-2 text-xs text-slate-500">
        {b.quantidade} transações · {dataHora(b.timestamp)}
      </div>
    </a>
  );
}

export function Blocos() {
  const estado = useEstado();
  const { dados } = useApi<ResumoBloco[]>('/blocos');
  return (
    <div className="space-y-4 pt-2">
      <Titulo sub="Cada bloco guarda o hash do anterior. Toque num bloco para ver tudo o que tem dentro.">Explorador de blocos</Titulo>
      <Cartao>
        <PainelMineracao />
      </Cartao>
      {estado && estado.mempool.length > 0 && (
        <Cartao>
          <h2 className="mb-1 font-semibold">Mempool: esperando o próximo bloco</h2>
          {estado.mempool.slice(0, 20).map((t) => (
            <LinhaTx key={t.id} t={t} bloco={null} />
          ))}
        </Cartao>
      )}
      <div>
        {dados?.map((b, i) => (
          <div key={b.hash}>
            {i > 0 && <div className="py-1 text-center text-slate-500">⬆ aponta para o de cima ⬆</div>}
            <CartaoBloco b={b} compacto />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BlocoDetalhe({ indice }: { indice: number }) {
  const { dados, erro } = useApi<{ bloco: BlocoPublico; proximoHashAnterior: string | null }>(`/blocos/${indice}`);
  const { dados: anterior } = useApi<{ bloco: BlocoPublico }>(indice > 0 ? `/blocos/${indice - 1}` : null, false);
  if (erro) return <p className="pt-4 text-vermelho">{erro}</p>;
  if (!dados) return <p className="pt-4 text-slate-400">Carregando…</p>;
  const b = dados.bloco;
  const eloOk = indice === 0 ? b.hashAnterior === HASH_ZERO : anterior ? anterior.bloco.hash === b.hashAnterior : null;

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <Titulo sub={b.indice === 0 ? 'O primeiro bloco, criado quando a rede começou.' : undefined}>Bloco #{b.indice}</Titulo>
        <div className="flex gap-2">
          {indice > 0 && <a href={`#/bloco/${indice - 1}`} className="rounded-lg bg-borda px-3 py-2 text-sm">← #{indice - 1}</a>}
          {dados.proximoHashAnterior && <a href={`#/bloco/${indice + 1}`} className="rounded-lg bg-borda px-3 py-2 text-sm">#{indice + 1} →</a>}
        </div>
      </div>

      <Cartao>
        <h2 className="mb-1 font-semibold">Cabeçalho</h2>
        <Campo nome="Índice" ajuda={AJUDA.indice}>#{b.indice}</Campo>
        <Campo nome="Data e hora" ajuda={AJUDA.timestamp}>{dataHora(b.timestamp)}</Campo>
        <Campo nome="Hash anterior" ajuda={AJUDA.hashAnterior}>
          <Hash valor={b.hashAnterior} zeros={8} />
          {eloOk !== null && (
            <div className={`mt-1 text-xs ${eloOk ? 'text-verde' : 'text-vermelho'}`}>
              {eloOk ? (indice === 0 ? '✔ gênese: não há bloco anterior' : `✔ igual ao hash do bloco #${indice - 1}`) : '✘ não bate com o bloco anterior'}
            </div>
          )}
        </Campo>
        <Campo nome="Raiz Merkle" ajuda={AJUDA.raizMerkle}><Hash valor={b.raizMerkle} /></Campo>
        <Campo nome="Modo" ajuda={AJUDA.modo}>{b.modo === 'drex' ? 'DREX (permissionado)' : 'Cripto (prova de trabalho)'}</Campo>
        {b.modo === 'cripto' ? (
          <>
            <Campo nome="Nonce" ajuda={AJUDA.nonce}>{b.nonce.toLocaleString('pt-BR')}</Campo>
            <Campo nome="Dificuldade" ajuda={AJUDA.dificuldade}>{b.dificuldade} zeros no começo do hash</Campo>
          </>
        ) : (
          <Campo nome="Validador" ajuda={AJUDA.validador}>
            {b.validador?.nome}
            <div className="hash text-xs text-slate-500">assinatura: {curto(b.validador?.assinatura ?? '', 16, 8)}</div>
          </Campo>
        )}
        <Campo nome="Hash do bloco" ajuda={AJUDA.hash} destaque>
          <Hash valor={b.hash} zeros={b.dificuldade} />
        </Campo>
      </Cartao>

      <Cartao>
        <h2 className="mb-1 font-semibold">Transações ({b.transacoes.length})</h2>
        {b.transacoes.length === 0 && <p className="text-sm text-slate-500">O bloco gênese não tem transações.</p>}
        {b.transacoes.map((t) => (
          <LinhaTx key={t.id} t={t} />
        ))}
      </Cartao>
    </div>
  );
}
