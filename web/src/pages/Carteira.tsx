import { useEffect, useState } from 'react';
import { ir, lerCarteira, salvarCarteira, urlBase, useApi, useRota, type TxPublica } from '../lib.ts';
import { Aviso, Botao, Cartao, LinhaTx, Qr } from '../ui.tsx';

interface DadosCarteira {
  apelido: string;
  endereco: string;
  saldoConfirmado: number;
  saldoDisponivel: number;
  congelado: boolean;
  historico: (TxPublica & { bloco: number | null })[];
}

export function Carteira() {
  const carteira = lerCarteira();
  const { params } = useRota();
  const [verChave, setVerChave] = useState(false);
  const [boasVindas, setBoasVindas] = useState(params.has('nova'));
  const { dados, erro } = useApi<DadosCarteira>(carteira ? `/carteiras/${carteira.endereco}` : null);

  useEffect(() => {
    if (!carteira) ir('/cadastro');
  }, [carteira]);
  if (!carteira) return null;

  if (erro?.includes('não cadastrada'))
    return (
      <Cartao className="mt-4 space-y-3">
        <Aviso tipo="info">Esta carteira não existe mais no servidor (a blockchain foi reiniciada para a apresentação).</Aviso>
        <Botao
          className="w-full"
          onClick={() => {
            salvarCarteira(null);
            ir('/cadastro');
          }}
        >
          Criar uma carteira nova
        </Botao>
      </Cartao>
    );

  const linkReceber = `${urlBase()}#/enviar?para=${carteira.endereco}`;
  const pendente = dados ? dados.saldoDisponivel - dados.saldoConfirmado : 0;

  return (
    <div className="space-y-4 pt-2">
      {boasVindas && (
        <Cartao className="entrar border-ouro/50">
          <h2 className="mb-2 text-lg font-bold">Pronto, {carteira.apelido}! O que acabou de acontecer:</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-300">
            <li>
              Seu celular sorteou uma <b>chave privada</b>: um número secreto enorme. Quem tem ela controla o dinheiro.
            </li>
            <li>
              Dela saiu a <b>chave pública</b>, que é o seu <b>endereço</b>. Ela pode ser mostrada para todo mundo.
            </li>
            <li>
              O sistema criou uma transação de <b>100 OAS</b> para você. Ela entra no próximo bloco em alguns segundos.
            </li>
          </ol>
          <Botao tipo="secundario" className="mt-3 w-full" onClick={() => setBoasVindas(false)}>
            Entendi
          </Botao>
        </Cartao>
      )}

      <Cartao className="text-center">
        <div className="text-sm text-slate-400">Saldo de {carteira.apelido}</div>
        <div className="my-1 text-5xl font-bold text-ouro">{dados?.saldoDisponivel ?? '…'} <span className="text-2xl">OAS</span></div>
        {dados && pendente !== 0 && (
          <div className="text-xs text-slate-400">
            {dados.saldoConfirmado} confirmados na blockchain · {pendente > 0 ? '+' : ''}
            {pendente} aguardando o próximo bloco
          </div>
        )}
        {dados?.congelado && (
          <div className="mt-3">
            <Aviso tipo="erro">Carteira congelada pelo regulador (modo DREX). Você não consegue enviar até ser liberada.</Aviso>
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Botao onClick={() => ir('/enviar')}>Enviar</Botao>
          <Botao tipo="secundario" onClick={() => document.getElementById('receber')?.scrollIntoView({ behavior: 'smooth' })}>
            Receber
          </Botao>
        </div>
      </Cartao>

      <Cartao>
        <h2 className="mb-1 font-semibold">Histórico</h2>
        {dados?.historico.length === 0 && <p className="text-sm text-slate-500">Nada ainda.</p>}
        {dados?.historico.map((t) => <LinhaTx key={t.id} t={t} bloco={t.bloco} minha={carteira.endereco} />)}
      </Cartao>

      <Cartao className="text-center" >
        <h2 id="receber" className="mb-1 font-semibold">Receber OAS</h2>
        <p className="mb-3 text-sm text-slate-400">Peça para um colega apontar a câmera para este QR. Abre direto a tela de enviar para você.</p>
        <div className="flex justify-center">
          <Qr texto={linkReceber} />
        </div>
        <div className="mt-3 text-xs text-slate-400">Seu endereço (chave pública)</div>
        <div className="hash text-xs text-slate-300">{carteira.endereco}</div>
      </Cartao>

      <Cartao>
        <button className="text-sm text-slate-400 underline" onClick={() => setVerChave(!verChave)}>
          {verChave ? 'Esconder' : 'Mostrar'} minha chave privada
        </button>
        {verChave && (
          <div className="mt-2 space-y-2">
            <Aviso tipo="erro">
              Numa cripto de verdade, nunca mostre isso a ninguém: quem tiver este número pode gastar todo o seu saldo, e não há banco para
              reverter.
            </Aviso>
            <div className="hash rounded-lg bg-fundo p-2 text-xs">{carteira.chavePrivada}</div>
          </div>
        )}
      </Cartao>
    </div>
  );
}
