const { listarRegras, salvarRegras } = require('./regras-service');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const regras = await listarRegras();

      return res.status(200).json({
        success: true,
        ...regras
      });
    }

    if (req.method === 'POST') {
      const senha = String(req.body?.senha || '').trim();

      if (!senha) {
        return res.status(400).json({
          success: false,
          message: 'Senha não informada.'
        });
      }

      if (senha !== process.env.IMPORT_PASSWORD) {
        return res.status(401).json({
          success: false,
          message: 'Senha inválida.'
        });
      }

      const regras = await salvarRegras(
        req.body?.regrasEquipeUsuario || [],
        req.body?.regrasTabelaPrazo || []
      );

      return res.status(200).json({
        success: true,
        message: 'Regras salvas no banco de dados.',
        ...regras
      });
    }

    return res.status(405).json({
      success: false,
      message: 'Método não permitido.'
    });
  } catch (error) {
    console.error('Erro na API de regras:', error);

    return res.status(500).json({
      success: false,
      message: 'Erro ao acessar regras no banco de dados.',
      error: error.message
    });
  }
};
