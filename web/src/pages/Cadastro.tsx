import { useState } from 'react';
import { chavePublicaDe, novaChavePrivada } from '../../../shared/chain.ts';
import { api, ir, lerCarteira, salvarCarteira } from '../lib.ts';
import { Aviso, Botao, Cartao } from '../ui.tsx';

export function Cadastro() {
  const existente = lerCarteira();
  const [apelido, setApelido] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const chavePrivada = novaChavePrivada(); // gerada aqui, no celular
      const endereco = chavePublicaDe(chavePrivada);
      const p = await api<{ apelido: string }>('/cadastro', { corpo: { apelido, endereco } });
      salvarCarteira({ apelido: p.apelido, chavePrivada, endereco });
      ir('/carteira?nova=1');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pt-6">
      <div className="mb-6 text-center">
        <img src="/moeda.svg" alt="" className="mx-auto mb-3 h-20 w-20" />
        <h1 className="text-3xl font-bold">Bem-vindo à OasysCoin</h1>
        <p className="mt-2 text-slate-400">Uma criptomoeda de verdade, só que didática. Crie sua carteira e ganhe 100 OAS para usar na aula.</p>
      </div>

      {existente ? (
        <Cartao className="space-y-3 text-center">
          <p>
            Você já tem uma carteira neste celular: <b>{existente.apelido}</b>.
          </p>
          <Botao onClick={() => ir('/carteira')} className="w-full">
            Abrir minha carteira
          </Botao>
        </Cartao>
      ) : (
        <form onSubmit={criar}>
          <Cartao className="space-y-4">
            <label className="block">
              <span className="text-sm text-slate-400">Seu apelido (é assim que os colegas vão te achar)</span>
              <input
                value={apelido}
                onChange={(e) => setApelido(e.target.value)}
                maxLength={24}
                autoFocus
                placeholder="Ex.: Ana do 3º período"
                className="mt-1 w-full rounded-xl border border-borda bg-fundo px-4 py-3 text-lg outline-none focus:border-ouro"
              />
            </label>
            {erro && <Aviso tipo="erro">{erro}</Aviso>}
            <Botao submit desativado={apelido.trim().length < 2 || enviando} className="w-full text-lg">
              {enviando ? 'Criando…' : 'Criar minha carteira'}
            </Botao>
          </Cartao>
          <p className="mt-4 px-2 text-center text-xs text-slate-500">
            Seu celular vai gerar uma chave privada que nunca sai dele. O servidor só fica sabendo do seu endereço público. Não use dados
            pessoais: o apelido é público para a turma.
          </p>
        </form>
      )}
    </div>
  );
}
