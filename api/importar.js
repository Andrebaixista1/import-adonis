const { formidable } = require('formidable');
const XLSX = require('xlsx');
const { listarRegras } = require('./regras-service');

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido.'
    });
  }

  try {
    const form = formidable({
      multiples: false,
      maxFileSize: 20 * 1024 * 1024 // 20MB
    });

    const { fields, files } = await parseForm(req, form);

    const senhaDigitada = getFieldValue(fields.senha);
    const observacao = getFieldValue(fields.observacao);
    const regrasFormularioEquipeUsuario = parseJsonArrayField(fields.regrasEquipeUsuario);
    const regrasFormularioTabelaPrazo = parseJsonArrayField(fields.regrasTabelaPrazo);
    const arquivo = Array.isArray(files.arquivo) ? files.arquivo[0] : files.arquivo;

    if (!senhaDigitada) {
      return res.status(400).json({
        success: false,
        message: 'Senha não informada.'
      });
    }

    if (senhaDigitada !== process.env.IMPORT_PASSWORD) {
      return res.status(401).json({
        success: false,
        message: 'Senha inválida.'
      });
    }

    if (!arquivo) {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma planilha enviada.'
      });
    }

    if (!process.env.SECURITY_KEY) {
      return res.status(500).json({
        success: false,
        message: 'SECURITY_KEY não configurada no Vercel.'
      });
    }

    if (!process.env.API_DESTINO_URL) {
      return res.status(500).json({
        success: false,
        message: 'API_DESTINO_URL não configurada no Vercel.'
      });
    }

    const filePath = arquivo.filepath;

    const workbook = XLSX.readFile(filePath, {
      cellDates: false
    });

    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return res.status(400).json({
        success: false,
        message: 'A planilha não possui abas.'
      });
    }

    const sheet = workbook.Sheets[sheetName];

    const records = XLSX.utils.sheet_to_json(sheet, {
      defval: '',
      raw: false
    });

    if (!records.length) {
      return res.status(400).json({
        success: false,
        message: 'A planilha está vazia ou sem dados válidos.'
      });
    }

    const regrasBanco = await carregarRegrasDoBancoComFallback(
      regrasFormularioEquipeUsuario,
      regrasFormularioTabelaPrazo
    );

    const recordsLimpos = records.map(record => {
      const limpo = limparRegistro(record);
      return aplicarMapeamentos(
        limpo,
        regrasBanco.regrasEquipeUsuario,
        regrasBanco.regrasTabelaPrazo
      );
    });

    const resumoMapeamento = gerarResumoMapeamento(recordsLimpos);

    const bodyParaApi = {
      securityKey: process.env.SECURITY_KEY,
      records: recordsLimpos
    };

    if (observacao) {
      bodyParaApi.observacao = observacao;
    }

    const apiResponse = await fetch(process.env.API_DESTINO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyParaApi)
    });

    const responseText = await apiResponse.text();

    console.log('STATUS API DESTINO:', apiResponse.status);
    console.log('TOTAL ENVIADO:', recordsLimpos.length);
    console.log('RESUMO MAPEAMENTO:', resumoMapeamento);

    let responseJson;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = {
        raw: responseText
      };
    }

    const results = montarResultadosImportacao(
      recordsLimpos,
      responseJson,
      apiResponse.ok
    );

    if (!apiResponse.ok) {
      return res.status(apiResponse.status).json({
        success: false,
        message: 'A API destino retornou erro.',
        total: recordsLimpos.length,
        results,
        status: apiResponse.status,
        detalhe: responseJson,
        resumoMapeamento
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Planilha enviada para a API. Confira o retorno em apiResponse.',
      total: recordsLimpos.length,
      results,
      apiResponse: responseJson,
      resumoMapeamento,
      bodyEnviadoResumo: {
        securityKeyEnviada: Boolean(process.env.SECURITY_KEY),
        totalRecords: recordsLimpos.length,
        primeiroRegistroResumo: resumirRegistro(recordsLimpos[0])
      }
    });
  } catch (error) {
    console.error('Erro na importação:', error);

    return res.status(500).json({
      success: false,
      message: 'Erro interno ao processar a planilha.',
      error: error.message
    });
  }
}

