const sql = require('mssql');

let poolPromise = null;

function getDbConfig() {
  const required = ['DB_SERVER', 'DB_DATABASE', 'DB_USER', 'DB_PASSWORD'];
  const missing = required.filter(name => !process.env[name]);

  if (missing.length) {
    throw new Error(`Variáveis de banco ausentes: ${missing.join(', ')}`);
  }

  return {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 1433),
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30000
    },
    options: {
      encrypt: process.env.DB_ENCRYPT !== 'false',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
    }
  };
}

async function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(getDbConfig());
  }

  try {
    return await poolPromise;
  } catch (error) {
    poolPromise = null;
    throw error;
  }
}

module.exports = {
  sql,
  getPool
};
