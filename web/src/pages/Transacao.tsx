import { assinaturaValida, calcularIdTransacao } from '../../../shared/chain.ts';
import { dataHora, useApi, type TxPublica } from '../lib.ts';
import { AJUDA } from './ajuda.ts';
import { Campo, Cartao, Hash, Nome, ROTULO_TIPO, Titulo } from '../ui.tsx';

export function TxDetalhe({ id }: { id: string }) {
  const { dados, erro } = useApi<{ transacao: TxPublica; bloco: number | null; confirmacoes: number }>(`/transacoes/${id}`);
  if (erro) return <p className="pt-4 text-vermelho">{erro}</p>;
  if (!dados) return <p className="pt-4 text-slate-400">Carregando…</p>;
  const t = dados.transacao;
  const idOk = calcularIdTransacao(t) === t.id;
  const assinaturaOk = assinaturaValida(t); // conferida aqui, no seu navegador

  return (
    <div className="space-y-4 pt-2">
      <Titulo>Transação</Titulo>
      <Cartao className="text-center">
        <div className="text-4xl font-bold text-ouro">{t.valor} OAS</div>
        <div className="mt-1 text-sm">
          {t.tipo === 'transferencia' ? (
            <>
              {t.apelidoDe} → {t.apelidoPara}
            </>
          ) : (
            <>
              {ROTULO_TIPO[t.tipo]} para {t.apelidoPara}
            </>
          )}
        </div>
        <div className="mt-3">
          {dados.bloco === null ? (
            <span className="rounded-full bg-ouro/20 px-3 py-1 text-sm text-ouro">Na mempool, esperando o próximo bloco</span>
          ) : (
            <a href={`#/bloco/${dados.bloco}`} className="rounded-full bg-verde/20 px-3 py-1 text-sm text-verde">
              Confirmada no bloco #{dados.bloco} · {dados.confirmacoes} confirmações
            </a>
          )}
        </div>
      </Cartao>
      <Cartao>
        <Campo nome="Tipo" ajuda={AJUDA.tipo}>{ROTULO_TIPO[t.tipo]}</Campo>
        <Campo nome="ID da transação" ajuda={AJUDA.txId}>
          <Hash valor={t.id} />
          <div className={`mt-1 text-xs ${idOk ? 'text-verde' : 'text-vermelho'}`}>{idOk ? '✔ recalculado no seu celular: confere' : '✘ não confere'}</div>
        </Campo>
        <Campo nome="De" ajuda={AJUDA.de}><Nome apelido={t.apelidoDe} endereco={t.de} /></Campo>
        <Campo nome="Para" ajuda={AJUDA.para}><Nome apelido={t.apelidoPara} endereco={t.para} /></Campo>
        <Campo nome="Valor" ajuda={AJUDA.valor}>{t.valor} OAS</Campo>
        <Campo nome="Taxa" ajuda={AJUDA.taxa}>{t.taxa} OAS</Campo>
        <Campo nome="Data e hora" ajuda={AJUDA.timestamp}>{dataHora(t.timestamp)}</Campo>
        <Campo nome="Assinatura" ajuda={AJUDA.assinatura}>
          {t.assinatura ? <Hash valor={t.assinatura} /> : <span className="text-slate-400">Sem assinatura: moeda criada pelo próprio sistema.</span>}
          <div className={`mt-1 text-xs ${assinaturaOk ? 'text-verde' : 'text-vermelho'}`}>
            {t.assinatura ? (assinaturaOk ? '✔ assinatura válida, conferida no seu celular com a chave pública de quem enviou' : '✘ assinatura inválida') : ''}
          </div>
        </Campo>
      </Cartao>
    </div>
  );
}