module.exports = handler;

module.exports.config = {
  api: {
    bodyParser: false
  }
};

function parseForm(req, form) {
  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) {
        reject(error);
        return;
      }

      resolve({ fields, files });
    });
  });
}

function getFieldValue(value) {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }

  return String(value || '').trim();
}

function parseJsonArrayField(value) {
  const texto = getFieldValue(value);

  if (!texto) return [];

  try {
    const parsed = JSON.parse(texto);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function carregarRegrasDoBancoComFallback(regrasFormularioEquipeUsuario, regrasFormularioTabelaPrazo) {
  try {
    const regras = await listarRegras();

    return {
      regrasEquipeUsuario: regras.regrasEquipeUsuario?.length
        ? regras.regrasEquipeUsuario
        : regrasFormularioEquipeUsuario,
      regrasTabelaPrazo: regras.regrasTabelaPrazo?.length
        ? regras.regrasTabelaPrazo
        : regrasFormularioTabelaPrazo
    };
  } catch (error) {
    console.warn('Não foi possível carregar regras do banco. Usando regras enviadas pelo formulário.', error.message);

    return {
      regrasEquipeUsuario: regrasFormularioEquipeUsuario,
      regrasTabelaPrazo: regrasFormularioTabelaPrazo
    };
  }
}

function limparRegistro(record) {
  const novoRegistro = {};

  Object.keys(record).forEach(key => {
    const chaveLimpa = String(key || '').trim();
    let valor = record[key];

    if (typeof valor === 'string') {
      valor = valor.trim();
    }

    if (chaveLimpa === 'CPF') {
      const cpfLimpo = String(valor || '').replace(/\D/g, '');
      valor = cpfLimpo ? cpfLimpo.padStart(11, '0') : '';
    }

    if (chaveLimpa === 'Telefone') {
      valor = String(valor || '').replace(/\D/g, '');
    }

    if (chaveLimpa === 'CEP') {
      const cepLimpo = String(valor || '').replace(/\D/g, '');
      valor = cepLimpo ? cepLimpo.padStart(8, '0') : '';
    }

    if (chaveLimpa === 'id usuario' || chaveLimpa === 'id prazo' || chaveLimpa === 'Prazo') {
      const numero = Number(String(valor || '').replace(/\D/g, ''));
      valor = Number.isFinite(numero) && String(valor).trim() !== '' ? numero : '';
    }

    novoRegistro[chaveLimpa] = valor;
  });

  return novoRegistro;
}

function aplicarMapeamentos(record, regrasEquipeUsuario, regrasTabelaPrazo) {
  const equipeNome = getPrimeiroValor(record, [
    'equipe_nome',
    'Equipe',
    'Equipe Nome',
    'equipe',
    'EQUIPE_NOME'
  ]);

  const tabela = getPrimeiroValor(record, [
    'tabela',
    'Tabela',
    'TABELA'
  ]);

  const regraUsuario = encontrarRegra(equipeNome, regrasEquipeUsuario, [
    'equipe_nome',
    'equipe',
    'valor',
    'texto'
  ]);

  const regraPrazo = encontrarRegra(tabela, regrasTabelaPrazo, [
    'tabela',
    'valor',
    'texto'
  ]);

  if (regraUsuario) {
    const idUsuario = normalizarNumeroInteiro(regraUsuario.id_usuario ?? regraUsuario['id usuario'] ?? regraUsuario.idUsuario);
    if (idUsuario !== '') {
      record['id usuario'] = idUsuario;
    }
  }

  if (regraPrazo) {
    const idPrazo = normalizarNumeroInteiro(regraPrazo.id_prazo ?? regraPrazo['id prazo'] ?? regraPrazo.idPrazo);
    if (idPrazo !== '') {
      record['id prazo'] = idPrazo;
    }
  }

  return record;
}

function getPrimeiroValor(record, nomesPossiveis) {
  for (const nome of nomesPossiveis) {
    if (Object.prototype.hasOwnProperty.call(record, nome)) {
      return record[nome];
    }
  }

  const chavesNormalizadas = Object.keys(record).reduce((acc, key) => {
    acc[normalizarTexto(key)] = key;
    return acc;
  }, {});

  for (const nome of nomesPossiveis) {
    const chaveEncontrada = chavesNormalizadas[normalizarTexto(nome)];
    if (chaveEncontrada) return record[chaveEncontrada];
  }

  return '';
}

function encontrarRegra(valorOrigem, regras, camposTextoRegra) {
  const origem = normalizarTexto(valorOrigem);

  if (!origem || !Array.isArray(regras)) return null;

  return regras.find(regra => {
    const textoRegra = getPrimeiroValor(regra, camposTextoRegra);
    const regraNormalizada = normalizarTexto(textoRegra);

    if (!regraNormalizada) return false;

    // Prioriza correspondência exata, mas aceita "contém" para casos como
    // equipe_nome = "PARCEIRO M2: EVERTON NUNES" e regra = "PARCEIRO M2".
    return origem === regraNormalizada || origem.includes(regraNormalizada);
  }) || null;
}

function normalizarTexto(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizarNumeroInteiro(value) {
  const numero = Number(String(value ?? '').replace(/\D/g, ''));
  return Number.isFinite(numero) && String(value ?? '').trim() !== '' ? numero : '';
}

function gerarResumoMapeamento(records) {
  return records.reduce(
    (acc, record) => {
      acc.total += 1;

      if (record['id usuario'] !== undefined && record['id usuario'] !== '') {
        acc.comIdUsuario += 1;
      } else {
        acc.semIdUsuario += 1;
      }

      if (record['id prazo'] !== undefined && record['id prazo'] !== '') {
        acc.comIdPrazo += 1;
      } else {
        acc.semIdPrazo += 1;
      }

      return acc;
    },
    {
      total: 0,
      comIdUsuario: 0,
      semIdUsuario: 0,
      comIdPrazo: 0,
      semIdPrazo: 0
    }
  );
}

function montarResultadosImportacao(records, apiResponse, sucessoGeral) {
  const possiveisListas =
    apiResponse?.results ||
    apiResponse?.records ||
    apiResponse?.data ||
    apiResponse?.items ||
    [];

  if (Array.isArray(possiveisListas) && possiveisListas.length) {
    return records.map((record, index) => {
      const retorno = possiveisListas[index] || {};

      return montarResultado(record, retorno, sucessoGeral);
    });
  }

  return records.map(record => montarResultado(record, {}, sucessoGeral));
}

function montarResultado(record, retorno, sucessoGeral) {
  return {
    proposta: record['Nº Contrato'] || record.id || '-',
    cliente: record['Nome'] || '-',
    cpf: record['CPF'] || '-',
    equipe_nome: record.equipe_nome || record.Equipe || '-',
    tabela: record.tabela || record.Tabela || '-',
    id_usuario: record['id usuario'] || '-',
    id_prazo: record['id prazo'] || '-',
    status:
      retorno.status ||
      retorno.situacao ||
      retorno.message ||
      retorno.mensagem ||
      (sucessoGeral ? 'Importado com sucesso' : 'Erro na importação')
  };
}

function resumirRegistro(record = {}) {
  return {
    proposta: record['Nº Contrato'] || record.id || null,
    cliente: record.Nome || null,
    cpf: mascararCpf(record.CPF),
    equipe_nome: record.equipe_nome || record.Equipe || null,
    tabela: record.tabela || record.Tabela || null,
    id_usuario: record['id usuario'] || null,
    id_prazo: record['id prazo'] || null
  };
}

function mascararCpf(cpf) {
  const limpo = String(cpf || '').replace(/\D/g, '');
  if (limpo.length !== 11) return cpf || null;
  return `${limpo.slice(0, 3)}.***.***-${limpo.slice(9)}`;
}
