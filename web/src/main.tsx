import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './estilo.css';
import { ir, lerCarteira, useEstado, useRota } from './lib.ts';
import { Cadastro } from './pages/Cadastro.tsx';
import { Carteira } from './pages/Carteira.tsx';
import { Enviar } from './pages/Enviar.tsx';
import { Blocos, BlocoDetalhe } from './pages/Blocos.tsx';
import { TxDetalhe } from './pages/Transacao.tsx';
import { Adulterar } from './pages/Adulterar.tsx';
import { Telao } from './pages/Telao.tsx';
import { Sobre } from './pages/Sobre.tsx';

function Navegacao({ caminho }: { caminho: string }) {
  const itens = [
    { href: '#/carteira', rotulo: 'Carteira', icone: '👛' },
    { href: '#/enviar', rotulo: 'Enviar', icone: '↗' },
    { href: '#/blocos', rotulo: 'Blocos', icone: '⛓' },
    { href: '#/adulterar', rotulo: 'Adulterar', icone: '🔨' },
    { href: '#/sobre', rotulo: 'Cripto x DREX', icone: '🏦' },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-borda bg-fundo/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-xl">
        {itens.map((i) => {
          const ativo = caminho.startsWith(i.href.slice(1)) || (i.href === '#/blocos' && /^\/(bloco|tx)\//.test(caminho));
          return (
            <a key={i.href} href={i.href} className={`flex flex-1 flex-col items-center py-2 text-[11px] ${ativo ? 'text-ouro' : 'text-slate-400'}`}>
              <span className="text-lg leading-6">{i.icone}</span>
              {i.rotulo}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

function Topo() {
  const estado = useEstado();
  return (
    <header className="mx-auto flex max-w-xl items-center justify-between px-4 pt-4 pb-2">
      <a href="#/carteira" className="flex items-center gap-2 font-bold">
        <img src="/moeda.svg" alt="" className="h-7 w-7" /> OasysCoin
      </a>
      {estado && (
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${estado.modo === 'drex' ? 'bg-azul/20 text-azul' : 'bg-ouro/20 text-ouro'}`}
        >
          {estado.modo === 'drex' ? 'Modo DREX' : 'Modo cripto'} · bloco #{estado.altura}
        </span>
      )}
    </header>
  );
}

function App() {
  const { caminho, params } = useRota();
  const temCarteira = Boolean(lerCarteira());

  useEffect(() => {
    if (caminho === '/') ir(temCarteira ? '/carteira' : '/cadastro');
  }, [caminho, temCarteira]);

  if (caminho === '/telao') return <Telao admin={params.has('admin')} />;

  let pagina;
  const m = caminho.match(/^\/(bloco|tx)\/(.+)$/);
  if (caminho === '/cadastro') pagina = <Cadastro />;
  else if (caminho === '/carteira') pagina = <Carteira />;
  else if (caminho === '/enviar') pagina = <Enviar para={params.get('para')} />;
  else if (caminho === '/blocos') pagina = <Blocos />;
  else if (m?.[1] === 'bloco') pagina = <BlocoDetalhe indice={Number(m[2])} />;
  else if (m?.[1] === 'tx') pagina = <TxDetalhe id={m[2]} />;
  else if (caminho === '/adulterar') pagina = <Adulterar />;
  else if (caminho === '/sobre') pagina = <Sobre />;
  else pagina = null;

  return (
    <div className="min-h-dvh pb-24">
      <Topo />
      <main className="mx-auto max-w-xl px-4">{pagina}</main>
      {caminho !== '/cadastro' && <Navegacao caminho={caminho} />}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
