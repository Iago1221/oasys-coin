import { Cartao, Titulo } from '../ui.tsx';

const LINHAS: [string, string, string, string][] = [
  ['Quem registra', 'Qualquer nó que minera', 'Instituições autorizadas pelo BC', 'Cada banco, liquidado pelo BC'],
  ['Quem emite', 'O protocolo (regras fixas)', 'BC (real digital) e bancos (depósitos tokenizados)', 'BC e bancos (moeda escritural)'],
  ['Identidade', 'Pseudônima (endereço)', 'Identificada pelos bancos', 'Identificada (CPF, conta)'],
  ['Dá para reverter ou bloquear?', 'Não', 'Sim, por ordem do regulador', 'Sim'],
  ['Valor', 'Oscila, sem lastro', '1 para 1 com o real', 'Real'],
  ['Na OasysCoin', 'Modo cripto', 'Modo DREX', '—'],
];

export function Sobre() {
  return (
    <div className="space-y-4 pt-2">
      <Titulo sub="A mesma ideia de registro compartilhado, com governanças diferentes.">Cripto x DREX x sistema atual</Titulo>
      {LINHAS.map(([tema, cripto, drex, atual]) => (
        <Cartao key={tema}>
          <div className="mb-2 font-semibold">{tema}</div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="text-xs text-ouro">Cripto</div>
              {cripto}
            </div>
            <div>
              <div className="text-xs text-azul">DREX</div>
              {drex}
            </div>
            <div>
              <div className="text-xs text-slate-400">Sistema atual</div>
              {atual}
            </div>
          </div>
        </Cartao>
      ))}
      <Cartao className="text-sm text-slate-300">
        <b>DREX hoje:</b> em 2025 o Banco Central anunciou que a primeira fase do DREX, prevista para 2026, sai sem blockchain, focada em
        registro de garantias para crédito. O uso de tecnologia de registro distribuído ficou para uma fase seguinte, por desafios de
        privacidade e escala.
      </Cartao>
    </div>
  );
}
