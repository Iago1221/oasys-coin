import { useEffect, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { curto, dataHora, type TxPublica } from './lib.ts';

export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-borda bg-painel p-4 ${className}`}>{children}</div>;
}

export function Titulo({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-bold">{children}</h1>
      {sub && <p className="mt-1 text-sm text-slate-400">{sub}</p>}
    </div>
  );
}

export function Botao({
  children,
  onClick,
  tipo = 'primario',
  desativado,
  className = '',
  submit,
}: {
  children: ReactNode;
  onClick?: () => void;
  tipo?: 'primario' | 'secundario' | 'perigo';
  desativado?: boolean;
  className?: string;
  submit?: boolean;
}) {
  const cores = {
    primario: 'bg-ouro text-slate-900 hover:brightness-110',
    secundario: 'bg-borda text-slate-100 hover:bg-slate-600',
    perigo: 'bg-vermelho/90 text-slate-900 hover:bg-vermelho',
  }[tipo];
  return (
    <button
      type={submit ? 'submit' : 'button'}
      onClick={onClick}
      disabled={desativado}
      className={`rounded-xl px-4 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${cores} ${className}`}
    >
      {children}
    </button>
  );
}

/** Um campo técnico com uma explicação simples que abre ao tocar. */
export function Campo({
  nome,
  ajuda,
  children,
  destaque,
  erro,
}: {
  nome: string;
  ajuda: string;
  children: ReactNode;
  destaque?: boolean;
  erro?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className={`border-b border-borda/60 py-2.5 last:border-0 ${erro ? 'bg-vermelho/10' : ''}`}>
      <button type="button" onClick={() => setAberto(!aberto)} className="flex w-full items-center gap-2 text-left">
        <span className={`text-xs font-semibold tracking-wide uppercase ${erro ? 'text-vermelho' : 'text-slate-400'}`}>{nome}</span>
        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-500 text-[10px] text-slate-400">
          ?
        </span>
      </button>
      {aberto && <p className="mt-1 rounded-lg bg-azul/10 p-2 text-sm text-azul">{ajuda}</p>}
      <div className={`mt-1 ${destaque ? 'font-semibold text-ouro' : ''} ${erro ? 'text-vermelho' : ''}`}>{children}</div>
    </div>
  );
}

export function Hash({ valor, zeros = 0, curtoDemais, className = 'text-sm' }: { valor: string; zeros?: number; curtoDemais?: boolean; className?: string }) {
  const texto = curtoDemais ? curto(valor, 10, 8) : valor;
  const n = Math.min(zeros, [...valor].findIndex((c) => c !== '0') === -1 ? valor.length : [...valor].findIndex((c) => c !== '0'));
  return (
    <span className={`hash ${className}`}>
      <span className="text-verde">{texto.slice(0, n)}</span>
      {texto.slice(n)}
    </span>
  );
}

export function Qr({ texto, tamanho = 220 }: { texto: string; tamanho?: number }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(texto, { width: tamanho * 2, margin: 1, color: { dark: '#0b1020', light: '#ffffff' } }).then(setSrc);
  }, [texto, tamanho]);
  return src ? (
    <img src={src} width={tamanho} height={tamanho} alt="QR code" className="rounded-xl bg-white p-2" />
  ) : (
    <div style={{ width: tamanho, height: tamanho }} className="rounded-xl bg-white/10" />
  );
}

export function Nome({ apelido, endereco }: { apelido: string | null; endereco: string }) {
  if (endereco === 'SISTEMA') return <span className="text-slate-400">Sistema (emissão)</span>;
  return (
    <span>
      {apelido ?? 'desconhecido'} <span className="hash text-xs text-slate-500">{curto(endereco)}</span>
    </span>
  );
}

const rotuloTipo = { transferencia: 'Transferência', faucet: 'Saldo inicial', recompensa: 'Recompensa do bloco' } as const;

export function LinhaTx({ t, bloco, minha }: { t: TxPublica; bloco?: number | null; minha?: string }) {
  const entrada = minha ? t.para === minha : null;
  return (
    <a href={`#/tx/${t.id}`} className="flex items-center gap-3 border-b border-borda/60 py-3 last:border-0 hover:bg-white/5">
      <div className="min-w-0 flex-1">
        <div className="text-sm">
          {t.tipo === 'transferencia' ? (
            <>
              <b>{t.apelidoDe ?? curto(t.de)}</b> → <b>{t.apelidoPara ?? curto(t.para)}</b>
            </>
          ) : (
            <>
              {rotuloTipo[t.tipo]} → <b>{t.apelidoPara ?? curto(t.para)}</b>
            </>
          )}
        </div>
        <div className="text-xs text-slate-500">
          {dataHora(t.timestamp)} ·{' '}
          {bloco === null ? <span className="text-ouro">aguardando bloco</span> : bloco !== undefined ? `bloco #${bloco}` : null}
        </div>
      </div>
      <div className={`text-right font-semibold ${entrada === null ? '' : entrada ? 'text-verde' : 'text-vermelho'}`}>
        {entrada === false ? '−' : entrada ? '+' : ''}
        {t.valor} OAS
      </div>
    </a>
  );
}

export const ROTULO_TIPO = rotuloTipo;

export function Aviso({ tipo, children }: { tipo: 'erro' | 'ok' | 'info'; children: ReactNode }) {
  const cor = { erro: 'border-vermelho/50 bg-vermelho/10 text-vermelho', ok: 'border-verde/50 bg-verde/10 text-verde', info: 'border-azul/50 bg-azul/10 text-azul' }[tipo];
  return <div className={`rounded-xl border p-3 text-sm ${cor}`}>{children}</div>;
}
