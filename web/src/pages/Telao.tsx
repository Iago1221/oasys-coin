import { useState } from 'react';
import { api, curto, hora, urlBase, useApi, useEstado, type Participante } from '../lib.ts';
import { Hash, LinhaTx, Qr } from '../ui.tsx';
import { PainelMineracao } from './Blocos.tsx';

function ControlesAdmin() {
  const estado = useEstado();
  const [token, setToken] = useState(() => {
    try {
      return sessionStorage.getItem('oasys.admin') ?? '';
    } catch {
      return '';
    }
  });
  const [ok, setOk] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [alvo, setAlvo] = useState('');
  const { dados: participantes } = useApi<Participante[]>('/participantes');

  const chamar = async (caminho: string, corpo: unknown = {}) => {
    setMsg(null);
    try {
      await api(caminho, { corpo, admin: token });
      setOk(true);
      try {
        sessionStorage.setItem('oasys.admin', token);
      } catch {
        /* sem armazenamento */
      }
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  if (!ok)
    return (
      <div className="sticky bottom-0 flex items-center gap-2 border-t border-borda bg-fundo p-3">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Senha de administrador"
          className="rounded-lg border border-borda bg-fundo px-3 py-2"
        />
        <button className="rounded-lg bg-borda px-3 py-2" onClick={() => chamar('/admin/login')}>
          Entrar
        </button>
        {msg && <span className="text-vermelho">{msg}</span>}
      </div>
    );

  const drex = estado?.modo === 'drex';
  return (
    <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-borda bg-fundo p-3 text-sm">
      <button className="rounded-lg bg-ouro px-3 py-2 font-semibold text-slate-900" onClick={() => chamar('/admin/minerar')}>
        Fechar bloco agora
      </button>
      <button className="rounded-lg bg-azul px-3 py-2 font-semibold text-slate-900" onClick={() => chamar('/admin/modo', { modo: drex ? 'cripto' : 'drex' })}>
        {drex ? 'Voltar ao modo cripto' : 'Ligar modo DREX'}
      </button>
      {drex && (
        <>
          <select value={alvo} onChange={(e) => setAlvo(e.target.value)} className="rounded-lg border border-borda bg-fundo px-2 py-2">
            <option value="">Escolha uma carteira…</option>
            {participantes?.map((p) => (
              <option key={p.endereco} value={p.endereco}>
                {p.apelido} {p.congelado ? '(congelada)' : ''}
              </option>
            ))}
          </select>
          <button
            className="rounded-lg bg-borda px-3 py-2"
            disabled={!alvo}
            onClick={() => chamar('/admin/congelar', { endereco: alvo, congelado: !participantes?.find((p) => p.endereco === alvo)?.congelado })}
          >
            {participantes?.find((p) => p.endereco === alvo)?.congelado ? 'Descongelar' : 'Congelar'} carteira
          </button>
        </>
      )}
      <button
        className="ml-auto rounded-lg bg-vermelho/80 px-3 py-2 text-slate-900"
        onClick={() => confirm('Apagar a blockchain e todas as carteiras e começar do zero?') && chamar('/admin/reiniciar')}
      >
        Reiniciar tudo
      </button>
      {msg && <span className="text-vermelho">{msg}</span>}
    </div>
  );
}

export function Telao({ admin }: { admin: boolean }) {
  const estado = useEstado();
  const link = estado?.urlPublica || urlBase();
  const linkCadastro = `${link.replace(/\/?(#.*)?$/, '/')}#/cadastro`;
  const drex = estado?.modo === 'drex';
  const blocos = estado ? [...estado.ultimosBlocos].slice(-5) : [];

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="grid flex-1 grid-cols-[minmax(320px,26rem)_1fr] gap-6 p-6">
        <aside className="flex flex-col items-center rounded-3xl border border-borda bg-painel p-6 text-center">
          <div className="flex items-center gap-3 text-3xl font-bold">
            <img src="/moeda.svg" alt="" className="h-12 w-12" /> OasysCoin
          </div>
          <p className="mt-4 text-xl">Aponte a câmera e crie sua carteira</p>
          <div className="mt-4">
            <Qr texto={linkCadastro} tamanho={300} />
          </div>
          <div className="mt-3 text-lg break-all text-slate-300">{linkCadastro.replace(/^https?:\/\//, '').replace('/#/cadastro', '')}</div>
          <div className="mt-6 grid w-full grid-cols-2 gap-3">
            <div className="rounded-2xl bg-fundo p-4">
              <div className="text-4xl font-bold text-ouro">{estado?.participantes ?? '…'}</div>
              <div className="text-sm text-slate-400">carteiras</div>
            </div>
            <div className="rounded-2xl bg-fundo p-4">
              <div className="text-4xl font-bold text-ouro">{estado?.altura ?? '…'}</div>
              <div className="text-sm text-slate-400">blocos</div>
            </div>
          </div>
          {estado && estado.ranking.length > 0 && (
            <div className="mt-6 w-full text-left">
              <div className="mb-2 text-sm font-semibold text-slate-400">Quem mais transacionou</div>
              {estado.ranking.map((r, i) => (
                <div key={i} className="flex justify-between border-b border-borda/60 py-1.5 last:border-0">
                  <span>
                    {i + 1}. {r.apelido}
                  </span>
                  <span className="text-slate-400">{r.transacoes}</span>
                </div>
              ))}
            </div>
          )}
        </aside>

        <section className="flex min-w-0 flex-col gap-6">
          <div className={`rounded-3xl border p-5 ${drex ? 'border-azul/60 bg-azul/10' : 'border-ouro/40 bg-ouro/5'}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">{drex ? '🏦 Modo DREX: rede permissionada' : '⛏ Modo cripto: rede aberta'}</h2>
              <span className="text-slate-400">novo bloco a cada {estado?.intervaloBlocoSegundos ?? '…'} s</span>
            </div>
            <p className="mt-1 text-slate-300">
              {drex
                ? `Só validadores autorizados fecham blocos: ${estado?.validadores.map((v) => v.nome).join(', ')}. Sem mineração; o regulador pode congelar carteiras.`
                : 'Qualquer um pode fechar blocos, desde que prove trabalho: achar um nonce que faça o hash começar com zeros.'}
            </p>
            <div className="mt-4">
              <PainelMineracao grande />
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-slate-400">A cadeia (últimos blocos)</div>
            <div className="flex items-stretch gap-2 overflow-hidden">
              {blocos.map((b, i) => (
                <div key={b.hash} className="flex min-w-0 flex-1 items-center gap-2">
                  {i > 0 && <span className="text-2xl text-slate-500">→</span>}
                  <a href={`#/bloco/${b.indice}`} className="entrar min-w-0 flex-1 rounded-2xl border border-borda bg-painel p-4">
                    <div className="flex justify-between">
                      <b className="text-xl">#{b.indice}</b>
                      <span className="text-sm text-slate-400">{hora(b.timestamp)}</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">anterior</div>
                    <div className="hash text-sm text-slate-400">{curto(b.hashAnterior, 8, 4)}</div>
                    <div className="mt-1 text-xs text-slate-500">hash</div>
                    <Hash valor={curto(b.hash, 8, 4)} zeros={8} />
                    <div className="mt-2 text-sm text-slate-300">
                      {b.quantidade} transações
                      {b.validador ? ` · ${b.validador}` : b.indice > 0 ? ` · nonce ${b.nonce.toLocaleString('pt-BR')}` : ' · gênese'}
                    </div>
                  </a>
                </div>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 rounded-3xl border border-borda bg-painel p-5">
            <div className="mb-1 flex justify-between">
              <b className="text-lg">Mempool: transações esperando o próximo bloco</b>
              <span className="text-slate-400">{estado?.mempool.length ?? 0}</span>
            </div>
            <div className="text-lg">
              {estado?.mempool
                .slice(-8)
                .reverse()
                .map((t) => <LinhaTx key={t.id} t={t} bloco={null} />)}
              {estado?.mempool.length === 0 && <p className="text-slate-500">Vazia. Mandem OAS uns para os outros!</p>}
            </div>
          </div>
        </section>
      </div>
      {admin && <ControlesAdmin />}
    </div>
  );
}
