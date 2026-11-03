# OasysCoin

Blockchain e criptomoeda didáticas para a apresentação "Sistema financeiro brasileiro: Criptomoeda e DREX".
Os colegas leem um QR code, criam uma carteira no celular, ganham 100 OAS e mandam moedas uns para os outros,
enquanto o telão mostra os blocos sendo minerados ao vivo.

## Telas

| Endereço | Para quê |
| --- | --- |
| `/#/cadastro` | Criar carteira (é para onde o QR do telão aponta) |
| `/#/carteira` | Saldo, histórico, QR para receber, chave privada |
| `/#/enviar` | Escolher um colega, assinar e enviar |
| `/#/blocos` | Explorador: mempool, mineração e a cadeia |
| `/#/bloco/N` e `/#/tx/ID` | Detalhe de um bloco ou de uma transação, com explicação de cada campo |
| `/#/adulterar` | Laboratório: alterar uma transação antiga e ver a cadeia quebrar (cópia local, não afeta a rede) |
| `/#/sobre` | Comparação entre cripto, DREX e o sistema atual |
| `/#/telao` | Tela do projetor. Com `/#/telao?admin` aparecem os controles (pede a `ADMIN_TOKEN`) |

Controles do telão: fechar bloco agora, ligar/desligar o modo DREX, congelar uma carteira (só no modo DREX) e reiniciar tudo.

## Como funciona

- `shared/chain.ts`: o núcleo. SHA-256, assinaturas ECDSA secp256k1 (a curva do Bitcoin), raiz Merkle, prova de trabalho e
  verificação da cadeia. O mesmo código roda no servidor e no celular.
- `server/no.ts`: o nó. Valida transações (assinatura, saldo, repetição), guarda a mempool e fecha um bloco a cada
  `BLOCK_INTERVAL_SECONDS` se houver transações esperando.
  - Modo cripto: prova de trabalho com `DIFFICULTY` zeros, velocidade limitada a `HASHES_PER_SECOND` para dar para ver o nonce subindo.
    O minerador ganha `BLOCK_REWARD` + taxas.
  - Modo DREX: sem mineração. Banco Central, Banco Alfa e Banco Beta se revezam assinando os blocos, e o regulador pode congelar carteiras.
- `server/index.ts`: API REST + WebSocket (Socket.IO) e as telas. O estado fica em `DATA_DIR/estado.json`.
- A chave privada é gerada e guardada só no navegador de cada pessoa (localStorage). O servidor recebe transações já assinadas.

## Rodar no computador

```bash
npm install
npm run dev          # http://localhost:5173 (telas) + API na porta 3000
npm test             # testes do núcleo
npm run simular -- http://localhost:3000 30 3   # 30 colegas simulados, 3 rodadas de envios
```

## Publicar na VPS (Docker)

Pré-requisitos: Docker com o plugin Compose, portas 80 e 443 liberadas no firewall.

1. Copie o projeto para a VPS (git clone ou `scp -r`).
2. Crie o `.env` a partir do exemplo e ajuste:
   ```bash
   cp .env.example .env
   nano .env
   ```
   - Com domínio: `DOMINIO=oasys.seudominio.com.br` e `PUBLIC_URL=https://oasys.seudominio.com.br` (o domínio precisa apontar para o IP da VPS).
   - Sem domínio: use o IP com sslip.io, por exemplo `DOMINIO=203.0.113.10.sslip.io`. Funciona sem configurar nada.
   - Troque `ADMIN_TOKEN`.
3. Suba:
   ```bash
   docker compose up -d --build
   docker compose logs -f app
   ```
4. Abra `https://SEU_DOMINIO/#/telao?admin` no notebook do projetor.

Comandos úteis:

```bash
docker compose restart app                                          # reiniciar
docker compose exec app npx tsx scripts/simular.ts http://localhost:3000 30 3   # teste de carga na VPS
docker compose down && docker volume rm oasys-coin_dados             # apagar tudo (ou use "Reiniciar tudo" no telão)
```

### Sem Docker

Precisa de Node.js 22. Rode atrás do Nginx/Caddy que você já tiver na VPS:

```bash
npm ci && npm run build
ADMIN_TOKEN=sua-senha PUBLIC_URL=https://seu-dominio PORT=3000 npm start
```

O proxy precisa repassar WebSocket (`/socket.io/`).

## Antes da apresentação

- Rode o simulador na VPS com 30 carteiras e confira o telão.
- Clique em "Reiniciar tudo" para começar a aula do zero.
- Teste o link pelo 4G, fora da rede da faculdade.
- Tenha o QR impresso de reserva.
