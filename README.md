# Vieira Cred — Importação de Propostas com Regras no Banco

Este projeto permite importar uma planilha, ler todas as colunas, preencher automaticamente `id usuario` com base na coluna `equipe_nome` e preencher `id prazo` com base na coluna `tabela`.

As regras não ficam mais salvas no navegador. Agora elas são registradas em duas tabelas do SQL Server:

- `dbo.importacao_regras_equipe_usuario`
- `dbo.importacao_regras_tabela_prazo`

## Estrutura

```txt
api/
  db.js
  importar.js
  regras.js
  regras-service.js
sql/
  criar-tabelas-regras.sql
index.html
package.json
package-lock.json
```

## Variáveis de ambiente necessárias

Configure no Vercel ou no ambiente Node:

```env
IMPORT_PASSWORD=sua_senha_para_importar_e_salvar_regras
SECURITY_KEY=sua_security_key_da_api_destino
API_DESTINO_URL=https://sua-api-destino.com/endpoint

DB_SERVER=servidor_sql
DB_DATABASE=nome_do_banco
DB_USER=usuario_sql
DB_PASSWORD=senha_sql
DB_PORT=1433
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true
```

Use `DB_TRUST_SERVER_CERTIFICATE=true` apenas se o seu SQL Server exigir isso no ambiente atual.

## Instalação

Depois de adicionar a dependência `mssql`, atualize o lockfile:

```bash
npm install
```

Caso o deploy use `npm ci`, rode antes:

```bash
npm install mssql
```

Assim o `package-lock.json` será atualizado com a dependência nova.

## Banco de dados

O sistema cria as tabelas automaticamente quando chama `/api/regras`, desde que o usuário do banco tenha permissão de `CREATE TABLE`.

Se preferir criar manualmente, execute:

```txt
sql/criar-tabelas-regras.sql
```

## Endpoints

### GET `/api/regras`

Lista regras ativas do banco.

### POST `/api/regras`

Salva as regras no banco. Usa a mesma senha do campo `IMPORT_PASSWORD`.

Payload esperado:

```json
{
  "senha": "sua_senha",
  "regrasEquipeUsuario": [
    { "equipe_nome": "PARCEIRO M2", "id_usuario": 1286 }
  ],
  "regrasTabelaPrazo": [
    { "tabela": "404 - PORTABILIDADE + REFINANCIAMENTO", "id_prazo": 2405 }
  ]
}
```

## Fluxo da importação

1. O usuário abre a tela.
2. O sistema carrega as regras do SQL Server.
3. O usuário escolhe uma planilha.
4. O navegador lê as colunas e aplica uma prévia dos IDs.
5. O usuário pode adicionar/editar/remover regras e salvar no banco.
6. Ao importar, o backend lê a planilha novamente.
7. O backend busca as regras do banco e reaplica os IDs antes de enviar para a API destino.

# import-adonis
