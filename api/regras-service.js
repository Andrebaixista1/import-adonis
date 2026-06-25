const { sql, getPool } = require('./db');

async function garantirTabelasRegras() {
  const pool = await getPool();

  await pool.request().query(`
    IF OBJECT_ID('dbo.importacao_regras_equipe_usuario', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.importacao_regras_equipe_usuario (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        equipe_nome NVARCHAR(255) NOT NULL,
        id_usuario INT NOT NULL,
        ativo BIT NOT NULL CONSTRAINT DF_importacao_regras_equipe_usuario_ativo DEFAULT (1),
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_importacao_regras_equipe_usuario_created DEFAULT (SYSDATETIME()),
        updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_importacao_regras_equipe_usuario_updated DEFAULT (SYSDATETIME())
      );
    END;

    IF OBJECT_ID('dbo.importacao_regras_tabela_prazo', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.importacao_regras_tabela_prazo (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        tabela NVARCHAR(500) NOT NULL,
        id_prazo INT NOT NULL,
        ativo BIT NOT NULL CONSTRAINT DF_importacao_regras_tabela_prazo_ativo DEFAULT (1),
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_importacao_regras_tabela_prazo_created DEFAULT (SYSDATETIME()),
        updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_importacao_regras_tabela_prazo_updated DEFAULT (SYSDATETIME())
      );
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'IX_importacao_regras_equipe_usuario_ativo'
        AND object_id = OBJECT_ID('dbo.importacao_regras_equipe_usuario')
    )
    BEGIN
      CREATE INDEX IX_importacao_regras_equipe_usuario_ativo
      ON dbo.importacao_regras_equipe_usuario (ativo, equipe_nome);
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'IX_importacao_regras_tabela_prazo_ativo'
        AND object_id = OBJECT_ID('dbo.importacao_regras_tabela_prazo')
    )
    BEGIN
      CREATE INDEX IX_importacao_regras_tabela_prazo_ativo
      ON dbo.importacao_regras_tabela_prazo (ativo, tabela);
    END;
  `);
}

async function listarRegras() {
  await garantirTabelasRegras();
  const pool = await getPool();

  const [equipes, tabelas] = await Promise.all([
    pool.request().query(`
      SELECT id, equipe_nome, id_usuario, ativo, created_at, updated_at
      FROM dbo.importacao_regras_equipe_usuario
      WHERE ativo = 1
      ORDER BY equipe_nome ASC;
    `),
    pool.request().query(`
      SELECT id, tabela, id_prazo, ativo, created_at, updated_at
      FROM dbo.importacao_regras_tabela_prazo
      WHERE ativo = 1
      ORDER BY tabela ASC;
    `)
  ]);

  return {
    regrasEquipeUsuario: equipes.recordset.map(item => ({
      id: item.id,
      equipe_nome: item.equipe_nome,
      id_usuario: item.id_usuario
    })),
    regrasTabelaPrazo: tabelas.recordset.map(item => ({
      id: item.id,
      tabela: item.tabela,
      id_prazo: item.id_prazo
    }))
  };
}

async function salvarRegras(regrasEquipeUsuario, regrasTabelaPrazo) {
  await garantirTabelasRegras();
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  const equipes = normalizarRegrasEquipe(regrasEquipeUsuario);
  const tabelas = normalizarRegrasTabela(regrasTabelaPrazo);

  try {
    await transaction.begin();

    await new sql.Request(transaction).query('DELETE FROM dbo.importacao_regras_equipe_usuario;');
    await new sql.Request(transaction).query('DELETE FROM dbo.importacao_regras_tabela_prazo;');

    for (const regra of equipes) {
      await new sql.Request(transaction)
        .input('equipe_nome', sql.NVarChar(255), regra.equipe_nome)
        .input('id_usuario', sql.Int, regra.id_usuario)
        .query(`
          INSERT INTO dbo.importacao_regras_equipe_usuario (equipe_nome, id_usuario, ativo)
          VALUES (@equipe_nome, @id_usuario, 1);
        `);
    }

    for (const regra of tabelas) {
      await new sql.Request(transaction)
        .input('tabela', sql.NVarChar(500), regra.tabela)
        .input('id_prazo', sql.Int, regra.id_prazo)
        .query(`
          INSERT INTO dbo.importacao_regras_tabela_prazo (tabela, id_prazo, ativo)
          VALUES (@tabela, @id_prazo, 1);
        `);
    }

    await transaction.commit();
  } catch (error) {
    try {
      await transaction.rollback();
    } catch {}

    throw error;
  }

  return listarRegras();
}

function normalizarRegrasEquipe(regras = []) {
  return deduplicarPorTexto(
    regras
      .map(regra => ({
        equipe_nome: String(regra.equipe_nome ?? regra.equipe ?? regra.valor ?? '').trim(),
        id_usuario: toInt(regra.id_usuario ?? regra['id usuario'] ?? regra.idUsuario)
      }))
      .filter(regra => regra.equipe_nome && regra.id_usuario)
  );
}

function normalizarRegrasTabela(regras = []) {
  return deduplicarPorTexto(
    regras
      .map(regra => ({
        tabela: String(regra.tabela ?? regra.valor ?? '').trim(),
        id_prazo: toInt(regra.id_prazo ?? regra['id prazo'] ?? regra.idPrazo)
      }))
      .filter(regra => regra.tabela && regra.id_prazo)
  );
}

function deduplicarPorTexto(regras) {
  const mapa = new Map();

  for (const regra of regras) {
    const texto = normalizarTexto(regra.equipe_nome || regra.tabela);
    mapa.set(texto, regra);
  }

  return Array.from(mapa.values());
}

function normalizarTexto(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function toInt(value) {
  const numero = Number(String(value ?? '').replace(/\D/g, ''));
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

module.exports = {
  garantirTabelasRegras,
  listarRegras,
  salvarRegras
};
