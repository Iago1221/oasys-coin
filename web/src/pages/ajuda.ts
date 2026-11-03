// Explicações curtas de cada campo, mostradas ao tocar no "?".
export const AJUDA = {
  indice: 'A posição do bloco na cadeia. O bloco #0 é o "gênese", o primeiro de todos.',
  timestamp: 'Quando o bloco foi fechado.',
  hashAnterior:
    'A impressão digital (hash) do bloco de trás. É isso que "acorrenta" os blocos: se alguém mexer num bloco antigo, o hash dele muda e este campo deixa de bater.',
  raizMerkle:
    'Um resumo de todas as transações do bloco num único hash. Se qualquer transação mudar, mesmo em 1 centavo, a raiz Merkle muda.',
  nonce:
    'O número que o minerador foi testando (0, 1, 2, …) até o hash do bloco começar com a quantidade exigida de zeros. Achar é trabalhoso; conferir é instantâneo.',
  dificuldade:
    'Quantos zeros o hash precisa ter no começo. Cada zero a mais deixa a mineração ~16 vezes mais difícil. No modo DREX não há mineração: a dificuldade é 0.',
  hash: 'A impressão digital deste bloco: SHA-256 de todo o cabeçalho (índice, data, hash anterior, raiz Merkle, nonce, dificuldade).',
  validador:
    'No modo DREX, só instituições autorizadas pelo Banco Central podem fechar blocos. Elas assinam o hash do bloco com a chave delas, em vez de gastar energia minerando.',
  modo: 'Cripto: qualquer um pode minerar (rede aberta, prova de trabalho). DREX: só participantes autorizados validam (rede permissionada).',
  txId: 'A impressão digital da transação: SHA-256 dos campos de, para, valor, taxa e horário.',
  de: 'O endereço de quem enviou. Na OasysCoin o endereço é a própria chave pública da carteira.',
  para: 'O endereço de quem recebe.',
  valor: 'Quantos OAS foram transferidos.',
  taxa: 'Um valor extra que vai para quem fechar o bloco. Em redes reais, quem paga mais taxa costuma entrar antes.',
  assinatura:
    'Prova matemática (ECDSA secp256k1, a mesma do Bitcoin) de que o dono da chave privada autorizou exatamente esta transação. Qualquer pessoa confere usando só a chave pública.',
  confirmacoes: 'Quantos blocos já existem a partir do bloco desta transação. Quanto mais, mais difícil é desfazer.',
  tipo: 'Transferência é entre pessoas. Saldo inicial e recompensa são moedas novas criadas pelo sistema.',
};
