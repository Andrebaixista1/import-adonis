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
GO

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
GO

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
GO

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
GO
