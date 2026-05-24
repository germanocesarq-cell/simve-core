const ID_PLANILHA = "1eGGyYr4d5ywxzt22iq6eFFTd5GCx5EA4l5MaoKHdy4U";

const ABA_USUARIOS = "USUARIOS";
const ABA_LOG = "LOG_ACESSO";
const ABA_DOCUMENTOS = "DOCUMENTOS";
const ABA_FEEDBACK = "FEEDBACK";
const ABA_HISTORICO_COBERTURA = "HISTORICO_COBERTURA";
const ABA_HISTORICO_DESEMPENHO_ESCOLA = "HISTORICO_DESEMPENHO_ESCOLA";

const MAX_TENTATIVAS = 5;
const MINUTOS_BLOQUEIO = 30;
const HORAS_SESSAO = 6;
const MINUTOS_CODIGO_RECUPERACAO = 20;

const STATUS_SIM = ["SIM", "S", "OK", "APLICADA", "1", "TOMOU", "ATUALIZADO", "EM DIA"];
const STATUS_NAO = ["NÃO", "NAO", "N", "PENDENTE", "EM ATRASO", "NAO TOMOU", "NÃO TOMOU"];
const STATUS_NAO_TEM_IDADE = ["NÃO TEM IDADE", "NAO TEM IDADE", "NAO SE APLICA", "NÃO SE APLICA", "FORA DA FAIXA ETARIA", "FORA DA FAIXA ETÁRIA"];

const CONFIG_BASES = {
  ESCOLAR: {
    sheetName: "BASE_ESCOLAR",
    usaColunaAtraso: false,
    columns: {
      nome: "NOME",
      idade: "IDADE",
      escola: "ESCOLA",
      turma: "TURMA",
      vacinasAtraso: "VACINAS_ATRASO",
      cpf: "CPF",
      endereco: "ENDEREÇO",
      matricula: "MAT."
    },
    vacinas: [
      { key: "hpv", column: "TEM HPV?", label: "HPV", idadeMin: 9, idadeMax: 14 },
      { key: "d1Dengue", column: "TEM D1 DENGUE?", label: "D1 DENGUE", idadeMin: 10, idadeMax: 14 },
      { key: "d2Dengue", column: "TEM D2 DENGUE?", label: "D2 DENGUE", idadeMin: 10, idadeMax: 14 },
      { key: "acwy", column: "TEM ACWY?", label: "ACWY (11 A 14 ANOS)", idadeMin: 11, idadeMax: 14 }
    ]
  },
  INFANTIL: {
    sheetName: "BASE_INFANTIL",
    usaColunaAtraso: false,
    columns: {
      nome: "NOME",
      idade: "IDADE",
      escola: "ESCOLA",
      turma: "TURMA",
      vacinasAtraso: "VACINAS_ATRASO",
      cpf: "CPF",
      endereco: "ENDEREÇO",
      matricula: "MAT."
    },
    vacinas: [
      { key: "h1n1", column: "TEM H1N1 A PARTIR DE MARÇO DE 2026?", label: "H1N1" },
      { key: "d1TripliceViral", column: "TEM D1 TRIPLICE VIRAL?", label: "D1 TRÍPLICE VIRAL" },
      { key: "refPnm10", column: "TEM REF. PNM10?", label: "REF. PNM10" },
      { key: "refAcwy", column: "TEM REF. ACWY?", label: "REF. ACWY" },
      { key: "tetra", column: "TEM TETRA?", label: "TETRA" },
      { key: "hepA", column: "TEM HEP.A?", label: "HEP. A" },
      { key: "r1Dtp", column: "TEM R1 DTP?", label: "R1 DTP" },
      { key: "refVip", column: "TEM REF. VIP?", label: "REF. VIP" },
      { key: "r2Dtp", column: "TEM R2 DTP?", label: "R2 DTP" },
      { key: "d2Varicela", column: "TEM D2 VARICELA?", label: "D2 VARICELA" },
      { key: "refFAmarela", column: "TEM REF. F.AMARELA?", label: "REF. F. AMARELA" }
    ]
  }
};


/**
 * ==========================================================
 * MONITORAMENTO DE ACESSOS
 * Aba esperada: LOG_USO_SISTEMA
 * Colunas:
 * DATA_HORA | PERFIL | USUARIO | BASE | ESCOLA | UNIDADE | ACAO | RESULTADO
 * ==========================================================
 */

function garantirAbaLogUsoSistema_() {
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  let aba = ss.getSheetByName("LOG_USO_SISTEMA");

  if (!aba) {
    aba = ss.insertSheet("LOG_USO_SISTEMA");
  }

  if (aba.getLastRow() === 0) {
    aba.getRange(1, 1, 1, 8).setValues([[
      "DATA_HORA",
      "PERFIL",
      "USUARIO",
      "BASE",
      "ESCOLA",
      "UNIDADE",
      "ACAO",
      "RESULTADO"
    ]]);
    aba.setFrozenRows(1);
  }

  return aba;
}

function registrarUsoSistema_(session, acao, escola, unidade, resultado) {
  try {
    const aba = garantirAbaLogUsoSistema_();

    const perfil = session && session.perfil ? session.perfil : "";
    const usuario = session && session.usuario ? session.usuario : "";
    const base = session && session.base ? session.base : "";

    aba.appendRow([
      new Date(),
      perfil,
      usuario,
      base,
      escola || "",
      unidade || "",
      acao || "",
      resultado || "Sucesso"
    ]);

    return true;
  } catch (err) {
    Logger.log("Falha ao registrar uso do sistema: " + err);
    return false;
  }
}

function registrarUsoSistema(token, acao, escola, unidade, resultado) {
  const session = requireSession_(token);
  registrarUsoSistema_(session, acao, escola, unidade, resultado || "Sucesso");
  return { ok: true };
}


/**
 * ==========================================================
 * INÍCIO DINÂMICO POR PERFIL
 * ESCOLA: mostra somente a instituição vinculada ao usuário.
 * UNIDADE: mostra escolas do território da unidade.
 * SAÚDE / SELO UNICEF / IMUNIZAÇÃO: visão municipal.
 * ==========================================================
 */

function getPerfilInicio_(session) {
  const perfil = normalizarTexto_(session && session.perfil ? session.perfil : "");
  if (perfil === "ESCOLA" || perfil === "EDUCACAO" || perfil === "EDUCAÇÃO") return "ESCOLA";
  if (perfil === "UNIDADE" || perfil === "UBS" || perfil === "EQUIPE") return "UNIDADE";
  return "GESTAO";
}

function getUnidadeDoUsuario_(session) {
  const usuario = String(session && session.usuario ? session.usuario : "").trim();
  const perfil = String(session && session.perfil ? session.perfil : "").trim();
  const escolaSession = String(session && session.escola ? session.escola : "").trim();

  // Se já existir no objeto de sessão, usa.
  if (session && session.unidade) return String(session.unidade || "").trim();

  // Tenta pela aba USUARIOS, se houver coluna UNIDADE.
  try {
    const ss = SpreadsheetApp.openById(ID_PLANILHA);
    const sh = ss.getSheetByName(ABA_USUARIOS);
    if (!sh) return "";

    const data = sh.getDataRange().getValues();
    if (data.length < 2) return "";

    const headers = data[0].map(function(h) { return normalizarTexto_(h); });
    const idxUsuario = headers.indexOf("USUARIO");
    const idxUnidade = headers.indexOf("UNIDADE");

    if (idxUsuario === -1 || idxUnidade === -1) return "";

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idxUsuario] || "").trim() === usuario) {
        return String(data[i][idxUnidade] || "").trim();
      }
    }
  } catch (e) {}

  return "";
}

function getEscolasPermitidasInicio_(session) {
  const perfilInicio = getPerfilInicio_(session);
  const mapaEscolaUnidade = getMapaEscolaUnidade_();
  const escolasDaConfig = {};
  Object.keys(mapaEscolaUnidade).forEach(function(k) {
    escolasDaConfig[normalizarTexto_(k)] = {
      escolaNorm: k,
      unidade: mapaEscolaUnidade[k]
    };
  });

  if (perfilInicio === "GESTAO") {
    return null; // null = todas
  }

  if (perfilInicio === "ESCOLA") {
    const escolas = [];

    if (session && Array.isArray(session.escolasPermitidas) && session.escolasPermitidas.length) {
      session.escolasPermitidas.forEach(function(e) {
        if (String(e || "").trim()) escolas.push(String(e).trim());
      });
    }

    if (session && session.escola) escolas.push(String(session.escola).trim());

    return escolas.filter(Boolean);
  }

  if (perfilInicio === "UNIDADE") {
    const unidadeUsuario = normalizarTexto_(getUnidadeDoUsuario_(session));
    if (!unidadeUsuario) return [];

    const escolas = [];
    Object.keys(mapaEscolaUnidade).forEach(function(escolaNorm) {
      const unidade = normalizarTexto_(mapaEscolaUnidade[escolaNorm]);
      if (unidade === unidadeUsuario) {
        escolas.push(escolaNorm);
      }
    });
    return escolas;
  }

  return null;
}

function filtrarDadosPorPerfilInicio_(dados, session) {
  const escolasPermitidas = getEscolasPermitidasInicio_(session);
  if (escolasPermitidas === null) return dados;

  const set = {};
  escolasPermitidas.forEach(function(e) {
    set[normalizarTexto_(e)] = true;
  });

  return dados.filter(function(item) {
    return set[normalizarTexto_(item.escola)] === true;
  });
}

function getDadosVacinaisInicio_() {
  const todos = [];

  Object.keys(CONFIG_BASES).forEach(function(baseKey) {
    const config = CONFIG_BASES[baseKey];
    const rows = lerAbaComoObjetos_(config.sheetName);

    rows.forEach(function(row) {
      const item = padronizarLinhaVacinal_(row, config);
      item.base = baseKey;
      item.configKey = baseKey;
      todos.push(item);
    });
  });

  return todos;
}


/**
 * ==========================================================
 * SITUAÇÃO CADASTRAL DOS ALUNOS — CONTROLE POR PERFIL
 * ESCOLA: somente sua instituição.
 * UNIDADE: escolas vinculadas à unidade na CONFIG_ESCOLA_UNIDADE.
 * SAÚDE/SELO/IMUNIZAÇÃO: todas.
 * ==========================================================
 */

function obterValorCadastralFlex_(row, nomes) {
  nomes = Array.isArray(nomes) ? nomes : [nomes];
  const keys = Object.keys(row || {});
  const mapa = {};

  keys.forEach(function(k) {
    mapa[normalizarTexto_(k)] = k;
  });

  for (let i = 0; i < nomes.length; i++) {
    const alvo = normalizarTexto_(nomes[i]);
    if (mapa[alvo] !== undefined) return row[mapa[alvo]];
  }

  return "";
}

function obterNomeAlunoCadastral_(row, config) {
  return String(obterValorCadastralFlex_(row, [
    config && config.columns ? config.columns.nome : "",
    "NOME",
    "NOME DO ALUNO",
    "ALUNO",
    "ESTUDANTE",
    "NOME COMPLETO",
    "CRIANÇA",
    "CRIANCA"
  ]) || "").trim();
}

function obterEscolaCadastral_(row, config) {
  return String(obterValorCadastralFlex_(row, [
    config && config.columns ? config.columns.escola : "",
    "ESCOLA",
    "NOME DA ESCOLA",
    "INSTITUICAO",
    "INSTITUIÇÃO"
  ]) || "").trim();
}

function obterTurmaCadastral_(row, config) {
  return String(obterValorCadastralFlex_(row, [
    config && config.columns ? config.columns.turma : "",
    "TURMA",
    "SERIE",
    "SÉRIE",
    "ANO",
    "SALA"
  ]) || "").trim();
}

function obterCpfCadastral_(row, config) {
  return String(obterValorCadastralFlex_(row, [
    config && config.columns ? config.columns.cpf : "",
    "CPF",
    "CPF DO ALUNO",
    "DOCUMENTO"
  ]) || "").trim();
}

function obterMatriculaCadastral_(row, config) {
  return String(obterValorCadastralFlex_(row, [
    config && config.columns ? config.columns.matricula : "",
    "MAT.",
    "MAT",
    "MATRICULA",
    "MATRÍCULA",
    "Nº MATRÍCULA",
    "N° MATRÍCULA",
    "NUMERO DE MATRICULA",
    "NÚMERO DE MATRÍCULA"
  ]) || "").trim();
}

function obterEnderecoCadastral_(row, config) {
  return String(obterValorCadastralFlex_(row, [
    config && config.columns ? config.columns.endereco : "",
    "ENDERECO",
    "ENDEREÇO",
    "ENDERECO COMPLETO",
    "ENDEREÇO COMPLETO",
    "LOGRADOURO",
    "RUA"
  ]) || "").trim();
}

function obterIdadeCadastral_(row, config) {
  return String(obterValorCadastralFlex_(row, [
    config && config.columns ? config.columns.idade : "",
    "IDADE",
    "IDADE DO ALUNO"
  ]) || "").trim();
}

function cpfValidoCadastral_(cpf) {
  const nums = String(cpf || "").replace(/\D/g, "");
  if (nums.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(nums)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(nums.charAt(i), 10) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(nums.charAt(9), 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(nums.charAt(i), 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === parseInt(nums.charAt(10), 10);
}

function cpfInvalidoCadastral_(cpf) {
  return !cpfValidoCadastral_(cpf);
}

function formatarCpfCadastral_(cpf) {
  const nums = String(cpf || "").replace(/\D/g, "");
  if (nums.length !== 11) return String(cpf || "").trim();
  return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function mascararCpfCadastral_(cpf) {
  const nums = String(cpf || "").replace(/\D/g, "");
  if (nums.length !== 11) return "";
  return "***." + nums.substring(3, 6) + "." + nums.substring(6, 9) + "-**";
}

function enderecoInvalidoCadastral_(endereco) {
  const txt = String(endereco || "").trim();
  if (!txt) return true;
  const n = normalizarTexto_(txt);
  if (n === "NAO INFORMADO" || n === "NÃO INFORMADO") return true;
  if (txt.length < 5) return true;
  return false;
}

function getDadosCadastraisBase_() {
  const dados = [];

  Object.keys(CONFIG_BASES).forEach(function(baseKey) {
    const config = CONFIG_BASES[baseKey];
    const rows = lerAbaComoObjetos_(config.sheetName);

    rows.forEach(function(row) {
      const nome = obterNomeAlunoCadastral_(row, config);
      const escola = obterEscolaCadastral_(row, config);
      const turma = obterTurmaCadastral_(row, config);
      const cpf = obterCpfCadastral_(row, config);
      const matricula = obterMatriculaCadastral_(row, config);
      const endereco = obterEnderecoCadastral_(row, config);
      const idade = obterIdadeCadastral_(row, config);

      dados.push({
        base: baseKey,
        matricula: matricula,
        nome: nome,
        idade: idade,
        escola: escola || "SEM ESCOLA",
        turma: turma || "SEM TURMA",
        cpf: cpf,
        endereco: endereco,
        semCpf: cpfInvalidoCadastral_(cpf),
        semEndereco: enderecoInvalidoCadastral_(endereco)
      });
    });
  });

  return dados;
}

function filtrarCadastralPorPerfil_(dados, session) {
  dados = Array.isArray(dados) ? dados : [];

  const perfil = normalizarTexto_(session && session.perfil ? session.perfil : "");
  const baseSessao = normalizarTexto_(session && session.base ? session.base : "");

  // ADM / coordenação com base TODAS visualiza todas as escolas.
  if (perfil === "ADM" || baseSessao === "TODAS") {
    return dados;
  }

  // SAÚDE e EDUCAÇÃO seguem a coluna ESCOLA da aba USUARIOS.
  // Para SAÚDE, essa coluna pode conter várias escolas separadas por ponto e vírgula.
  const escolasPermitidas = filtrarEscolasPermitidasNaBase_(session, dados);

  if (!escolasPermitidas || !escolasPermitidas.length) {
    return [];
  }

  const set = {};
  escolasPermitidas.forEach(function(e) {
    set[normalizarTexto_(e)] = true;
  });

  return dados.filter(function(item) {
    return set[normalizarTexto_(item.escola)] === true;
  });
}

function getPainelCadastralAlunos(token, filtros) {
  const session = requireSession_(token);
  filtros = filtros || {};

  const perfilInicio = getPerfilInicio_(session);
  let dados = getDadosCadastraisBase_();
  dados = filtrarCadastralPorPerfil_(dados, session);

  const baseFiltro = String(filtros.base || "TODOS").toUpperCase();
  const escolaFiltro = String(filtros.escola || "TODAS").trim();
  const turmaFiltro = String(filtros.turma || "TODAS").trim();
  const tipoFiltro = String(filtros.tipo || "TODOS").trim();
  const busca = normalizarTexto_(filtros.busca || "");

  if (baseFiltro !== "TODOS" && baseFiltro) {
    dados = dados.filter(function(x) { return String(x.base || "").toUpperCase() === baseFiltro; });
  }

  if (escolaFiltro && normalizarTexto_(escolaFiltro) !== "TODAS") {
    dados = dados.filter(function(x) { return normalizarTexto_(x.escola) === normalizarTexto_(escolaFiltro); });
  }

  if (turmaFiltro && normalizarTexto_(turmaFiltro) !== "TODAS") {
    dados = dados.filter(function(x) { return normalizarTexto_(x.turma) === normalizarTexto_(turmaFiltro); });
  }

  if (busca) {
    dados = dados.filter(function(x) {
      return normalizarTexto_(x.nome).indexOf(busca) !== -1 ||
        normalizarTexto_(x.matricula).indexOf(busca) !== -1;
    });
  }

  const alunosComInconsistencia = dados.map(function(item) {
    const tipos = [];
    if (item.semCpf) tipos.push("Sem CPF");
    if (item.semEndereco) tipos.push("Sem endereço");

    let prioridade = "BAIXA";
    if (item.semCpf && item.semEndereco) prioridade = "ALTA";
    else if (item.semCpf) prioridade = "ALTA";
    else if (item.semEndereco) prioridade = "MÉDIA";

    return Object.assign({}, item, {
      tipo: tipos.join(" e "),
      prioridade: prioridade
    });
  }).filter(function(item) {
    if (!item.tipo) return false;

    const tf = normalizarTexto_(tipoFiltro);
    if (tf === "SEM CPF") return item.semCpf;
    if (tf === "SEM ENDERECO" || tf === "SEM ENDEREÇO") return item.semEndereco;
    if (tf === "SEM CPF E ENDERECO" || tf === "SEM CPF E ENDEREÇO") return item.semCpf && item.semEndereco;

    return true;
  });

  const perfilNormalizado = normalizarTexto_(session && session.perfil ? session.perfil : "");
  const permiteEditarCpfAusente = perfilNormalizado === "EDUCACAO" || perfilNormalizado === "EDUCAÇÃO" || perfilNormalizado === "ADM";
  const permiteAlterarCpfExistente = perfilNormalizado === "ADM";

  alunosComInconsistencia.forEach(function(item) {
    const cpfValido = cpfValidoCadastral_(item.cpf);
    item.cpfMascarado = cpfValido ? mascararCpfCadastral_(item.cpf) : "";
    item.cpfNovo = "";
    item.podeEditarCpf = permiteEditarCpfAusente && (item.semCpf || permiteAlterarCpfExistente);
    item.podeAlterarCpfExistente = permiteAlterarCpfExistente;
    item.motivoBloqueioCpf = item.podeEditarCpf ? "" : (perfilNormalizado === "SAUDE" || perfilNormalizado === "SAÚDE" ? "Perfil SAÚDE não possui permissão para editar CPF." : "CPF já cadastrado ou perfil sem permissão.");
  });

  const totalAlunos = dados.length;
  const semCpf = dados.filter(function(x) { return x.semCpf; }).length;
  const semEndereco = dados.filter(function(x) { return x.semEndereco; }).length;

  const escolasMap = {};
  const turmasMap = {};

  alunosComInconsistencia.forEach(function(item) {
    if (!escolasMap[item.escola]) {
      escolasMap[item.escola] = {
        escola: item.escola,
        total: 0,
        semCpf: 0,
        semEndereco: 0,
        totalAlunos: 0
      };
    }

    escolasMap[item.escola].total++;
    if (item.semCpf) escolasMap[item.escola].semCpf++;
    if (item.semEndereco) escolasMap[item.escola].semEndereco++;

    const chaveTurma = item.turma + "||" + item.escola;
    if (!turmasMap[chaveTurma]) {
      turmasMap[chaveTurma] = {
        turma: item.turma,
        escola: item.escola,
        total: 0
      };
    }
    turmasMap[chaveTurma].total++;
  });

  dados.forEach(function(item) {
    if (escolasMap[item.escola]) escolasMap[item.escola].totalAlunos++;
  });

  const topEscolas = Object.keys(escolasMap).map(function(k) {
    const e = escolasMap[k];
    const percentual = e.totalAlunos ? Number(((e.total / e.totalAlunos) * 100).toFixed(1)) : 0;
    return Object.assign({}, e, { percentual: percentual });
  }).sort(function(a, b) {
    return b.total - a.total;
  }).slice(0, 5);

  const topTurmas = Object.keys(turmasMap).map(function(k) {
    return turmasMap[k];
  }).sort(function(a, b) {
    return b.total - a.total;
  }).slice(0, 5);

  const escolasDisponiveis = {};
  const turmasDisponiveis = {};
  dados.forEach(function(item) {
    escolasDisponiveis[item.escola] = true;
    turmasDisponiveis[item.turma] = true;
  });

  let tituloContexto = "Situação Cadastral dos Alunos";
  if (perfilInicio === "ESCOLA") tituloContexto = "Situação Cadastral da Minha Escola";
  if (perfilInicio === "UNIDADE") tituloContexto = "Situação Cadastral do Território";

  registrarUsoSistema_(session, "Acessou Situação Cadastral", escolaFiltro !== "TODAS" ? escolaFiltro : "", "", "Sucesso");

  return {
    perfilInicio: perfilInicio,
    titulo: tituloContexto,
    atualizadoEm: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss"),
    filtrosDisponiveis: {
      escolas: Object.keys(escolasDisponiveis).sort(),
      turmas: Object.keys(turmasDisponiveis).sort(),
      tipos: ["TODOS", "Sem CPF", "Sem endereço", "Sem CPF e endereço"]
    },
    resumo: {
      totalAlunos: totalAlunos,
      semCpf: semCpf,
      semEndereco: semEndereco,
      totalInconsistencias: alunosComInconsistencia.length
    },
    topEscolas: topEscolas,
    topTurmas: topTurmas,
    lista: alunosComInconsistencia
  };
}



function garantirAbaLogCadastro_() {
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  let aba = ss.getSheetByName("LOG_CADASTRAL");
  if (!aba) aba = ss.insertSheet("LOG_CADASTRAL");
  if (aba.getLastRow() === 0) {
    aba.getRange(1, 1, 1, 12).setValues([[
      "DATA_HORA", "PERFIL", "USUARIO", "ACAO", "BASE", "ESCOLA", "MAT.", "ALUNO", "CPF_ANTERIOR", "CPF_NOVO", "DESTINO", "RESULTADO"
    ]]);
    aba.setFrozenRows(1);
  }
  return aba;
}

function registrarLogCadastro_(session, dados) {
  try {
    const aba = garantirAbaLogCadastro_();
    aba.appendRow([
      new Date(),
      session && session.perfil ? session.perfil : "",
      session && session.usuario ? session.usuario : "",
      dados.acao || "ATUALIZAR_CPF",
      dados.base || "",
      dados.escola || "",
      dados.matricula || "",
      dados.nome || "",
      dados.cpfAnterior || "",
      dados.cpfNovo || "",
      dados.destino || "",
      dados.resultado || ""
    ]);
  } catch (e) {
    Logger.log("Falha ao registrar LOG_CADASTRAL: " + e);
  }
}

function getPlanilhaEscolaDestino_(escola, base) {
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const aba = ss.getSheetByName("CONFIG_PLANILHAS_ESCOLAS");
  if (!aba) {
    throw new Error("Aba CONFIG_PLANILHAS_ESCOLAS não encontrada. Crie essa aba com as colunas ESCOLA, TIPO_BASE, ID_PLANILHA, ABA_ORIGEM, ATIVO, TIPO_PLANILHA e UNIDADE.");
  }

  const data = aba.getDataRange().getValues();
  if (data.length < 2) throw new Error("Aba CONFIG_PLANILHAS_ESCOLAS está vazia.");

  const headers = data[0].map(function(h) { return normalizarTexto_(h); });
  const idxEscola = headers.indexOf("ESCOLA");
  const idxTipoBase = headers.indexOf("TIPO_BASE");
  const idxId = headers.indexOf("ID_PLANILHA");
  const idxAbaOrigem = headers.indexOf("ABA_ORIGEM");
  const idxAtivo = headers.indexOf("ATIVO");
  const idxTipoPlanilha = headers.indexOf("TIPO_PLANILHA");
  const idxUnidade = headers.indexOf("UNIDADE");

  if (idxEscola === -1 || idxId === -1) {
    throw new Error("Aba CONFIG_PLANILHAS_ESCOLAS precisa ter, no mínimo, as colunas ESCOLA e ID_PLANILHA.");
  }

  const escolaNorm = normalizarTexto_(escola);
  const baseNorm = normalizarTexto_(base);

  for (let i = 1; i < data.length; i++) {
    const linhaEscola = String(data[i][idxEscola] || "").trim();
    const linhaTipoBase = idxTipoBase !== -1 ? String(data[i][idxTipoBase] || "").trim() : "";

    if (normalizarTexto_(linhaEscola) !== escolaNorm) continue;

    // Quando existir TIPO_BASE, ele precisa bater com ESCOLAR ou INFANTIL.
    // Isso evita abrir a planilha infantil quando o aluno é da base escolar, e vice-versa.
    if (idxTipoBase !== -1 && linhaTipoBase && normalizarTexto_(linhaTipoBase) !== baseNorm) continue;

    if (idxAtivo !== -1) {
      const ativo = normalizarTexto_(data[i][idxAtivo]);
      if (ativo && ativo !== "SIM" && ativo !== "S" && ativo !== "ATIVO") {
        throw new Error("A planilha dessa escola está marcada como inativa na CONFIG_PLANILHAS_ESCOLAS.");
      }
    }

    const idPlanilha = String(data[i][idxId] || "").trim();
    const abaOrigem = idxAbaOrigem !== -1 ? String(data[i][idxAbaOrigem] || "").trim() : "BASE_GERAL";

    return {
      escola: linhaEscola,
      tipoBase: linhaTipoBase || String(base || "").toUpperCase(),
      spreadsheetId: idPlanilha,
      sheetName: abaOrigem || "BASE_GERAL",
      tipoPlanilha: idxTipoPlanilha !== -1 ? String(data[i][idxTipoPlanilha] || "PADRAO").trim() : "PADRAO",
      unidade: idxUnidade !== -1 ? String(data[i][idxUnidade] || "").trim() : ""
    };
  }

  throw new Error("Não encontrei a escola/base na aba CONFIG_PLANILHAS_ESCOLAS: " + escola + " / " + base);
}

function localizarCabecalhoPlanilhaOrigem_(valores) {
  // Nas planilhas das escolas, o cabeçalho costuma ficar na linha 6 e os dados a partir da linha 7.
  // Mesmo assim, esta função procura o cabeçalho até a linha 10 para evitar quebra se alguma escola variar.
  const limite = Math.min(10, valores.length);

  for (let i = 0; i < limite; i++) {
    const linhaNorm = valores[i].map(function(h) { return normalizarTexto_(h); });
    const temMat = linhaNorm.indexOf("MAT.") !== -1 || linhaNorm.indexOf("MAT") !== -1 || linhaNorm.indexOf("MATRICULA") !== -1 || linhaNorm.indexOf("MATRÍCULA") !== -1;
    const temCpf = linhaNorm.indexOf("CPF") !== -1 || linhaNorm.indexOf("CPF DO ALUNO") !== -1;
    const temNome = linhaNorm.indexOf("NOME") !== -1 || linhaNorm.indexOf("ALUNO") !== -1 || linhaNorm.indexOf("NOME DO ALUNO") !== -1;

    if ((temMat && temCpf) || (temCpf && temNome)) {
      return i;
    }
  }

  return -1;
}

function atualizarCpfNaPlanilhaDaEscola_(payload, cpfNovoFormatado) {
  const destino = getPlanilhaEscolaDestino_(payload.escola, payload.base);
  if (!destino.spreadsheetId) throw new Error("ID_PLANILHA não informado para a escola: " + payload.escola);

  const ssDestino = SpreadsheetApp.openById(destino.spreadsheetId);
  const sh = ssDestino.getSheetByName(destino.sheetName || "BASE_GERAL");

  if (!sh) {
    throw new Error("Aba de origem não encontrada na planilha da escola: " + (destino.sheetName || "BASE_GERAL"));
  }

  const valores = sh.getDataRange().getValues();
  if (valores.length < 2) throw new Error("A planilha da escola não possui dados para localizar a matrícula.");

  const headerIndex = localizarCabecalhoPlanilhaOrigem_(valores);
  if (headerIndex === -1) {
    throw new Error("Não consegui identificar o cabeçalho da planilha da escola. Verifique se existe MAT. e CPF na aba " + sh.getName() + ".");
  }

  const headersNorm = valores[headerIndex].map(function(h) { return normalizarTexto_(h); });
  function idxFlex_(nomes) {
    for (let i = 0; i < nomes.length; i++) {
      const idx = headersNorm.indexOf(normalizarTexto_(nomes[i]));
      if (idx !== -1) return idx;
    }
    return -1;
  }

  const idxMat = idxFlex_(["MAT.", "MAT", "MATRICULA", "MATRÍCULA", "Nº MATRÍCULA", "N° MATRÍCULA", "NUMERO DE MATRICULA", "NÚMERO DE MATRÍCULA"]);
  const idxCpf = idxFlex_(["CPF", "CPF DO ALUNO", "DOCUMENTO"]);
  const idxEscola = idxFlex_(["ESCOLA", "NOME DA ESCOLA", "INSTITUICAO", "INSTITUIÇÃO"]);
  const idxNome = idxFlex_(["NOME", "NOME DO ALUNO", "ALUNO", "ESTUDANTE", "NOME COMPLETO", "CRIANÇA", "CRIANCA"]);

  if (idxMat === -1) throw new Error("A planilha da escola não possui coluna MAT.");
  if (idxCpf === -1) throw new Error("A planilha da escola não possui coluna CPF.");

  const matNorm = normalizarTexto_(payload.matricula);
  const escolaNorm = normalizarTexto_(payload.escola);
  const nomeNorm = normalizarTexto_(payload.nome || "");

  let linhaEncontrada = -1;
  let cpfAnterior = "";

  for (let i = headerIndex + 1; i < valores.length; i++) {
    const matLinha = normalizarTexto_(valores[i][idxMat]);
    if (matLinha !== matNorm) continue;

    if (idxEscola !== -1 && escolaNorm && normalizarTexto_(valores[i][idxEscola]) !== escolaNorm) continue;
    if (idxNome !== -1 && nomeNorm && normalizarTexto_(valores[i][idxNome]) !== nomeNorm) continue;

    linhaEncontrada = i + 1;
    cpfAnterior = String(valores[i][idxCpf] || "").trim();
    break;
  }

  if (linhaEncontrada === -1) {
    throw new Error("Aluno não localizado na planilha da escola pela matrícula MAT. informada.");
  }

  sh.getRange(linhaEncontrada, idxCpf + 1).setValue(cpfNovoFormatado);

  return {
    destino: ssDestino.getName() + " / " + sh.getName(),
    linha: linhaEncontrada,
    cpfAnterior: cpfAnterior,
    tipoPlanilha: destino.tipoPlanilha || "PADRAO",
    unidade: destino.unidade || ""
  };
}


function atualizarCpfNaBaseMunicipalEspelho_(payload, cpfNovoFormatado) {
  try {
    const base = String(payload.base || "").toUpperCase();
    if (!CONFIG_BASES[base]) return { ok: false, motivo: "Base municipal inválida" };

    const ss = SpreadsheetApp.openById(ID_PLANILHA);
    const sh = ss.getSheetByName(CONFIG_BASES[base].sheetName);
    if (!sh) return { ok: false, motivo: "Aba municipal não encontrada" };

    const valores = sh.getDataRange().getValues();
    if (valores.length < 2) return { ok: false, motivo: "Base municipal sem dados" };

    const headersNorm = valores[0].map(function(h) { return normalizarTexto_(h); });

    function idxFlex_(nomes) {
      for (let i = 0; i < nomes.length; i++) {
        const idx = headersNorm.indexOf(normalizarTexto_(nomes[i]));
        if (idx !== -1) return idx;
      }
      return -1;
    }

    const idxMat = idxFlex_(["MAT.", "MAT", "MATRICULA", "MATRÍCULA", "Nº MATRÍCULA", "N° MATRÍCULA", "NUMERO DE MATRICULA", "NÚMERO DE MATRÍCULA"]);
    const idxCpf = idxFlex_(["CPF", "CPF DO ALUNO", "DOCUMENTO"]);
    const idxEscola = idxFlex_(["ESCOLA", "NOME DA ESCOLA", "INSTITUICAO", "INSTITUIÇÃO"]);
    const idxNome = idxFlex_(["NOME", "NOME DO ALUNO", "ALUNO", "ESTUDANTE", "NOME COMPLETO", "CRIANÇA", "CRIANCA"]);

    if (idxMat === -1 || idxCpf === -1) return { ok: false, motivo: "Colunas MAT./CPF não encontradas na base municipal" };

    const matNorm = normalizarTexto_(payload.matricula);
    const escolaNorm = normalizarTexto_(payload.escola);
    const nomeNorm = normalizarTexto_(payload.nome || "");

    for (let i = 1; i < valores.length; i++) {
      if (normalizarTexto_(valores[i][idxMat]) !== matNorm) continue;
      if (idxEscola !== -1 && escolaNorm && normalizarTexto_(valores[i][idxEscola]) !== escolaNorm) continue;
      if (idxNome !== -1 && nomeNorm && normalizarTexto_(valores[i][idxNome]) !== nomeNorm) continue;

      sh.getRange(i + 1, idxCpf + 1).setValue(cpfNovoFormatado);
      return { ok: true, linha: i + 1, destino: sh.getName() };
    }

    return { ok: false, motivo: "Aluno não localizado na base municipal espelho" };
  } catch (e) {
    Logger.log("Falha ao atualizar CPF na base municipal espelho: " + e);
    return { ok: false, motivo: e.message };
  }
}

function salvarCpfAlunoCadastral(token, payload) {
  const session = requireSession_(token);
  payload = payload || {};

  const perfil = normalizarTexto_(session && session.perfil ? session.perfil : "");
  const podePreencher = perfil === "EDUCACAO" || perfil === "EDUCAÇÃO" || perfil === "ADM";
  const podeAlterarExistente = perfil === "ADM";

  if (!podePreencher) {
    throw new Error("Perfil sem permissão para editar CPF. A Saúde visualiza, mas não altera cadastro.");
  }

  const base = String(payload.base || "").toUpperCase();
  const escola = String(payload.escola || "").trim();
  const matricula = String(payload.matricula || "").trim();
  const nome = String(payload.nome || "").trim();
  const cpfNovo = String(payload.cpfNovo || "").trim();

  if (!base || !CONFIG_BASES[base]) throw new Error("Base inválida para atualização do CPF.");
  if (!escola) throw new Error("Escola não informada.");
  if (!matricula) throw new Error("Matrícula não informada. Não é seguro salvar CPF sem MAT.");
  if (!cpfValidoCadastral_(cpfNovo)) throw new Error("CPF inválido. Confira os 11 dígitos antes de salvar.");

  if (perfil === "EDUCACAO" || perfil === "EDUCAÇÃO") {
    const escolasPermitidas = getEscolasPermitidasInicio_(session) || [];
    const permitido = escolasPermitidas.some(function(e) { return normalizarTexto_(e) === normalizarTexto_(escola); });
    if (!permitido) throw new Error("Você só pode editar alunos da sua própria escola.");
  }

  const dados = filtrarCadastralPorPerfil_(getDadosCadastraisBase_(), session);
  const aluno = dados.find(function(x) {
    return String(x.base || "").toUpperCase() === base &&
      normalizarTexto_(x.escola) === normalizarTexto_(escola) &&
      normalizarTexto_(x.matricula) === normalizarTexto_(matricula);
  });

  if (!aluno) throw new Error("Aluno não encontrado no recorte permitido do usuário.");

  if (!cpfInvalidoCadastral_(aluno.cpf) && !podeAlterarExistente) {
    throw new Error("Este aluno já possui CPF válido. A edição não é permitida para este perfil.");
  }

  const cpfFormatado = formatarCpfCadastral_(cpfNovo);
  const resultado = atualizarCpfNaPlanilhaDaEscola_({
    base: base,
    escola: escola,
    matricula: matricula,
    nome: nome
  }, cpfFormatado);

  registrarLogCadastro_(session, {
    acao: "ATUALIZAR_CPF_ESCOLA",
    base: base,
    escola: escola,
    matricula: matricula,
    nome: nome || aluno.nome,
    cpfAnterior: resultado.cpfAnterior || aluno.cpf || "",
    cpfNovo: cpfFormatado,
    destino: resultado.destino,
    resultado: "Sucesso"
  });

  return {
    ok: true,
    mensagem: "CPF salvo na planilha da escola. A base municipal será atualizada na consolidação diária.",
    cpfMascarado: mascararCpfCadastral_(cpfFormatado),
    destino: resultado.destino,
    municipalAtualizada: false
  };
}


function salvarCpfsAlunosCadastral(token, payloads) {
  const session = requireSession_(token);
  payloads = Array.isArray(payloads) ? payloads : [];

  if (!payloads.length) {
    throw new Error("Nenhum CPF foi enviado para salvamento em lote.");
  }

  if (payloads.length > 300) {
    throw new Error("Envie no máximo 300 CPFs por vez para evitar tempo limite do Apps Script.");
  }

  const perfil = normalizarTexto_(session && session.perfil ? session.perfil : "");
  const podePreencher = perfil === "EDUCACAO" || perfil === "EDUCAÇÃO" || perfil === "ADM";
  if (!podePreencher) {
    throw new Error("Perfil sem permissão para editar CPF. A Saúde visualiza, mas não altera cadastro.");
  }

  const vistos = {};
  const dadosPermitidos = filtrarCadastralPorPerfil_(getDadosCadastraisBase_(), session);

  function chaveAluno_(p) {
    return [String(p.base || "").toUpperCase(), normalizarTexto_(p.escola), normalizarTexto_(p.matricula)].join("|");
  }

  function cpfNumeros_(cpf) {
    return String(cpf || "").replace(/\D/g, "");
  }

  const resultados = [];

  payloads.forEach(function(payload) {
    payload = payload || {};
    const base = String(payload.base || "").toUpperCase();
    const escola = String(payload.escola || "").trim();
    const matricula = String(payload.matricula || "").trim();
    const nome = String(payload.nome || "").trim();
    const cpfNovo = String(payload.cpfNovo || "").trim();
    const cpfNums = cpfNumeros_(cpfNovo);

    const resultadoBase = {
      ok: false,
      base: base,
      escola: escola,
      matricula: matricula,
      nome: nome,
      erro: ""
    };

    try {
      if (!base || !CONFIG_BASES[base]) throw new Error("Base inválida.");
      if (!escola) throw new Error("Escola não informada.");
      if (!matricula) throw new Error("Matrícula não informada.");
      if (!cpfValidoCadastral_(cpfNovo)) throw new Error("CPF inválido.");

      if (vistos[cpfNums]) {
        throw new Error("CPF duplicado no lote enviado.");
      }
      vistos[cpfNums] = true;

      const chaveAtual = chaveAluno_(payload);
      const existeEmOutro = dadosPermitidos.some(function(aluno) {
        const cpfAluno = cpfNumeros_(aluno.cpf || "");
        if (!cpfAluno || cpfAluno !== cpfNums || cpfInvalidoCadastral_(aluno.cpf)) return false;
        return chaveAluno_(aluno) !== chaveAtual;
      });

      if (existeEmOutro) {
        throw new Error("CPF já consta em outro aluno do recorte permitido.");
      }

      const res = salvarCpfAlunoCadastral(token, payload);
      resultados.push(Object.assign({}, resultadoBase, {
        ok: true,
        mensagem: res && res.mensagem ? res.mensagem : "CPF salvo.",
        cpfMascarado: res && res.cpfMascarado ? res.cpfMascarado : mascararCpfCadastral_(cpfNovo),
        destino: res && res.destino ? res.destino : ""
      }));
    } catch (e) {
      registrarLogCadastro_(session, {
        acao: "ATUALIZAR_CPF_LOTE_ERRO",
        base: base,
        escola: escola,
        matricula: matricula,
        nome: nome,
        cpfAnterior: "",
        cpfNovo: cpfNovo,
        destino: "LOTE",
        resultado: e && e.message ? e.message : String(e)
      });
      resultados.push(Object.assign({}, resultadoBase, {
        ok: false,
        erro: e && e.message ? e.message : String(e)
      }));
    }
  });

  const salvos = resultados.filter(function(r) { return r.ok; }).length;
  const erros = resultados.length - salvos;

  return {
    ok: erros === 0,
    mensagem: salvos + " CPF(s) salvo(s)" + (erros ? " e " + erros + " com erro." : "."),
    salvos: salvos,
    erros: erros,
    resultados: resultados
  };
}

function getPainelInicioPorPerfil(token) {
  const session = requireSession_(token);
  const perfilInicio = getPerfilInicio_(session);
  const tz = Session.getScriptTimeZone();

  const todosDados = getDadosVacinaisInicio_();
  const dados = filtrarDadosPorPerfilInicio_(todosDados, session);
  const mapaEscolaUnidade = getMapaEscolaUnidade_();

  function unidadePorEscola_(escola) {
    return mapaEscolaUnidade[normalizarTexto_(escola)] || "SEM UNIDADE INFORMADA";
  }

  const escolasMap = {};
  const unidadesMap = {};
  const vacinasMap = {};
  const turmasMap = {};

  let totalAlunos = dados.length;
  let alunosAtraso = 0;
  let alunosSemInfo = 0;
  let elegiveis = 0;
  let vacinados = 0;

  dados.forEach(function(item) {
    const escola = String(item.escola || "SEM ESCOLA").trim();
    const unidade = unidadePorEscola_(escola);
    escolasMap[normalizarTexto_(escola)] = escola;
    if (normalizarTexto_(unidade) !== "SEM UNIDADE INFORMADA") unidadesMap[normalizarTexto_(unidade)] = unidade;

    if (item.atraso) alunosAtraso++;

    let alunoTemSemInfo = false;

    const config = CONFIG_BASES[item.configKey];
    (config.vacinas || []).forEach(function(vac) {
      const flag = item.coberturaFlags && item.coberturaFlags[vac.key] ? item.coberturaFlags[vac.key] : null;
      if (!flag || !flag.elegivel) return;

      elegiveis++;
      if (flag.tomou) vacinados++;

      if (!vacinasMap[vac.label]) {
        vacinasMap[vac.label] = {
          vacina: vac.label,
          elegiveis: 0,
          vacinados: 0,
          atrasos: 0,
          semInfo: 0
        };
      }

      vacinasMap[vac.label].elegiveis++;

      if (flag.tomou) {
        vacinasMap[vac.label].vacinados++;
      } else {
        vacinasMap[vac.label].atrasos++;
      }

      if (flag.semInfo) {
        vacinasMap[vac.label].semInfo++;
        alunoTemSemInfo = true;
      }
    });

    if (alunoTemSemInfo) alunosSemInfo++;

    if (item.atraso) {
      const turma = String(item.turma || "SEM TURMA").trim();
      if (!turmasMap[turma]) turmasMap[turma] = { turma: turma, atrasos: 0 };
      turmasMap[turma].atrasos++;
    }
  });

  const coberturaGeral = elegiveis > 0 ? Number(((vacinados / elegiveis) * 100).toFixed(1)) : 0;

  const rankingEscolas = [];
  Object.keys(escolasMap).forEach(function(k) {
    const escola = escolasMap[k];
    const dadosEscola = dados.filter(function(x) {
      return normalizarTexto_(x.escola) === normalizarTexto_(escola);
    });

    let e = 0;
    let v = 0;
    let a = 0;
    dadosEscola.forEach(function(item) {
      if (item.atraso) a++;
      const config = CONFIG_BASES[item.configKey];
      (config.vacinas || []).forEach(function(vac) {
        const flag = item.coberturaFlags && item.coberturaFlags[vac.key] ? item.coberturaFlags[vac.key] : null;
        if (!flag || !flag.elegivel) return;
        e++;
        if (flag.tomou) v++;
      });
    });

    rankingEscolas.push({
      escola: escola,
      cobertura: e > 0 ? Number(((v / e) * 100).toFixed(1)) : 0,
      alunosAtraso: a,
      totalAlunos: dadosEscola.length,
      unidade: unidadePorEscola_(escola)
    });
  });

  rankingEscolas.sort(function(a, b) {
    return a.cobertura - b.cobertura;
  });

  const rankingUnidadesMap = {};
  rankingEscolas.forEach(function(item) {
    const u = item.unidade || "SEM UNIDADE INFORMADA";
    if (!rankingUnidadesMap[u]) {
      rankingUnidadesMap[u] = {
        unidade: u,
        escolas: 0,
        alunosAtraso: 0,
        totalAlunos: 0,
        coberturaSoma: 0
      };
    }

    rankingUnidadesMap[u].escolas++;
    rankingUnidadesMap[u].alunosAtraso += item.alunosAtraso;
    rankingUnidadesMap[u].totalAlunos += item.totalAlunos;
    rankingUnidadesMap[u].coberturaSoma += Number(item.cobertura || 0);
  });

  const rankingUnidades = Object.keys(rankingUnidadesMap).map(function(k) {
    const u = rankingUnidadesMap[k];
    return {
      unidade: u.unidade,
      escolas: u.escolas,
      alunosAtraso: u.alunosAtraso,
      totalAlunos: u.totalAlunos,
      cobertura: u.escolas ? Number((u.coberturaSoma / u.escolas).toFixed(1)) : 0
    };
  }).sort(function(a, b) {
    return b.alunosAtraso - a.alunosAtraso;
  });

  const vacinasCriticas = Object.keys(vacinasMap).map(function(k) {
    const x = vacinasMap[k];
    return {
      vacina: x.vacina,
      cobertura: x.elegiveis ? Number(((x.vacinados / x.elegiveis) * 100).toFixed(1)) : 0,
      atrasos: x.atrasos,
      semInfo: x.semInfo,
      elegiveis: x.elegiveis
    };
  }).sort(function(a, b) {
    return a.cobertura - b.cobertura;
  });

  const turmasCriticas = Object.keys(turmasMap).map(function(k) {
    return turmasMap[k];
  }).sort(function(a, b) {
    return b.atrasos - a.atrasos;
  });

  function faixa_(c) {
    if (Number(c || 0) >= 95) return "Boa";
    if (Number(c || 0) >= 85) return "Atenção";
    return "Crítica";
  }

  rankingEscolas.forEach(function(x) { x.situacao = faixa_(x.cobertura); });
  vacinasCriticas.forEach(function(x) { x.situacao = faixa_(x.cobertura); });

  const escolasCriticas = rankingEscolas.filter(function(x) { return Number(x.cobertura || 0) < 85; });

  let titulo = "Início";
  if (perfilInicio === "ESCOLA") titulo = "Início - Minha Escola";
  if (perfilInicio === "UNIDADE") titulo = "Início - Minha Unidade";
  if (perfilInicio === "GESTAO") titulo = "Início - Visão Geral do Município";

  const unidadeUsuario = getUnidadeDoUsuario_(session);

  return {
    atualizadoEm: Utilities.formatDate(new Date(), tz, "dd/MM/yyyy HH:mm:ss"),
    perfilInicio: perfilInicio,
    titulo: titulo,
    subtitulo: perfilInicio === "ESCOLA"
      ? "Acompanhe a situação vacinal da sua instituição."
      : perfilInicio === "UNIDADE"
        ? "Acompanhe a situação vacinal das escolas do seu território."
        : "Acompanhe a situação vacinal de todas as escolas e unidades.",
    contexto: {
      escola: session && session.escola ? session.escola : "",
      unidade: unidadeUsuario || "",
      escolas: Object.keys(escolasMap).length,
      unidades: Object.keys(unidadesMap).length
    },
    resumo: {
      totalAlunos: totalAlunos,
      coberturaGeral: coberturaGeral,
      alunosAtraso: alunosAtraso,
      alunosSemInfo: alunosSemInfo,
      escolasCriticas: escolasCriticas.length,
      unidades: Object.keys(unidadesMap).length,
      escolas: Object.keys(escolasMap).length
    },
    alertas: {
      escolasCriticas: escolasCriticas.length,
      unidadesComPendencia: rankingUnidades.filter(function(x) { return x.alunosAtraso > 0; }).length,
      vacinaMaisCritica: vacinasCriticas.length ? vacinasCriticas[0].vacina : "-",
      vacinaMaisCriticaCobertura: vacinasCriticas.length ? vacinasCriticas[0].cobertura : 0,
      alunosSemInfo: alunosSemInfo
    },
    rankingEscolas: rankingEscolas.slice(0, 5),
    rankingUnidades: rankingUnidades.slice(0, 5),
    vacinasCriticas: vacinasCriticas.slice(0, 5),
    turmasCriticas: turmasCriticas.slice(0, 5),
    acoes: [
      {
        titulo: perfilInicio === "ESCOLA" ? "Atualizar alunos em atraso" : "Focar nas escolas críticas",
        descricao: perfilInicio === "ESCOLA"
          ? alunosAtraso + " aluno(s) precisam de atualização."
          : escolasCriticas.length + " escola(s) abaixo da meta precisam de acompanhamento."
      },
      {
        titulo: "Registrar informações em branco",
        descricao: alunosSemInfo + " aluno(s) com informação vacinal ausente."
      },
      {
        titulo: perfilInicio === "UNIDADE" ? "Apoiar escolas do território" : "Acompanhar ranking",
        descricao: "Verifique os pontos com menor cobertura."
      }
    ]
  };
}


function getPainelMonitoramentoAcessos(token) {
  const session = requireSession_(token);
  if (String(session.perfil || "").toUpperCase() !== "ADM") {
    throw new Error("Acesso restrito ao perfil ADM.");
  }

  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const aba = garantirAbaLogUsoSistema_();
  const tz = Session.getScriptTimeZone();

  const dados = aba.getDataRange().getValues();
  const rows = [];

  if (dados.length > 1) {
    for (let i = 1; i < dados.length; i++) {
      rows.push({
        dataHora: dados[i][0],
        perfil: String(dados[i][1] || "").trim(),
        usuario: String(dados[i][2] || "").trim(),
        base: String(dados[i][3] || "").trim(),
        escola: String(dados[i][4] || "").trim(),
        unidade: String(dados[i][5] || "").trim(),
        acao: String(dados[i][6] || "").trim(),
        resultado: String(dados[i][7] || "").trim()
      });
    }
  }

  const agora = new Date();
  const hojeStr = Utilities.formatDate(agora, tz, "yyyy-MM-dd");
  const limite7 = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const limite15 = new Date(agora.getTime() - 15 * 24 * 60 * 60 * 1000);

  function dataValida_(d) {
    return d instanceof Date && !isNaN(d.getTime());
  }

  function formatarDataHora_(d) {
    if (!dataValida_(d)) return "";
    return Utilities.formatDate(d, tz, "dd/MM/yyyy HH:mm:ss");
  }

  function diasDesde_(d) {
    if (!dataValida_(d)) return null;
    const diff = agora.getTime() - d.getTime();
    return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
  }

  function statusTempo_(d) {
    if (!dataValida_(d)) return { status: "CRÍTICO", texto: "Nunca", dias: null };
    const dias = diasDesde_(d);
    if (dias <= 7) return { status: "OK", texto: dias === 0 ? "Hoje" : dias + " dia(s)", dias: dias };
    if (dias <= 15) return { status: "ALERTA", texto: dias + " dia(s)", dias: dias };
    return { status: "CRÍTICO", texto: dias + " dia(s)", dias: dias };
  }

  function ultimoPorChave_(lista, campo) {
    const mapa = {};
    lista.forEach(function(r) {
      const chave = String(r[campo] || "").trim();
      if (!chave) return;
      if (!mapa[chave] || (dataValida_(r.dataHora) && r.dataHora > mapa[chave].dataHora)) {
        mapa[chave] = r;
      }
    });
    return mapa;
  }

  function listarEscolasBase_() {
    const escolas = {};
    Object.keys(CONFIG_BASES).forEach(function(baseKey) {
      const config = CONFIG_BASES[baseKey];
      const sh = ss.getSheetByName(config.sheetName);
      if (!sh) return;

      const valores = sh.getDataRange().getValues();
      if (valores.length < 2) return;

      const headers = valores[0].map(function(h) { return normalizarTexto_(h); });
      const idxEscola = headers.indexOf(normalizarTexto_(config.columns.escola || "ESCOLA"));
      if (idxEscola === -1) return;

      for (let i = 1; i < valores.length; i++) {
        const escola = String(valores[i][idxEscola] || "").trim();
        if (escola) escolas[normalizarTexto_(escola)] = escola;
      }
    });
    return Object.keys(escolas).map(function(k) { return escolas[k]; }).sort();
  }

  function listarUnidadesConfig_() {
    const mapa = getMapaEscolaUnidade_ ? getMapaEscolaUnidade_() : {};
    const unidades = {};
    Object.keys(mapa).forEach(function(k) {
      const unidade = String(mapa[k] || "").trim();
      if (unidade && normalizarTexto_(unidade) !== "SEM UNIDADE INFORMADA") {
        unidades[normalizarTexto_(unidade)] = unidade;
      }
    });
    return Object.keys(unidades).map(function(k) { return unidades[k]; }).sort();
  }

  const ultimosPorUnidade = ultimoPorChave_(rows.filter(function(r) {
    return String(r.unidade || "").trim();
  }), "unidade");

  const ultimosPorEscola = ultimoPorChave_(rows.filter(function(r) {
    return String(r.escola || "").trim();
  }), "escola");

  const todasUnidades = listarUnidadesConfig_();
  const todasEscolas = listarEscolasBase_();

  function montarSemAcesso_(lista, mapaUltimo, tipo) {
    return lista.map(function(nome) {
      const r = mapaUltimo[nome];
      const d = r ? r.dataHora : null;
      const st = statusTempo_(d);

      return {
        nome: nome,
        tipo: tipo,
        ultimoAcesso: formatarDataHora_(d),
        diasSemAcesso: st.dias,
        tempoTexto: st.texto,
        status: st.status,
        usuario: r ? r.usuario : "",
        acao: r ? r.acao : ""
      };
    }).filter(function(x) {
      return x.status !== "OK";
    }).sort(function(a, b) {
      if (a.diasSemAcesso === null && b.diasSemAcesso !== null) return -1;
      if (b.diasSemAcesso === null && a.diasSemAcesso !== null) return 1;
      return Number(b.diasSemAcesso || 9999) - Number(a.diasSemAcesso || 9999);
    });
  }

  const unidadesSemAcesso = montarSemAcesso_(todasUnidades, ultimosPorUnidade, "Unidade");
  const escolasSemAcesso = montarSemAcesso_(todasEscolas, ultimosPorEscola, "Escola");

  const rowsOrdenados = rows.slice().sort(function(a, b) {
    const da = dataValida_(a.dataHora) ? a.dataHora.getTime() : 0;
    const db = dataValida_(b.dataHora) ? b.dataHora.getTime() : 0;
    return db - da;
  });

  const ultimosAcessos = rowsOrdenados.slice(0, 20).map(function(r) {
    return {
      dataHora: formatarDataHora_(r.dataHora),
      perfil: r.perfil,
      usuario: r.usuario,
      base: r.base,
      escola: r.escola,
      unidade: r.unidade,
      destino: r.unidade || r.escola || "-",
      acao: r.acao,
      resultado: r.resultado || "Sucesso"
    };
  });

  const acessosUltimos7 = rows.filter(function(r) {
    return dataValida_(r.dataHora) && r.dataHora >= limite7;
  });

  const ultimoRegistro = rowsOrdenados.length ? rowsOrdenados[0] : null;

  registrarUsoSistema_(session, "Acessou Monitoramento de Acessos", "", "", "Sucesso");

  return {
    atualizadoEm: Utilities.formatDate(new Date(), tz, "dd/MM/yyyy HH:mm:ss"),
    resumo: {
      ultimoAcesso: ultimoRegistro ? formatarDataHora_(ultimoRegistro.dataHora) : "-",
      ultimoDestino: ultimoRegistro ? (ultimoRegistro.unidade || ultimoRegistro.escola || "-") : "-",
      acessosUltimos7: acessosUltimos7.length,
      unidadesSemAcesso: unidadesSemAcesso.length,
      escolasSemAcesso: escolasSemAcesso.length
    },
    unidadesSemAcesso: unidadesSemAcesso,
    escolasSemAcesso: escolasSemAcesso,
    ultimosAcessos: ultimosAcessos,
    regras: {
      ok: "Até 7 dias",
      alerta: "8 a 15 dias",
      critico: "Mais de 15 dias ou nunca"
    }
  };
}


function doGet() {
  return HtmlService
    .createTemplateFromFile("Index")
    .evaluate()
    .setTitle("Painel Escolar")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(nome) {
  return HtmlService
    .createHtmlOutputFromFile(nome)
    .getContent();
}

/* =========================
   SETUP / SEGURANÇA
========================= */

function inicializarSegurancaUsuarios() {
  const sh = getSheet_(ABA_USUARIOS);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return "Sem usuários.";

  const headers = data[0];
  const idx = mapHeaders_(headers);

  const required = ["SENHA_TEMP", "SENHA_HASH", "SALT", "TENTATIVAS", "PRIMEIRO_ACESSO", "ATIVO"];
  required.forEach(h => {
    if (idx[h] == null) throw new Error(`Coluna obrigatória ausente em USUARIOS: ${h}`);
  });

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const senhaTemp = String(row[idx.SENHA_TEMP] || "").trim();
    const senhaHash = String(row[idx.SENHA_HASH] || "").trim();
    const salt = String(row[idx.SALT] || "").trim();

    if (senhaTemp && (!senhaHash || !salt)) {
      const novoSalt = createSalt_();
      const novoHash = hashPassword_(senhaTemp, novoSalt);

      row[idx.SALT] = novoSalt;
      row[idx.SENHA_HASH] = novoHash;
      row[idx.TENTATIVAS] = 0;
      if (!String(row[idx.PRIMEIRO_ACESSO] || "").trim()) row[idx.PRIMEIRO_ACESSO] = "SIM";
      if (!String(row[idx.ATIVO] || "").trim()) row[idx.ATIVO] = "SIM";
    }
  }

  sh.getRange(2, 1, data.length - 1, headers.length).setValues(data.slice(1));
  return "Segurança inicializada com sucesso.";
}


function montarInicioEscolaNoLogin_(token, sessionData) {
  try {
    if (String(sessionData.perfil || '').toUpperCase() !== 'EDUCACAO') return null;

    const painel = getPainelRankingVacinal(token);
    const escola = String(sessionData.escola || ((sessionData.escolasPermitidas || [])[0] || '')).trim();
    const historico = getHistoricoDesempenhoEscola(token, escola);

    return {
      ranking: painel || null,
      historico: historico || null
    };
  } catch (e) {
    Logger.log('Falha ao montar início da escola no login: ' + e);
    return { erro: String(e && e.message ? e.message : e) };
  }
}

function validarLogin(perfil, usuario, senha) {
  perfil = normalizePerfil_(perfil);
  usuario = String(usuario || "").trim();
  senha = String(senha || "").trim();

  if (!["EDUCACAO", "SAUDE", "ADM"].includes(perfil)) {
    return { ok: false, mensagem: "Perfil inválido." };
  }

  if (!/^\d+$/.test(usuario)) {
    return { ok: false, mensagem: "Usuário deve conter somente números." };
  }

  if (!/^[A-Za-z0-9]+$/.test(senha)) {
    return { ok: false, mensagem: "Senha deve conter apenas letras e números." };
  }

  const userRow = findUserRow_(perfil, usuario);
  if (!userRow) {
    logAcesso_(perfil, usuario, "", "LOGIN_FALHOU_USUARIO");
    return { ok: false, mensagem: "Perfil, usuário ou senha inválidos." };
  }

  const user = userRow.user;
  const rowIndex = userRow.rowIndex;

  if (String(user.ATIVO || "").trim().toUpperCase() !== "SIM") {
    logAcesso_(perfil, usuario, user.ESCOLA || "", "LOGIN_FALHOU_INATIVO");
    return { ok: false, mensagem: "Usuário inativo." };
  }

  if (isBloqueado_(user.BLOQUEADO_ATE)) {
    logAcesso_(perfil, usuario, user.ESCOLA || "", "LOGIN_FALHOU_BLOQUEADO");
    return { ok: false, mensagem: "Usuário temporariamente bloqueado. Tente novamente mais tarde." };
  }

  const primeiroAcesso = String(user.PRIMEIRO_ACESSO || "").trim().toUpperCase() === "SIM";
  const senhaTemp = String(user.SENHA_TEMP || "").trim();
  const salt = String(user.SALT || "").trim();
  const senhaHash = String(user.SENHA_HASH || "").trim();

  /*
   * CORREÇÃO PRINCIPAL:
   * Usuário de primeiro acesso NÃO pode ser bloqueado por falta de SENHA_HASH/SALT.
   * Nesse caso, o sistema valida pela SENHA_TEMP e libera apenas para tela de troca de senha.
   */
  if (primeiroAcesso) {
    if (!senhaTemp) {
      logAcesso_(perfil, usuario, user.ESCOLA || "", "LOGIN_FALHOU_SEM_SENHA_TEMP");
      return {
        ok: false,
        mensagem: "Usuário de primeiro acesso sem senha temporária cadastrada."
      };
    }

    if (senha !== senhaTemp) {
      incrementarTentativaFalha_(rowIndex, user);
      logAcesso_(perfil, usuario, user.ESCOLA || "", "LOGIN_FALHOU_SENHA_TEMP");
      return {
        ok: false,
        mensagem: "Perfil, usuário ou senha inválidos."
      };
    }

    resetTentativas_(rowIndex);

    const escolasPermitidasPrimeiroAcesso = parseEscolasPermitidas_(user.ESCOLA);
    const sessionDataPrimeiroAcesso = {
      perfil: perfil,
      usuario: usuario,
      base: String(user.BASE || "").trim().toUpperCase(),
      escola: escolasPermitidasPrimeiroAcesso.length ? escolasPermitidasPrimeiroAcesso[0] : "",
      escolasPermitidas: escolasPermitidasPrimeiroAcesso,
      primeiroAcesso: true
    };

    const tokenPrimeiroAcesso = createSession_(sessionDataPrimeiroAcesso);
    const inicioEscolaPrimeiroAcesso = montarInicioEscolaNoLogin_(tokenPrimeiroAcesso, sessionDataPrimeiroAcesso);
    logAcesso_(perfil, usuario, user.ESCOLA || "", "LOGIN_OK_PRIMEIRO_ACESSO");

    return {
      ok: true,
      token: tokenPrimeiroAcesso,
      primeiroAcesso: true,
      perfil: sessionDataPrimeiroAcesso.perfil,
      usuario: sessionDataPrimeiroAcesso.usuario,
      base: sessionDataPrimeiroAcesso.base,
      escola: sessionDataPrimeiroAcesso.escola,
      escolasPermitidas: sessionDataPrimeiroAcesso.escolasPermitidas,
      inicioEscola: inicioEscolaPrimeiroAcesso
    };
  }

  /*
   * Usuário que NÃO é primeiro acesso precisa obrigatoriamente ter hash e salt.
   */
  if (!salt || !senhaHash) {
    logAcesso_(perfil, usuario, user.ESCOLA || "", "LOGIN_FALHOU_SEM_SEGURANCA");
    return {
      ok: false,
      mensagem: "Usuário sem configuração de segurança. Execute a inicialização."
    };
  }

  const hashDigitado = hashPassword_(senha, salt);

  if (hashDigitado !== senhaHash) {
    incrementarTentativaFalha_(rowIndex, user);
    logAcesso_(perfil, usuario, user.ESCOLA || "", "LOGIN_FALHOU_SENHA");
    return { ok: false, mensagem: "Perfil, usuário ou senha inválidos." };
  }

  resetTentativas_(rowIndex);

  const escolasPermitidas = parseEscolasPermitidas_(user.ESCOLA);
  const sessionData = {
    perfil: perfil,
    usuario: usuario,
    base: String(user.BASE || "").trim().toUpperCase(),
    escola: escolasPermitidas.length ? escolasPermitidas[0] : "",
    escolasPermitidas: escolasPermitidas,
    primeiroAcesso: false
  };

  const token = createSession_(sessionData);
  const inicioEscolaLogin = montarInicioEscolaNoLogin_(token, sessionData);
  logAcesso_(perfil, usuario, user.ESCOLA || "", "LOGIN_OK");

  return {
    ok: true,
    token: token,
    primeiroAcesso: false,
    perfil: sessionData.perfil,
    usuario: sessionData.usuario,
    base: sessionData.base,
    escola: sessionData.escola,
    escolasPermitidas: sessionData.escolasPermitidas,
    inicioEscola: inicioEscolaLogin
  };
}

function redefinirSenhaPrimeiroAcesso(token, novaSenha, confirmarSenha) {
  const session = requireSession_(token);

  novaSenha = String(novaSenha || "").trim();
  confirmarSenha = String(confirmarSenha || "").trim();

  validarNovaSenha_(novaSenha, confirmarSenha);

  const userRow = findUserRow_(session.perfil, session.usuario);
  if (!userRow) throw new Error("Usuário não encontrado.");

  const salt = createSalt_();
  const senhaHash = hashPassword_(novaSenha, salt);

  const sh = getSheet_(ABA_USUARIOS);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const idx = mapHeaders_(headers);

  sh.getRange(userRow.rowIndex, idx.SALT + 1).setValue(salt);
  sh.getRange(userRow.rowIndex, idx.SENHA_HASH + 1).setValue(senhaHash);
  sh.getRange(userRow.rowIndex, idx.PRIMEIRO_ACESSO + 1).setValue("NAO");
  sh.getRange(userRow.rowIndex, idx.SENHA_TEMP + 1).setValue("");
  sh.getRange(userRow.rowIndex, idx.TENTATIVAS + 1).setValue(0);
  sh.getRange(userRow.rowIndex, idx.BLOQUEADO_ATE + 1).setValue("");

  session.primeiroAcesso = false;
  updateSession_(token, session);

  logAcesso_(session.perfil, session.usuario, session.escolasPermitidas.join("; "), "SENHA_REDEFINIDA_PRIMEIRO_ACESSO");

  return { ok: true };
}

function solicitarRecuperacaoSenha(perfil, usuario) {
  perfil = normalizePerfil_(perfil);
  usuario = String(usuario || "").trim();

  const userRow = findUserRow_(perfil, usuario);
  if (!userRow) {
    logAcesso_(perfil, usuario, "", "RECUPERACAO_FALHOU_USUARIO");
    return { ok: false, mensagem: "Usuário não encontrado." };
  }

  const user = userRow.user;
  const email = String(user.EMAIL_RECUPERACAO || "").trim();
  if (!email) {
    return { ok: false, mensagem: "Usuário sem e-mail de recuperação cadastrado." };
  }

  const codigo = generateRecoveryCode_();
  const expiraEm = new Date(Date.now() + MINUTOS_CODIGO_RECUPERACAO * 60 * 1000);

  const sh = getSheet_(ABA_USUARIOS);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const idx = mapHeaders_(headers);

  sh.getRange(userRow.rowIndex, idx.CODIGO_RECUPERACAO + 1).setValue(codigo);
  sh.getRange(userRow.rowIndex, idx.CODIGO_EXPIRA_EM + 1).setValue(expiraEm);

  const assunto = "Código de recuperação de senha - Painel Escolar";
  const corpo =
    `Olá.\n\n` +
    `Seu código de recuperação é: ${codigo}\n` +
    `Esse código expira em ${MINUTOS_CODIGO_RECUPERACAO} minutos.\n\n` +
    `Se você não solicitou, ignore esta mensagem.`;

  MailApp.sendEmail(email, assunto, corpo);
  logAcesso_(perfil, usuario, user.ESCOLA || "", "RECUPERACAO_SOLICITADA");

  return { ok: true, mensagem: "Código de recuperação enviado para o e-mail cadastrado." };
}

function redefinirSenhaPorCodigo(perfil, usuario, codigo, novaSenha, confirmarSenha) {
  perfil = normalizePerfil_(perfil);
  usuario = String(usuario || "").trim();
  codigo = String(codigo || "").trim();

  validarNovaSenha_(novaSenha, confirmarSenha);

  const userRow = findUserRow_(perfil, usuario);
  if (!userRow) throw new Error("Usuário não encontrado.");

  const user = userRow.user;
  const codigoSalvo = String(user.CODIGO_RECUPERACAO || "").trim();
  const expiraEm = user.CODIGO_EXPIRA_EM ? new Date(user.CODIGO_EXPIRA_EM) : null;

  if (!codigoSalvo || codigo !== codigoSalvo) {
    logAcesso_(perfil, usuario, user.ESCOLA || "", "RECUPERACAO_FALHOU_CODIGO");
    throw new Error("Código inválido.");
  }

  if (!expiraEm || expiraEm.getTime() < Date.now()) {
    logAcesso_(perfil, usuario, user.ESCOLA || "", "RECUPERACAO_FALHOU_EXPIRADO");
    throw new Error("Código expirado.");
  }

  const salt = createSalt_();
  const senhaHash = hashPassword_(novaSenha, salt);

  const sh = getSheet_(ABA_USUARIOS);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const idx = mapHeaders_(headers);

  sh.getRange(userRow.rowIndex, idx.SALT + 1).setValue(salt);
  sh.getRange(userRow.rowIndex, idx.SENHA_HASH + 1).setValue(senhaHash);
  sh.getRange(userRow.rowIndex, idx.PRIMEIRO_ACESSO + 1).setValue("NAO");
  sh.getRange(userRow.rowIndex, idx.CODIGO_RECUPERACAO + 1).setValue("");
  sh.getRange(userRow.rowIndex, idx.CODIGO_EXPIRA_EM + 1).setValue("");
  sh.getRange(userRow.rowIndex, idx.SENHA_TEMP + 1).setValue("");
  sh.getRange(userRow.rowIndex, idx.TENTATIVAS + 1).setValue(0);
  sh.getRange(userRow.rowIndex, idx.BLOQUEADO_ATE + 1).setValue("");

  logAcesso_(perfil, usuario, user.ESCOLA || "", "SENHA_REDEFINIDA_RECUPERACAO");
  return { ok: true, mensagem: "Senha redefinida com sucesso." };
}

function encerrarSessao(token) {
  if (token) {
    CacheService.getScriptCache().remove(token);
  }
  return { ok: true };
}

function getSessionInfo(token) {
  return requireSession_(token);
}

/* =========================
   SITUAÇÃO VACINAL
========================= */

function getDashboardData(token, baseKey, escolaFiltro, turmaFiltro) {
  const session = requireSession_(token);
  const data = obterDadosVacinaisBase_(session, baseKey, escolaFiltro, turmaFiltro);
  return {
    base: baseKey,
    indicadores: data.indicadores,
    graficos: data.graficos,
    filtros: data.filtros,
    tabela: data.tabela,
    atualizadoEm: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
    acesso: data.acesso
  };
}

function exportarListaDirecao(token, baseKey, escolaFiltro, turmaFiltro) {
  try { registrarUsoSistema_(requireSession_(token), "Gerou PDF da lista", escolaFiltro || "", "", "Sucesso"); } catch(e) {}

  const session = requireSession_(token);
  const data = getDashboardData(token, baseKey, escolaFiltro, turmaFiltro);

  if (!escolaFiltro || escolaFiltro === "TODAS") {
    throw new Error("Selecione uma escola específica antes de exportar.");
  }

  const nomeArquivo = `Lista_Direcao_${baseKey}_${sanitizeFileName_(escolaFiltro)}_${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MM-yyyy_HH-mm")}`;
  const temp = SpreadsheetApp.create(nomeArquivo);
  const aba = temp.getSheets()[0];
  aba.setName("Relatório");

  const geradoEm = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
  const turmaTexto = turmaFiltro && turmaFiltro !== "TODAS" ? turmaFiltro : "Todas";

  const linhasTopo = [
    ["SECRETARIA MUNICIPAL DE SAÚDE DE ITAITINGA", "", "", "", "", ""],
    ["MONITORAMENTO DA SITUAÇÃO VACINAL", "", "", "", "", ""],
    ["", "", "", "", "", ""],
    ["Base:", baseKey, "Escola:", escolaFiltro, "Turma:", turmaTexto],
    ["Gerado em:", geradoEm, "Total de alunos em atraso:", String(data.tabela.length), "", ""],
    ["", "", "", "", "", ""]
  ];

  aba.getRange(1, 1, linhasTopo.length, 6).setValues(linhasTopo);

  aba.getRange("A1:F1").merge().setFontWeight("bold").setFontSize(15).setHorizontalAlignment("center");
  aba.getRange("A2:F2").merge().setFontWeight("bold").setFontSize(12).setHorizontalAlignment("center");
  aba.getRange("A4:F4").setFontWeight("bold").setBackground("#edf4ff");
  aba.getRange("A5:F5").setFontWeight("bold").setBackground("#f8fbff");
  aba.getRange("A1:F5").setVerticalAlignment("middle");

  const cabecalho = [["Nome", "CPF", "Idade", "Turma", "Vacinas em atraso"]];
  aba.getRange(7, 1, 1, 5).setValues(cabecalho);
  aba.getRange("A7:E7")
    .setFontWeight("bold")
    .setBackground("#1e88e5")
    .setFontColor("#ffffff")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  const corpo = data.tabela.map(item => [
    item.nome,
    item.cpf || "",
    item.idade,
    item.turma,
    item.vacinasAtraso || ""
  ]);

  if (corpo.length) {
    aba.getRange(8, 1, corpo.length, 5).setValues(corpo);
  }

  const totalLinhasCorpo = Math.max(corpo.length, 1);
  aba.getRange(8, 1, totalLinhasCorpo, 5)
    .setWrap(true)
    .setVerticalAlignment("middle")
    .setFontSize(10);

  aba.getRange(8, 2, totalLinhasCorpo, 1).setHorizontalAlignment("center");
  aba.getRange(8, 3, totalLinhasCorpo, 1).setHorizontalAlignment("center");

  if (corpo.length) {
    aba.getRange(8, 1, corpo.length, 5).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  }

  aba.setColumnWidth(1, 240); // Nome
  aba.setColumnWidth(2, 115); // CPF
  aba.setColumnWidth(3, 55);  // Idade
  aba.setColumnWidth(4, 170); // Turma
  aba.setColumnWidth(5, 330); // Vacinas

  aba.setRowHeight(1, 28);
  aba.setRowHeight(2, 24);
  aba.setRowHeight(4, 24);
  aba.setRowHeight(5, 24);
  aba.setRowHeight(7, 28);

  const ultimaLinha = Math.max(8, 7 + corpo.length);
  aba.getRange(7, 1, ultimaLinha - 6, 5).setBorder(true, true, true, true, true, true, "#d8e2f1", SpreadsheetApp.BorderStyle.SOLID);

  aba.setFrozenRows(7);

  const pdfBlob = exportSheetAsPdfMelhorado_(temp.getId(), aba.getSheetId(), `${nomeArquivo}.pdf`);
  const arquivoPlanilha = DriveApp.getFileById(ID_PLANILHA);
  const pasta = arquivoPlanilha.getParents().hasNext()
    ? arquivoPlanilha.getParents().next()
    : DriveApp.getRootFolder();

  const pdfFile = pasta.createFile(pdfBlob);
  DriveApp.getFileById(temp.getId()).setTrashed(true);

  logAcesso_(session.perfil, session.usuario, escolaFiltro, "EXPORTOU_RELATORIO_VACINAL");

  return { ok: true, url: pdfFile.getUrl(), fileName: pdfFile.getName() };
}

/* =========================
   SITUAÇÃO CADASTRAL
========================= */

function getSituacaoCadastral(token, baseKey, escolaFiltro, turmaFiltro) {
  const session = requireSession_(token);
  validarBase_(baseKey);
  validarAcessoBase_(session, baseKey);

  const config = CONFIG_BASES[baseKey];
  const cols = config.columns;
  const rows = lerAbaComoObjetos_(config.sheetName);

  const dados = rows.map(row => {
    const nome = String(row[cols.nome] || "").trim();
    const idade = row[cols.idade] || "";
    const escola = String(row[cols.escola] || "SEM ESCOLA").trim();
    const turma = String(row[cols.turma] || "SEM TURMA").trim();
    const cpf = String(row[cols.cpf] || "").trim();
    const endereco = String(row[cols.endereco] || "").trim();

    const semCpf = isCpfInconsistente_(cpf);
    const semEndereco = isEnderecoInconsistente_(endereco);

    let tipoInconsistencia = "";
    if (semCpf && semEndereco) tipoInconsistencia = "Sem CPF e sem endereço";
    else if (semCpf) tipoInconsistencia = "Sem CPF";
    else if (semEndereco) tipoInconsistencia = "Sem endereço";

    return { nome, idade, escola, turma, cpf, endereco, semCpf, semEndereco, tipoInconsistencia };
  });

  const escolasPermitidasNaBase = filtrarEscolasPermitidasNaBase_(session, dados);
  const escolaAplicada = normalizarEscolaFiltro_(session, baseKey, escolaFiltro, escolasPermitidasNaBase);

  const filtrados = dados.filter(item => {
    const escolaOk = !escolaAplicada || escolaAplicada === "TODAS" || item.escola === escolaAplicada;
    const turmaOk = !turmaFiltro || turmaFiltro === "TODAS" || item.turma === turmaFiltro;
    const permissaoOk = escolasPermitidasNaBase.includes(item.escola);
    return escolaOk && turmaOk && permissaoOk;
  });

  return {
    indicadores: {
      totalAlunos: filtrados.length,
      alunosSemCpf: filtrados.filter(x => x.semCpf).length,
      alunosSemEndereco: filtrados.filter(x => x.semEndereco).length
    },
    graficos: {
      semCpfPorEscola: agruparContagem_(filtrados.filter(x => x.semCpf), "escola"),
      semCpfPorTurma: agruparContagem_(filtrados.filter(x => x.semCpf), "turma"),
      semEnderecoPorEscola: agruparContagem_(filtrados.filter(x => x.semEndereco), "escola")
    },
    filtros: montarFiltros_(dados.filter(x => escolasPermitidasNaBase.includes(x.escola)), escolaAplicada),
    tabela: filtrados.filter(x => x.semCpf || x.semEndereco),
    acesso: {
      perfil: session.perfil,
      usuario: session.usuario,
      baseTravada: session.perfil === "EDUCACAO",
      escolaTravada: session.perfil === "EDUCACAO",
      escolasPermitidas: escolasPermitidasNaBase
    }
  };
}


function obterDadosVacinaisBase_(session, baseKey, escolaFiltro, turmaFiltro, vacinaFiltro) {
  validarBase_(baseKey);
  validarAcessoBase_(session, baseKey);

  const config = CONFIG_BASES[baseKey];
  const rows = lerAbaComoObjetos_(config.sheetName);
  const dadosPadronizados = rows.map(function(row) { return padronizarLinhaVacinal_(row, config); });

  const escolasPermitidasNaBase = filtrarEscolasPermitidasNaBase_(session, dadosPadronizados);
  const escolaAplicada = normalizarEscolaFiltro_(session, baseKey, escolaFiltro, escolasPermitidasNaBase);
  const turmaAplicada = String(turmaFiltro || "TODAS").trim();

  const dadosFiltrados = dadosPadronizados.filter(function(item) {
    const escolaOk = !escolaAplicada || escolaAplicada === "TODAS" ||
      normalizarTexto_(item.escola) === normalizarTexto_(escolaAplicada);

    const turmaOk = !turmaAplicada || turmaAplicada === "TODAS" ||
      normalizarTexto_(item.turma) === normalizarTexto_(turmaAplicada);

    const permissaoOk = escolasPermitidasNaBase.some(function(escolaPermitida) {
      return normalizarTexto_(escolaPermitida) === normalizarTexto_(item.escola);
    });

    return escolaOk && turmaOk && permissaoOk;
  });

  let tabela = dadosFiltrados.filter(function(x) { return x.atraso; })
    .map(function(x) { return Object.assign({ base: baseKey }, x); });

  const vacinaAplicada = String(vacinaFiltro || "TODAS").trim();
  if (vacinaAplicada && vacinaAplicada !== "TODAS") {
    tabela = tabela.filter(function(item) {
      const vacinas = String(item.vacinasAtraso || "")
        .split(",")
        .map(function(v) { return normalizarTexto_(v); })
        .filter(Boolean);
      return vacinas.indexOf(normalizarTexto_(vacinaAplicada)) !== -1;
    });
  }

  return {
    base: baseKey,
    dadosFiltrados: dadosFiltrados,
    indicadores: montarIndicadoresVacinais_(dadosFiltrados, config),
    graficos: montarGraficosVacinais_(dadosFiltrados, config),
    filtros: montarFiltros_(dadosPadronizados.filter(function(x) {
      return escolasPermitidasNaBase.some(function(escolaPermitida) {
        return normalizarTexto_(escolaPermitida) === normalizarTexto_(x.escola);
      });
    }), escolaAplicada),
    tabela: tabela,
    acesso: {
      perfil: session.perfil,
      usuario: session.usuario,
      baseTravada: session.perfil === "EDUCACAO",
      escolaTravada: false,
      escolasPermitidas: escolasPermitidasNaBase
    }
  };
}

function getEscolasPainelVacinal(token) {
  const session = requireSession_(token);
  const mapa = {};

  ["INFANTIL", "ESCOLAR"].forEach(baseKey => {
    if (session.perfil === "EDUCACAO" && session.base !== baseKey) return;

    const config = CONFIG_BASES[baseKey];
    const rows = lerAbaComoObjetos_(config.sheetName);
    const dadosPadronizados = rows.map(row => padronizarLinhaVacinal_(row, config));
    const escolasPermitidasNaBase = filtrarEscolasPermitidasNaBase_(session, dadosPadronizados);

    escolasPermitidasNaBase.forEach(escola => {
      if (!mapa[escola]) {
        mapa[escola] = {
          nome: escola,
          infantil: false,
          escolar: false
        };
      }
      if (baseKey === "INFANTIL") mapa[escola].infantil = true;
      if (baseKey === "ESCOLAR") mapa[escola].escolar = true;
    });
  });

  return Object.values(mapa).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}


function getPainelVacinalPorEscola(token, escola, segmento, turmaFiltro, vacinaFiltro) {
  try { registrarUsoSistema_(requireSession_(token), "Acessou Situação Vacinal", "", "", "Sucesso"); } catch(e) {}

  const session = requireSession_(token);
  escola = String(escola || "").trim();
  segmento = String(segmento || "TODOS").trim().toUpperCase();
  turmaFiltro = String(turmaFiltro || "TODAS").trim();
  vacinaFiltro = String(vacinaFiltro || "TODAS").trim();

  if (!escola) throw new Error("Selecione uma escola.");

  const metas = getEscolasPainelVacinal(token);
  const meta = metas.find(function(x) {
    return normalizarTexto_(x.nome) === normalizarTexto_(escola);
  });
  if (!meta) throw new Error("Escola não encontrada para este usuário.");

  const escolaCanonica = meta.nome;

  let bases = [];
  if (segmento === "TODOS") {
    if (meta.infantil) bases.push("INFANTIL");
    if (meta.escolar) bases.push("ESCOLAR");
  } else if (segmento === "INFANTIL") {
    if (meta.infantil) bases.push("INFANTIL");
  } else if (segmento === "ESCOLAR") {
    if (meta.escolar) bases.push("ESCOLAR");
  } else {
    throw new Error("Segmento inválido.");
  }

  if (!bases.length) {
    throw new Error("A escola selecionada não possui dados para o segmento informado.");
  }

  const partes = bases.map(function(baseKey) {
    return obterDadosVacinaisBase_(session, baseKey, escolaCanonica, turmaFiltro, vacinaFiltro);
  });

  const totalAlunos = partes.reduce(function(s, p) { return s + Number(p.indicadores.totalAlunos || 0); }, 0);
  const alunosEmAtrasoOriginal = partes.reduce(function(s, p) { return s + Number(p.indicadores.alunosEmAtraso || 0); }, 0);
  const alunosNaoElegiveis = partes.reduce(function(s, p) { return s + Number(p.indicadores.alunosNaoElegiveis || p.indicadores.naoElegiveis || 0); }, 0);
  const alunosElegiveis = Math.max(0, totalAlunos - alunosNaoElegiveis);
  const alunosEmDia = partes.reduce(function(s, p) { return s + Number(p.indicadores.alunosEmDia || p.indicadores.vacinados || 0); }, 0);

  const coberturaGeral = alunosElegiveis > 0
    ? ((alunosEmDia / alunosElegiveis) * 100).toFixed(1)
    : "0.0";

  let tabela = partes
    .flatMap(function(p) { return p.tabela || []; })
    .sort(function(a, b) { return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"); });

  if (vacinaFiltro && vacinaFiltro !== "TODAS") {
    tabela = tabela.filter(function(item) {
      const vacinas = String(item.vacinasAtraso || "")
        .split(",")
        .map(function(v) { return normalizarTexto_(v); })
        .filter(Boolean);
      return vacinas.indexOf(normalizarTexto_(vacinaFiltro)) !== -1;
    });
  }

  const atrasoPorTurmaMap = {};
  tabela.forEach(function(item) {
    const turma = String(item.turma || "SEM TURMA").trim() || "SEM TURMA";
    atrasoPorTurmaMap[turma] = (atrasoPorTurmaMap[turma] || 0) + 1;
  });
  const atrasoPorTurmaEntries = Object.entries(atrasoPorTurmaMap).sort(function(a, b) { return b[1] - a[1]; });

  const parteInfantil = partes.find(function(p) { return p.base === "INFANTIL"; }) || null;
  const parteEscolar = partes.find(function(p) { return p.base === "ESCOLAR"; }) || null;

  const turmas = [...new Set(partes.flatMap(function(p) { return p.filtros.turmas || []; }).filter(Boolean))]
    .sort(function(a, b) { return a.localeCompare(b, "pt-BR"); });

  const vacinasDisponiveis = listarVacinasCoberturaPorSegmento_(segmento);

  const escolasAbaixo80 = [{
    escola: escolaCanonica,
    cobertura: Number(coberturaGeral),
    total: totalAlunos,
    atraso: tabela.length
  }].filter(function(x) { return x.cobertura < 80; });

  const resumoSegmentos = {
    infantil: meta.infantil ? {
      disponivel: true,
      totalAlunos: Number((parteInfantil || { indicadores: {} }).indicadores.totalAlunos || 0),
      alunosEmAtraso: Number((parteInfantil || { indicadores: {} }).indicadores.alunosEmAtraso || 0),
      coberturaGeral: Number((parteInfantil || { indicadores: {} }).indicadores.coberturaGeral || 0),
      alunosEmDia: Number((parteInfantil || { indicadores: {} }).indicadores.alunosEmDia || 0),
      alunosNaoElegiveis: Number((parteInfantil || { indicadores: {} }).indicadores.alunosNaoElegiveis || 0)
    } : { disponivel: false, totalAlunos: 0, alunosEmAtraso: 0, coberturaGeral: 0 },
    escolar: meta.escolar ? {
      disponivel: true,
      totalAlunos: Number((parteEscolar || { indicadores: {} }).indicadores.totalAlunos || 0),
      alunosEmAtraso: Number((parteEscolar || { indicadores: {} }).indicadores.alunosEmAtraso || 0),
      coberturaGeral: Number((parteEscolar || { indicadores: {} }).indicadores.coberturaGeral || 0),
      alunosEmDia: Number((parteEscolar || { indicadores: {} }).indicadores.alunosEmDia || 0),
      alunosNaoElegiveis: Number((parteEscolar || { indicadores: {} }).indicadores.alunosNaoElegiveis || 0)
    } : { disponivel: false, totalAlunos: 0, alunosEmAtraso: 0, coberturaGeral: 0 }
  };

  if (parteInfantil) {
    registrarHistoricoCobertura_(escolaCanonica, "INFANTIL", turmaFiltro, parteInfantil.graficos.coberturaVacinas);
  }

  if (parteEscolar) {
    registrarHistoricoCobertura_(escolaCanonica, "ESCOLAR", turmaFiltro, parteEscolar.graficos.coberturaVacinas);
  }

  const diagnostico = {
    escola: escolaCanonica,
    segmento: segmento,
    basesProcessadas: bases,
    totalPartes: partes.length,
    tabelaAtrasados: tabela.length,
    atrasoPorTurmaLabels: atrasoPorTurmaEntries.map(function(x) { return x[0]; }),
    atrasoPorTurmaValues: atrasoPorTurmaEntries.map(function(x) { return x[1]; }),
    vacinaFiltroAplicado: vacinaFiltro,
    infantil: parteInfantil ? {
      totalAlunos: Number(parteInfantil.indicadores.totalAlunos || 0),
      alunosEmAtraso: Number(parteInfantil.indicadores.alunosEmAtraso || 0),
      turmas: parteInfantil.filtros.turmas || [],
      coberturaLabels: (parteInfantil.graficos.coberturaVacinas.labels || []),
      coberturaValues: (parteInfantil.graficos.coberturaVacinas.values || [])
    } : null,
    escolar: parteEscolar ? {
      totalAlunos: Number(parteEscolar.indicadores.totalAlunos || 0),
      alunosEmAtraso: Number(parteEscolar.indicadores.alunosEmAtraso || 0),
      turmas: parteEscolar.filtros.turmas || [],
      coberturaLabels: (parteEscolar.graficos.coberturaVacinas.labels || []),
      coberturaValues: (parteEscolar.graficos.coberturaVacinas.values || [])
    } : null
  };

  function combinarSituacaoCompleta_(partesSelecionadas) {
    const combinado = {
      labels: [],
      vacinados: [],
      naoVacinados: [],
      semInfo: [],
      denominador: []
    };

    partesSelecionadas.forEach(function(parte) {
      const s = parte && parte.graficos ? parte.graficos.situacaoVacinalCompleta : null;
      if (!s) return;

      (s.labels || []).forEach(function(label, i) {
        combinado.labels.push(label);
        combinado.vacinados.push(Number((s.vacinados || [])[i] || 0));
        combinado.naoVacinados.push(Number((s.naoVacinados || [])[i] || 0));
        combinado.semInfo.push(Number((s.semInfo || [])[i] || 0));
        combinado.denominador.push(Number((s.denominador || [])[i] || 0));
      });
    });

    return combinado;
  }

  const partesSituacao = segmento === "INFANTIL"
    ? [parteInfantil].filter(Boolean)
    : segmento === "ESCOLAR"
      ? [parteEscolar].filter(Boolean)
      : [parteInfantil, parteEscolar].filter(Boolean);

  const situacaoVacinalCompletaConsolidada = combinarSituacaoCompleta_(partesSituacao);

  const alertasQualidadeConsolidados = partesSituacao
    .flatMap(function(parte) {
      return (parte && parte.graficos && parte.graficos.alertasQualidade) || [];
    });


  function montarRankingOperacionalVacinas_(situacao) {
    const ranking = [];
    if (!situacao || !situacao.labels) return ranking;

    (situacao.labels || []).forEach(function(label, i) {
      const den = Number((situacao.denominador || [])[i] || 0);
      const vac = Number((situacao.vacinados || [])[i] || 0);
      const nao = Number((situacao.naoVacinados || [])[i] || 0);
      const sem = Number((situacao.semInfo || [])[i] || 0);

      const cobertura = den > 0 ? Number(((vac / den) * 100).toFixed(1)) : 0;
      const percNao = den > 0 ? Number(((nao / den) * 100).toFixed(1)) : 0;
      const percSem = den > 0 ? Number(((sem / den) * 100).toFixed(1)) : 0;

      let prioridade = "BAIXA";
      if (percSem >= 20 || cobertura < 70) prioridade = "ALTA";
      else if (percSem >= 10 || cobertura < 80) prioridade = "MÉDIA";

      ranking.push({
        vacina: label,
        elegiveis: den,
        vacinados: vac,
        naoVacinados: nao,
        semInfo: sem,
        cobertura: cobertura,
        percNao: percNao,
        percSem: percSem,
        prioridade: prioridade
      });
    });

    return ranking.sort(function(a, b) {
      if (a.prioridade !== b.prioridade) {
        const ordem = { "ALTA": 1, "MÉDIA": 2, "BAIXA": 3 };
        return ordem[a.prioridade] - ordem[b.prioridade];
      }
      return (b.percSem + b.percNao) - (a.percSem + a.percNao);
    });
  }

  const rankingOperacionalVacinas = montarRankingOperacionalVacinas_(situacaoVacinalCompletaConsolidada);


  return {
    escola: escolaCanonica,
    segmento: segmento,
    indicadores: {
      totalAlunos: totalAlunos,
      alunosElegiveis: alunosElegiveis,
      alunosNaoElegiveis: alunosNaoElegiveis,
      naoElegiveis: alunosNaoElegiveis,
      alunosEmDia: alunosEmDia,
      vacinados: alunosEmDia,
      alunosEmAtraso: tabela.length,
      coberturaGeral: coberturaGeral,
      escolasAbaixo80: escolasAbaixo80
    },
    graficos: {
      atrasoPorEscola: { labels: [escolaCanonica], values: [tabela.length] },
      atrasoPorTurma: {
        labels: atrasoPorTurmaEntries.map(function(x) { return x[0]; }),
        values: atrasoPorTurmaEntries.map(function(x) { return x[1]; })
      },
      coberturaVacinas: {
        labels: segmento === "INFANTIL"
          ? ((parteInfantil && parteInfantil.graficos.coberturaVacinas.labels) || [])
          : segmento === "ESCOLAR"
            ? ((parteEscolar && parteEscolar.graficos.coberturaVacinas.labels) || [])
            : [],
        values: segmento === "INFANTIL"
          ? ((parteInfantil && parteInfantil.graficos.coberturaVacinas.values) || [])
          : segmento === "ESCOLAR"
            ? ((parteEscolar && parteEscolar.graficos.coberturaVacinas.values) || [])
            : []
      },
      coberturaVacinasInfantil: parteInfantil
        ? parteInfantil.graficos.coberturaVacinas
        : { labels: [], values: [] },
      coberturaVacinasEscolar: parteEscolar
        ? parteEscolar.graficos.coberturaVacinas
        : { labels: [], values: [] },
      situacaoVacinalCompleta: situacaoVacinalCompletaConsolidada,
      alertasQualidade: alertasQualidadeConsolidados,
      rankingOperacionalVacinas: rankingOperacionalVacinas
    },
    filtros: {
      escolas: metas.map(function(x) { return x.nome; }),
      segmentosDisponiveis: [
        ...(meta.infantil && meta.escolar ? ["TODOS"] : []),
        ...(meta.infantil ? ["INFANTIL"] : []),
        ...(meta.escolar ? ["ESCOLAR"] : [])
      ],
      turmas: turmas,
      vacinasDisponiveis: vacinasDisponiveis
    },
    tabela: tabela,
    atualizadoEm: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
    acesso: {
      perfil: session.perfil,
      usuario: session.usuario,
      escolaTravada: false,
      escolasPermitidas: metas.map(function(x) { return x.nome; })
    },
    resumoSegmentos: resumoSegmentos,
    diagnostico: diagnostico
  };
}

function getDiagnosticoPainelVacinalPorEscola(token, escola, segmento, turmaFiltro, vacinaFiltro) {
  const data = getPainelVacinalPorEscola(token, escola, segmento, turmaFiltro, vacinaFiltro);
  return data.diagnostico || {};
}

function exportarListaDirecaoPorEscola(token, escola, segmento, turmaFiltro, vacinaFiltro) {
  const session = requireSession_(token);
  const data = getPainelVacinalPorEscola(token, escola, segmento, turmaFiltro, vacinaFiltro);

  const nomeArquivo = `Lista_Direcao_${sanitizeFileName_(escola)}_${sanitizeFileName_(segmento)}_${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MM-yyyy_HH-mm")}`;
  const temp = SpreadsheetApp.create(nomeArquivo);
  const aba = temp.getSheets()[0];
  aba.setName("Relatório");

  const geradoEm = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
  const turmaTexto = turmaFiltro && turmaFiltro !== "TODAS" ? turmaFiltro : "Todas";

  const linhasTopo = [
    ["SECRETARIA MUNICIPAL DE SAÚDE DE ITAITINGA", "", "", "", "", ""],
    ["COORDENAÇÃO DE IMUNIZAÇÃO", "", "", "", "", ""],
    ["MONITORAMENTO DA SITUAÇÃO VACINAL", "", "", "", "", ""],
    ["", "", "", "", "", ""],
    ["Escola:", escola, "Segmento:", segmento, "Turma:", turmaTexto],
    ["Gerado em:", geradoEm, "Total de alunos em atraso:", String(data.tabela.length), "", ""],
    ["", "", "", "", "", ""]
  ];

  aba.getRange(1, 1, linhasTopo.length, 6).setValues(linhasTopo);

  aba.getRange("A1:F1").merge().setFontWeight("bold").setFontSize(15).setHorizontalAlignment("center").setFontColor("#16385f");
  aba.getRange("A2:F2").merge().setFontWeight("bold").setFontSize(11).setHorizontalAlignment("center").setFontColor("#2f7be5");
  aba.getRange("A3:F3").merge().setFontWeight("bold").setFontSize(13).setHorizontalAlignment("center").setFontColor("#16385f");
  aba.getRange("A5:F5").setFontWeight("bold").setBackground("#edf4ff").setVerticalAlignment("middle");
  aba.getRange("A6:F6").setFontWeight("bold").setBackground("#f8fbff").setVerticalAlignment("middle");

  const cabecalho = [["Nome", "Base", "CPF", "Idade", "Turma", "Vacinas em atraso"]];
  aba.getRange(9, 1, 1, 6).setValues(cabecalho);
  aba.getRange("A9:F9")
    .setFontWeight("bold")
    .setBackground("#1e88e5")
    .setFontColor("#ffffff")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  const corpo = data.tabela.map(item => [
    item.nome,
    item.base,
    item.cpf || "",
    item.idade,
    item.turma,
    item.vacinasAtraso || ""
  ]);

  if (corpo.length) {
    aba.getRange(10, 1, corpo.length, 6).setValues(corpo);
  }

  const totalLinhasCorpo = Math.max(corpo.length, 1);
  aba.getRange(10, 1, totalLinhasCorpo, 6)
    .setWrap(true)
    .setVerticalAlignment("middle")
    .setFontSize(10);

  aba.getRange(10, 2, totalLinhasCorpo, 3).setHorizontalAlignment("center");

  if (corpo.length) {
    aba.getRange(10, 1, corpo.length, 6).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  }

  aba.setColumnWidth(1, 240);
  aba.setColumnWidth(2, 75);
  aba.setColumnWidth(3, 115);
  aba.setColumnWidth(4, 50);
  aba.setColumnWidth(5, 170);
  aba.setColumnWidth(6, 320);

  const ultimaLinhaTabela = Math.max(10, 9 + corpo.length);
  aba.getRange(9, 1, ultimaLinhaTabela - 8, 6)
    .setBorder(true, true, true, true, true, true, "#d8e2f1", SpreadsheetApp.BorderStyle.SOLID);

  const rodapeInicio = ultimaLinhaTabela + 2;
  const rodape = [
    ["Rua Ester Cavalcante Assunção - SN - Antônio Miguel - CEP: 61881-012", "", "", "", "", ""],
    ["(85) 3513-2091 | saude@itaitinga.ce.gov.br | www.itaitinga.ce.gov.br", "", "", "", "", ""]
  ];
  aba.getRange(rodapeInicio, 1, 2, 6).setValues(rodape);
  aba.getRange(`A${rodapeInicio}:F${rodapeInicio}`).merge().setHorizontalAlignment("center").setFontSize(9).setFontColor("#4b6485");
  aba.getRange(`A${rodapeInicio+1}:F${rodapeInicio+1}`).merge().setHorizontalAlignment("center").setFontSize(9).setFontColor("#4b6485");
  aba.getRange(rodapeInicio - 1, 1, 1, 6).setBackground("#eef3f7");

  aba.setFrozenRows(9);

  const pdfBlob = exportSheetAsPdfMelhorado_(temp.getId(), aba.getSheetId(), `${nomeArquivo}.pdf`);
  const arquivoPlanilha = DriveApp.getFileById(ID_PLANILHA);
  const pasta = arquivoPlanilha.getParents().hasNext()
    ? arquivoPlanilha.getParents().next()
    : DriveApp.getRootFolder();

  const pdfFile = pasta.createFile(pdfBlob);
  DriveApp.getFileById(temp.getId()).setTrashed(true);

  logAcesso_(session.perfil, session.usuario, escola, "EXPORTOU_RELATORIO_VACINAL");

  return { ok: true, url: pdfFile.getUrl(), fileName: pdfFile.getName() };
}

/* =========================
   DOCUMENTOS
========================= */

function getDocumentos(token) {
  const session = requireSession_(token);
  const sh = getSheet_(ABA_DOCUMENTOS);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];

  const idx = mapHeaders_(data[0]);
  const documentos = data.slice(1)
    .map(r => ({
      nome: r[idx.NOME] || "",
      tipo: r[idx.TIPO] || "",
      link: r[idx.LINK] || "",
      ativo: String(r[idx.ATIVO] || "").trim().toUpperCase()
    }))
    .filter(x => x.ativo === "SIM" && x.nome && x.link);

  logAcesso_(session.perfil, session.usuario, session.escolasPermitidas.join("; "), "ABRIU_DOCUMENTOS");
  return documentos;
}

/* =========================
   FEEDBACK
========================= */

function enviarFeedback(token, tipo, mensagem) {
  const session = requireSession_(token);

  tipo = String(tipo || "").trim();
  mensagem = String(mensagem || "").trim();

  if (!tipo) throw new Error("Selecione o tipo.");
  if (!mensagem) throw new Error("Digite a mensagem.");

  const sh = getSheet_(ABA_FEEDBACK);
  sh.appendRow([
    new Date(),
    session.perfil,
    session.usuario,
    session.escolasPermitidas.join("; "),
    tipo,
    mensagem
  ]);

  logAcesso_(session.perfil, session.usuario, session.escolasPermitidas.join("; "), "ENVIOU_FEEDBACK");
  return { ok: true };
}

/* =========================
   FUNÇÕES INTERNAS
========================= */



function exigirPerfilSaude_(token) {
  const session = requireSession_(token);
  if (!session || String(session.perfil || "").toUpperCase() !== "ADM") {
    throw new Error("Acesso não autorizado. Esta ação é restrita ao perfil ADM.");
  }
  return session;
}


function garantirAbaHistoricoCobertura_() {
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  let sh = ss.getSheetByName(ABA_HISTORICO_COBERTURA);

  const cabecalhoNovo = [
    "DATA",
    "DATA_HORA",
    "ESCOLA",
    "SEGMENTO",
    "TURMA",
    "VACINA",
    "COBERTURA",
    "CHAVE"
  ];

  if (!sh) {
    sh = ss.insertSheet(ABA_HISTORICO_COBERTURA);
    sh.getRange(1, 1, 1, cabecalhoNovo.length).setValues([cabecalhoNovo]);
    sh.setFrozenRows(1);
    return sh;
  }

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, cabecalhoNovo.length).setValues([cabecalhoNovo]);
    sh.setFrozenRows(1);
    return sh;
  }

  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h || "").trim());

  // Migração: se a aba antiga não tiver TURMA, insere a coluna TURMA antes de VACINA.
  if (headers.indexOf("TURMA") === -1) {
    const idxVacina = headers.indexOf("VACINA");
    const posInsert = idxVacina >= 0 ? idxVacina + 1 : 5; // 1-based
    sh.insertColumnBefore(posInsert);
    sh.getRange(1, posInsert).setValue("TURMA");

    const ultimaLinha = sh.getLastRow();
    if (ultimaLinha > 1) {
      sh.getRange(2, posInsert, ultimaLinha - 1, 1).setValue("TODAS");
    }
  }

  // Garante cabeçalho final correto.
  sh.getRange(1, 1, 1, cabecalhoNovo.length).setValues([cabecalhoNovo]);
  sh.setFrozenRows(1);

  return sh;
}

function registrarHistoricoCobertura_(escola, segmento, turmaFiltro, graficoCobertura) {
  if (!escola || !segmento || !graficoCobertura) return;

  const labels = graficoCobertura.labels || [];
  const values = graficoCobertura.values || [];

  if (!labels.length) return;

  const turma = String(turmaFiltro || "TODAS").trim() || "TODAS";

  const sh = garantirAbaHistoricoCobertura_();
  const tz = Session.getScriptTimeZone();
  const agora = new Date();
  const dataIso = Utilities.formatDate(agora, tz, "yyyy-MM-dd");
  const dataHora = Utilities.formatDate(agora, tz, "dd/MM/yyyy HH:mm:ss");

  const ultimaLinha = sh.getLastRow();
  const chaves = ultimaLinha > 1
    ? sh.getRange(2, 8, ultimaLinha - 1, 1).getValues().flat().map(v => String(v || "").trim())
    : [];

  const mapaChaves = {};
  chaves.forEach(function(ch, i) {
    if (ch) mapaChaves[ch] = i + 2;
  });

  const vistos = {};

  labels.forEach(function(vacina, i) {
    vacina = String(vacina || "").trim();
    if (!vacina) return;

    const chaveVacina = normalizarTexto_(vacina);
    if (vistos[chaveVacina]) return;
    vistos[chaveVacina] = true;

    const cobertura = Number(values[i] || 0);
    const chave = [
      dataIso,
      normalizarTexto_(escola),
      normalizarTexto_(segmento),
      normalizarTexto_(turma),
      normalizarTexto_(vacina)
    ].join("|");

    const linha = [dataIso, dataHora, escola, segmento, turma, vacina, cobertura, chave];

    if (mapaChaves[chave]) {
      sh.getRange(mapaChaves[chave], 1, 1, 8).setValues([linha]);
    } else {
      sh.appendRow(linha);
    }
  });
}


function criarGatilhoHistoricoCobertura18h(token) {
  exigirPerfilSaude_(token);
  const triggers = ScriptApp.getProjectTriggers();

  triggers.forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === "rotinaHistoricoCoberturaDiario18h") {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("rotinaHistoricoCoberturaDiario18h")
    .timeBased()
    .everyDays(1)
    .atHour(18)
    .create();

  garantirAbaHistoricoCobertura_();

  return {
    ok: true,
    mensagem: "Gatilho automático diário criado para 18h."
  };
}

function excluirGatilhoHistoricoCobertura18h(token) {
  exigirPerfilSaude_(token);
  const triggers = ScriptApp.getProjectTriggers();
  let removidos = 0;

  triggers.forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === "rotinaHistoricoCoberturaDiario18h") {
      ScriptApp.deleteTrigger(t);
      removidos++;
    }
  });

  return {
    ok: true,
    mensagem: removidos ? "Gatilho removido com sucesso." : "Nenhum gatilho diário estava ativo."
  };
}

function rotinaHistoricoCoberturaDiario18h() {
  const resultado = registrarHistoricoCoberturaTodasAsEscolas_();
  Logger.log(JSON.stringify(resultado));
  return resultado;
}

function registrarHistoricoCoberturaTodasAsEscolas_() {
  garantirAbaHistoricoCobertura_();

  let totalRegistros = 0;
  const detalhes = [];

  Object.keys(CONFIG_BASES).forEach(function(baseKey) {
    const config = CONFIG_BASES[baseKey];
    const rows = lerAbaComoObjetos_(config.sheetName);
    const dados = rows.map(function(row) {
      return padronizarLinhaVacinal_(row, config);
    });

    const escolas = [...new Set(
      dados.map(function(x) { return String(x.escola || "").trim(); }).filter(Boolean)
    )].sort(function(a, b) { return a.localeCompare(b, "pt-BR"); });

    escolas.forEach(function(escola) {
      const dadosEscola = dados.filter(function(x) {
        return normalizarTexto_(x.escola) === normalizarTexto_(escola);
      });

      if (!dadosEscola.length) return;

      const graficoEscola = montarGraficosVacinais_(dadosEscola, config).coberturaVacinas;
      registrarHistoricoCobertura_(escola, baseKey, "TODAS", graficoEscola);
      totalRegistros += (graficoEscola.labels || []).length;

      const turmas = [...new Set(
        dadosEscola.map(function(x) { return String(x.turma || "").trim(); }).filter(Boolean)
      )].sort(function(a, b) { return a.localeCompare(b, "pt-BR"); });

      turmas.forEach(function(turma) {
        const dadosTurma = dadosEscola.filter(function(x) {
          return normalizarTexto_(x.turma) === normalizarTexto_(turma);
        });

        if (!dadosTurma.length) return;

        const graficoTurma = montarGraficosVacinais_(dadosTurma, config).coberturaVacinas;
        registrarHistoricoCobertura_(escola, baseKey, turma, graficoTurma);
        totalRegistros += (graficoTurma.labels || []).length;
      });

      detalhes.push({
        base: baseKey,
        escola: escola,
        turmas: turmas.length,
        vacinas: (graficoEscola.labels || []).length
      });
    });
  });

  return {
    ok: true,
    mensagem: "Histórico diário atualizado com sucesso.",
    atualizadoEm: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss"),
    totalRegistros: totalRegistros,
    detalhes: detalhes
  };
}

function salvarHistoricoCoberturaAgora(token) {
  exigirPerfilSaude_(token);
  return registrarHistoricoCoberturaTodasAsEscolas_();
}

function listarGatilhosHistoricoCobertura(token) {
  exigirPerfilSaude_(token);
  const triggers = ScriptApp.getProjectTriggers();
  const ativos = triggers
    .filter(function(t) {
      return t.getHandlerFunction && t.getHandlerFunction() === "rotinaHistoricoCoberturaDiario18h";
    })
    .map(function(t) {
      return {
        funcao: t.getHandlerFunction(),
        tipo: String(t.getEventType ? t.getEventType() : "")
      };
    });

  return {
    ativo: ativos.length > 0,
    quantidade: ativos.length,
    gatilhos: ativos
  };
}






function getMapaEscolaUnidade_() {
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const aba = ss.getSheetByName("CONFIG_ESCOLA_UNIDADE");

  if (!aba) return {};

  const dados = aba.getDataRange().getValues();
  if (dados.length < 2) return {};

  const headers = dados[0].map(function(h) {
    return normalizarTexto_(h);
  });

  const idxEscola = headers.indexOf("ESCOLA");
  const idxUnidade = headers.indexOf("UNIDADE");

  if (idxEscola === -1 || idxUnidade === -1) return {};

  const mapa = {};

  for (let i = 1; i < dados.length; i++) {
    const escola = normalizarTexto_(dados[i][idxEscola]);
    const unidade = String(dados[i][idxUnidade] || "").trim();

    if (escola) {
      mapa[escola] = unidade || "SEM UNIDADE INFORMADA";
    }
  }

  return mapa;
}




function getPainelRankingVacinal(token) {
  try { registrarUsoSistema_(requireSession_(token), "Acessou Ranking", "", "", "Sucesso"); } catch(e) {}

  const session = requireSession_(token);

  const MAPA_ESCOLA_UNIDADE = getMapaEscolaUnidade_();

  function unidadePorEscola_(escola) {
    const chave = normalizarTexto_(escola);
    return MAPA_ESCOLA_UNIDADE[chave] || "SEM UNIDADE INFORMADA";
  }

  function chaveAlunoRanking_(item, escola, baseKey) {
    const cpf = String(item.cpf || "").replace(/\D/g, "");

    // CPF válido é o melhor identificador. Mantém escola/base na chave para evitar colisão em registros migrados.
    if (cpf && cpf.length === 11 && !/^0{11}$/.test(cpf)) {
      return ["CPF", normalizarTexto_(escola), baseKey, cpf].join("|");
    }

    // Plano B: nome + idade + escola + base.
    // Não é perfeito, mas evita que o mesmo aluno seja contado várias vezes por vacina.
    return [
      "NOME",
      normalizarTexto_(escola),
      baseKey,
      normalizarTexto_(item.nome || ""),
      normalizarTexto_(item.idade || ""),
      normalizarTexto_(item.turma || "")
    ].join("|");
  }

  function garantir_(mapa, nome) {
    if (!mapa[nome]) {
      mapa[nome] = {
        nome: nome,
        alunos: {},
        totalAlunos: 0,
        pendenciasVacinais: 0,
        dosesElegiveis: 0,
        dosesAplicadas: 0
      };
    }
    return mapa[nome];
  }

  function garantirAluno_(grupo, chaveAluno) {
    if (!grupo.alunos[chaveAluno]) {
      grupo.alunos[chaveAluno] = {
        elegivel: false,
        tomouTodas: true,
        temPendencia: false,
        temSemInfo: false,
        temNaoVacinado: false,
        dosesElegiveis: 0,
        dosesAplicadas: 0,
        pendenciasVacinais: 0
      };
    }
    return grupo.alunos[chaveAluno];
  }

  function acumularAluno_(grupo, chaveAluno, item, config) {
    grupo.totalAlunos++;

    const aluno = garantirAluno_(grupo, chaveAluno);
    let alunoTemVacinaElegivelNestaLinha = false;

    (config.vacinas || []).forEach(function(vac) {
      const flag = item.coberturaFlags && item.coberturaFlags[vac.key]
        ? item.coberturaFlags[vac.key]
        : null;

      if (!flag || !flag.elegivel) return;

      alunoTemVacinaElegivelNestaLinha = true;
      aluno.elegivel = true;
      aluno.dosesElegiveis++;
      grupo.dosesElegiveis++;

      if (flag.tomou) {
        aluno.dosesAplicadas++;
        grupo.dosesAplicadas++;
      } else {
        aluno.tomouTodas = false;
        aluno.temPendencia = true;
        aluno.pendenciasVacinais++;
        grupo.pendenciasVacinais++;

        if (flag.semInfo) {
          aluno.temSemInfo = true;
        } else {
          aluno.temNaoVacinado = true;
        }
      }
    });

    // Se o aluno não tem nenhuma vacina elegível, ele permanece apenas no total de alunos.
    // Ele não entra no denominador de cobertura.
    if (!alunoTemVacinaElegivelNestaLinha && !aluno.elegivel) {
      aluno.tomouTodas = false;
    }
  }

  const escolas = {};
  const unidades = {};

  Object.keys(CONFIG_BASES).forEach(function(baseKey) {
    const config = CONFIG_BASES[baseKey];
    const rows = lerAbaComoObjetos_(config.sheetName);
    const dadosBase = rows.map(function(row) {
      return padronizarLinhaVacinal_(row, config);
    });

    // REGRA CORRIGIDA: o ranking municipal deve ser calculado com TODAS as escolas.
    // A permissão do usuário continua valendo para telas operacionais/listas nominais,
    // mas não pode reduzir o ranking municipal nem alterar a posição real da escola.
    const dados = dadosBase.filter(function(item) {
      const escola = String(item.escola || "").trim();
      return !!escola;
    });

    dados.forEach(function(item) {
      const escola = String(item.escola || "").trim();
      if (!escola) return;

      const unidade = unidadePorEscola_(escola);
      const chaveAluno = chaveAlunoRanking_(item, escola, baseKey);

      const itemEscola = garantir_(escolas, escola);
      const itemUnidade = garantir_(unidades, unidade);

      acumularAluno_(itemEscola, chaveAluno, item, config);
      acumularAluno_(itemUnidade, chaveAluno, item, config);
    });
  });

  function finalizar_(mapa) {
    return Object.keys(mapa).map(function(k) {
      const item = mapa[k];
      const alunos = Object.keys(item.alunos).map(function(ch) { return item.alunos[ch]; });

      const totalMonitorados = alunos.length;
      const elegiveis = alunos.filter(function(a) { return a.elegivel; }).length;
      const vacinados = alunos.filter(function(a) { return a.elegivel && !a.temPendencia; }).length;
      const atrasos = alunos.filter(function(a) { return a.elegivel && a.temPendencia; }).length;
      const semInfo = alunos.filter(function(a) { return a.elegivel && a.temSemInfo; }).length;
      const naoVacinados = alunos.filter(function(a) { return a.elegivel && a.temNaoVacinado; }).length;

      const cobertura = elegiveis > 0
        ? Number(((vacinados / elegiveis) * 100).toFixed(1))
        : 0;

      const percAtraso = elegiveis > 0
        ? Number(((atrasos / elegiveis) * 100).toFixed(1))
        : 0;

      const percSemInfo = elegiveis > 0
        ? Number(((semInfo / elegiveis) * 100).toFixed(1))
        : 0;

      return {
        nome: item.nome,
        cobertura: cobertura,
        atrasos: atrasos,
        total: totalMonitorados,
        totalAlunos: totalMonitorados,
        registrosBase: item.totalAlunos,
        elegiveis: elegiveis,
        vacinados: vacinados,
        alunosEmDia: vacinados,
        naoElegiveis: Math.max(0, totalMonitorados - elegiveis),
        alunosNaoElegiveis: Math.max(0, totalMonitorados - elegiveis),
        naoVacinados: naoVacinados,
        semInfo: semInfo,
        pendenciasVacinais: item.pendenciasVacinais,
        dosesElegiveis: item.dosesElegiveis,
        dosesAplicadas: item.dosesAplicadas,
        percAtraso: percAtraso,
        percSemInfo: percSemInfo,
        faixa: cobertura >= 95 ? "BOM" : cobertura >= 85 ? "ATENÇÃO" : "CRÍTICO"
      };
    });
  }

  const escolasFinal = finalizar_(escolas)
    .sort(function(a, b) { return b.cobertura - a.cobertura; });

  const unidadesFinal = finalizar_(unidades)
    .sort(function(a, b) { return b.cobertura - a.cobertura; });

  const unidadesPendencia = finalizar_(unidades)
    .sort(function(a, b) { return b.atrasos - a.atrasos; });

  const escolasCriticas = escolasFinal.filter(function(x) {
    return Number(x.cobertura || 0) < 85;
  });

  const unidadeMaisCritica = unidadesFinal.length
    ? unidadesFinal.slice().sort(function(a, b) { return a.cobertura - b.cobertura; })[0]
    : null;

  const escolaUsuario = session && session.escola
    ? String(session.escola || "").trim()
    : ((session.escolasPermitidas || [])[0] || "");

  const minhaEscola = escolasFinal.find(function(e) {
    return normalizarTexto_(e.nome) === normalizarTexto_(escolaUsuario);
  }) || null;

  const posicaoMinhaEscola = minhaEscola
    ? escolasFinal.findIndex(function(e) { return normalizarTexto_(e.nome) === normalizarTexto_(minhaEscola.nome); }) + 1
    : null;

  // Escola em destaque deve ser a primeira colocada real do ranking filtrado.
  // Mantemos também os campos antigos para não quebrar o Index.html atual.
  const escolaDestaque = escolasFinal.length ? escolasFinal[0] : null;
  const posicaoEscolaDestaque = escolaDestaque ? 1 : null;

  return {
    atualizadoEm: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss"),

    resumo: {
      escolasMonitoradas: escolasFinal.length,
      unidadesMonitoradas: unidadesFinal.filter(function(x) {
        return normalizarTexto_(x.nome) !== "SEM UNIDADE INFORMADA";
      }).length || unidadesFinal.length,
      escolasCriticas: escolasCriticas.length,
      unidadeMaisCritica: unidadeMaisCritica ? unidadeMaisCritica.nome : "-",
      coberturaUnidadeMaisCritica: unidadeMaisCritica ? unidadeMaisCritica.cobertura : 0,
      escolaUsuario: minhaEscola ? minhaEscola.nome : escolaUsuario,
      posicaoMinhaEscola: posicaoMinhaEscola,
      minhaEscola: minhaEscola,
      escolaDestaque: escolaDestaque,
      posicaoEscolaDestaque: posicaoEscolaDestaque,
      escolaUsuarioOriginal: escolaUsuario,
      minhaEscolaOriginal: minhaEscola,
      posicaoMinhaEscolaOriginal: posicaoMinhaEscola
    },

    // Arrays completos ficam disponíveis, mas o Index pode mostrar Top 5/Top 7 no painel.
    escolasPorCobertura: escolasFinal,
    unidadesPorCobertura: unidadesFinal,
    unidadesMaiorPendencia: unidadesPendencia,

    diagnostico: {
      totalEscolasRanking: escolasFinal.length,
      totalUnidadesRanking: unidadesFinal.length,
      totalSemUnidadeInformada: unidadesFinal.filter(function(x) {
        return normalizarTexto_(x.nome) === "SEM UNIDADE INFORMADA";
      }).length,
      usaConfigEscolaUnidade: Object.keys(MAPA_ESCOLA_UNIDADE).length > 0,
      totalVinculosConfigEscolaUnidade: Object.keys(MAPA_ESCOLA_UNIDADE).length,
      regraRanking: "Alunos elegíveis, vacinados, atrasos e sem informação são contados por aluno único. Pendências vacinais são contadas separadamente por vacina."
    }
  };
}



/**
 * ==========================================================
 * HISTÓRICO DE DESEMPENHO DA ESCOLA
 * Uso exclusivo da aba Início/Desempenho da Escola.
 * NÃO substitui HISTORICO_COBERTURA, que continua sendo usada
 * na aba Situação Vacinal.
 * ==========================================================
 */

function garantirAbaHistoricoDesempenhoEscola_() {
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  let sh = ss.getSheetByName(ABA_HISTORICO_DESEMPENHO_ESCOLA);

  const cabecalho = [
    "DATA",
    "DATA_HORA",
    "ESCOLA",
    "COBERTURA_ATUAL",
    "ALUNOS_MONITORADOS",
    "ELEGIVEIS",
    "VACINADOS",
    "ATRASO",
    "SEM_INFO",
    "PENDENCIAS_VACINAIS",
    "CHAVE"
  ];

  if (!sh) {
    sh = ss.insertSheet(ABA_HISTORICO_DESEMPENHO_ESCOLA);
    sh.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);
    sh.setFrozenRows(1);
    return sh;
  }

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);
    sh.setFrozenRows(1);
    return sh;
  }

  // Garante cabeçalho atualizado sem apagar dados existentes.
  const lastCol = Math.max(sh.getLastColumn(), cabecalho.length);
  const headersAtuais = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
    return String(h || "").trim();
  });

  let precisaAtualizar = false;
  cabecalho.forEach(function(h, i) {
    if (headersAtuais[i] !== h) precisaAtualizar = true;
  });

  if (precisaAtualizar) {
    sh.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);
    sh.setFrozenRows(1);
  }

  return sh;
}

function chaveAlunoDesempenho_(item, escola, baseKey) {
  const cpf = String(item.cpf || "").replace(/\D/g, "");

  if (cpf && cpf.length === 11 && !/^0{11}$/.test(cpf)) {
    return ["CPF", normalizarTexto_(escola), baseKey, cpf].join("|");
  }

  return [
    "NOME",
    normalizarTexto_(escola),
    baseKey,
    normalizarTexto_(item.nome || ""),
    normalizarTexto_(item.idade || ""),
    normalizarTexto_(item.turma || "")
  ].join("|");
}

function calcularRankingDesempenhoEscolas_() {
  const MAPA_ESCOLA_UNIDADE = getMapaEscolaUnidade_();
  const escolas = {};

  function unidadePorEscola_(escola) {
    return MAPA_ESCOLA_UNIDADE[normalizarTexto_(escola)] || "SEM UNIDADE INFORMADA";
  }

  function garantirEscola_(nome) {
    if (!escolas[nome]) {
      escolas[nome] = {
        nome: nome,
        unidade: unidadePorEscola_(nome),
        alunos: {},
        registrosBase: 0,
        pendenciasVacinais: 0,
        dosesElegiveis: 0,
        dosesAplicadas: 0
      };
    }
    return escolas[nome];
  }

  function garantirAluno_(grupo, chaveAluno) {
    if (!grupo.alunos[chaveAluno]) {
      grupo.alunos[chaveAluno] = {
        elegivel: false,
        temPendencia: false,
        temSemInfo: false,
        temNaoVacinado: false,
        dosesElegiveis: 0,
        dosesAplicadas: 0,
        pendenciasVacinais: 0
      };
    }
    return grupo.alunos[chaveAluno];
  }

  Object.keys(CONFIG_BASES).forEach(function(baseKey) {
    const config = CONFIG_BASES[baseKey];
    const rows = lerAbaComoObjetos_(config.sheetName);
    const dados = rows.map(function(row) {
      return padronizarLinhaVacinal_(row, config);
    });

    dados.forEach(function(item) {
      const escola = String(item.escola || "").trim();
      if (!escola) return;

      const grupo = garantirEscola_(escola);
      const chaveAluno = chaveAlunoDesempenho_(item, escola, baseKey);
      const aluno = garantirAluno_(grupo, chaveAluno);

      grupo.registrosBase++;

      (config.vacinas || []).forEach(function(vac) {
        const flag = item.coberturaFlags && item.coberturaFlags[vac.key]
          ? item.coberturaFlags[vac.key]
          : null;

        if (!flag || !flag.elegivel) return;

        aluno.elegivel = true;
        aluno.dosesElegiveis++;
        grupo.dosesElegiveis++;

        if (flag.tomou) {
          aluno.dosesAplicadas++;
          grupo.dosesAplicadas++;
        } else {
          aluno.temPendencia = true;
          aluno.pendenciasVacinais++;
          grupo.pendenciasVacinais++;

          if (flag.semInfo) aluno.temSemInfo = true;
          else aluno.temNaoVacinado = true;
        }
      });
    });
  });

  return Object.keys(escolas).map(function(k) {
    const item = escolas[k];
    const alunos = Object.keys(item.alunos).map(function(ch) { return item.alunos[ch]; });

    const totalMonitorados = alunos.length;
    const elegiveis = alunos.filter(function(a) { return a.elegivel; }).length;
    const vacinados = alunos.filter(function(a) { return a.elegivel && !a.temPendencia; }).length;
    const atrasos = alunos.filter(function(a) { return a.elegivel && a.temPendencia; }).length;
    const semInfo = alunos.filter(function(a) { return a.elegivel && a.temSemInfo; }).length;
    const naoVacinados = alunos.filter(function(a) { return a.elegivel && a.temNaoVacinado; }).length;

    const cobertura = elegiveis > 0
      ? Number(((vacinados / elegiveis) * 100).toFixed(1))
      : 0;

    return {
      nome: item.nome,
      escola: item.nome,
      unidade: item.unidade,
      cobertura: cobertura,
      total: totalMonitorados,
      totalAlunos: totalMonitorados,
      registrosBase: item.registrosBase,
      elegiveis: elegiveis,
      vacinados: vacinados,
      atrasos: atrasos,
      alunosAtraso: atrasos,
      semInfo: semInfo,
      naoVacinados: naoVacinados,
      pendenciasVacinais: item.pendenciasVacinais,
      dosesElegiveis: item.dosesElegiveis,
      dosesAplicadas: item.dosesAplicadas,
      faixa: cobertura >= 95 ? "BOM" : cobertura >= 85 ? "ATENÇÃO" : "CRÍTICO"
    };
  }).sort(function(a, b) {
    return b.cobertura - a.cobertura;
  });
}

function salvarHistoricoDesempenhoEscolas() {
  const sh = garantirAbaHistoricoDesempenhoEscola_();
  const tz = Session.getScriptTimeZone();
  const agora = new Date();
  const dataIso = Utilities.formatDate(agora, tz, "yyyy-MM-dd");
  const dataHora = Utilities.formatDate(agora, tz, "dd/MM/yyyy HH:mm:ss");

  const ranking = calcularRankingDesempenhoEscolas_();

  if (!ranking.length) {
    return {
      ok: false,
      mensagem: "Nenhuma escola encontrada para salvar o histórico de desempenho.",
      atualizadoEm: dataHora
    };
  }

  const lastRow = sh.getLastRow();
  const chavesExistentes = {};

  if (lastRow > 1) {
    const valoresChaves = sh.getRange(2, 11, lastRow - 1, 1).getValues().flat();
    valoresChaves.forEach(function(ch, i) {
      ch = String(ch || "").trim();
      if (ch) chavesExistentes[ch] = i + 2;
    });
  }

  let inseridos = 0;
  let atualizados = 0;

  ranking.forEach(function(item) {
    const chave = [dataIso, normalizarTexto_(item.nome)].join("|");
    const linha = [
      dataIso,
      dataHora,
      item.nome,
      Number(item.cobertura || 0),
      Number(item.totalAlunos || item.total || 0),
      Number(item.elegiveis || 0),
      Number(item.vacinados || 0),
      Number(item.atrasos || item.alunosAtraso || 0),
      Number(item.semInfo || 0),
      Number(item.pendenciasVacinais || 0),
      chave
    ];

    if (chavesExistentes[chave]) {
      sh.getRange(chavesExistentes[chave], 1, 1, linha.length).setValues([linha]);
      atualizados++;
    } else {
      sh.appendRow(linha);
      inseridos++;
    }
  });

  return {
    ok: true,
    mensagem: "Histórico de desempenho das escolas salvo com sucesso.",
    atualizadoEm: dataHora,
    escolas: ranking.length,
    inseridos: inseridos,
    atualizados: atualizados
  };
}

function salvarHistoricoDesempenhoEscolasAgora(token) {
  exigirPerfilSaude_(token);
  return salvarHistoricoDesempenhoEscolas();
}

function criarGatilhoHistoricoDesempenho18h(token) {
  exigirPerfilSaude_(token);

  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === "rotinaHistoricoDesempenhoDiario18h") {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("rotinaHistoricoDesempenhoDiario18h")
    .timeBased()
    .everyDays(1)
    .atHour(18)
    .create();

  garantirAbaHistoricoDesempenhoEscola_();

  return {
    ok: true,
    mensagem: "Gatilho diário criado para atualizar o histórico de desempenho às 18h."
  };
}

function excluirGatilhoHistoricoDesempenho18h(token) {
  exigirPerfilSaude_(token);
  let removidos = 0;

  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === "rotinaHistoricoDesempenhoDiario18h") {
      ScriptApp.deleteTrigger(t);
      removidos++;
    }
  });

  return {
    ok: true,
    mensagem: removidos ? "Gatilho removido com sucesso." : "Nenhum gatilho de desempenho estava ativo.",
    removidos: removidos
  };
}

function rotinaHistoricoDesempenhoDiario18h() {
  const resultado = salvarHistoricoDesempenhoEscolas();
  Logger.log(JSON.stringify(resultado));
  return resultado;
}

function listarGatilhosHistoricoDesempenho(token) {
  exigirPerfilSaude_(token);

  const ativos = ScriptApp.getProjectTriggers()
    .filter(function(t) {
      return t.getHandlerFunction && t.getHandlerFunction() === "rotinaHistoricoDesempenhoDiario18h";
    })
    .map(function(t) {
      return {
        funcao: t.getHandlerFunction(),
        tipo: String(t.getEventType ? t.getEventType() : "")
      };
    });

  return {
    ativo: ativos.length > 0,
    quantidade: ativos.length,
    gatilhos: ativos
  };
}

function getHistoricoDesempenhoEscola(token, escola) {
  const session = requireSession_(token);
  const sh = garantirAbaHistoricoDesempenhoEscola_();
  const data = sh.getDataRange().getValues();

  escola = String(escola || "").trim();

  if (!escola) {
    escola = String(session.escola || ((session.escolasPermitidas || [])[0] || "")).trim();
  }

  if (!escola) {
    return {
      labels: [],
      values: [],
      datasets: [],
      historico: [],
      titulo: "Evolução da cobertura da sua escola",
      mensagem: "Não foi possível identificar a escola vinculada a este usuário."
    };
  }

  if (String(session.perfil || "").toUpperCase() === "EDUCACAO") {
    const permitidas = (session.escolasPermitidas || []).map(function(e) { return normalizarTexto_(e); });
    if (permitidas.length && permitidas.indexOf(normalizarTexto_(escola)) === -1) {
      throw new Error("Acesso negado ao histórico desta escola.");
    }
  }

  if (data.length < 2) {
    return {
      labels: [],
      values: [],
      datasets: [],
      historico: [],
      titulo: "Evolução da cobertura da sua escola",
      mensagem: "Ainda não há histórico de desempenho registrado."
    };
  }

  const idx = mapHeaders_(data[0]);
  const tz = Session.getScriptTimeZone();

  function formatarLabelData_(valor) {
    if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor.getTime())) {
      return Utilities.formatDate(valor, tz, "dd/MM");
    }

    const txt = String(valor || "").trim();

    if (/^\d{4}-\d{2}-\d{2}/.test(txt)) {
      return txt.substring(8, 10) + "/" + txt.substring(5, 7);
    }

    if (/^\d{2}\/\d{2}\/\d{4}/.test(txt)) {
      return txt.substring(0, 5);
    }

    return txt;
  }

  function ordenarPorData_(a, b) {
    const da = String(a.dataRaw || "");
    const db = String(b.dataRaw || "");
    return da.localeCompare(db);
  }

  const historico = data.slice(1).map(function(r) {
    return {
      dataRaw: String(r[idx.DATA] || "").trim(),
      data: formatarLabelData_(r[idx.DATA]),
      dataHora: String(r[idx.DATA_HORA] || "").trim(),
      escola: String(r[idx.ESCOLA] || "").trim(),
      cobertura: Number(r[idx.COBERTURA_ATUAL] || 0),
      alunosMonitorados: Number(r[idx.ALUNOS_MONITORADOS] || 0),
      elegiveis: Number(r[idx.ELEGIVEIS] || 0),
      vacinados: Number(r[idx.VACINADOS] || 0),
      atraso: Number(r[idx.ATRASO] || 0),
      semInfo: Number(r[idx.SEM_INFO] || 0),
      pendenciasVacinais: Number(r[idx.PENDENCIAS_VACINAIS] || 0)
    };
  }).filter(function(item) {
    return normalizarTexto_(item.escola) === normalizarTexto_(escola);
  }).sort(ordenarPorData_);

  return {
    labels: historico.map(function(x) { return x.data; }),
    values: historico.map(function(x) { return x.cobertura; }),
    datasets: [{
      label: "Cobertura atual",
      data: historico.map(function(x) { return x.cobertura; })
    }],
    historico: historico,
    titulo: "Evolução da cobertura da sua escola",
    escola: escola,
    mensagem: historico.length ? "" : "Ainda não há histórico de desempenho registrado para esta escola."
  };
}


function getPainelGestaoVacinal(token) {
  requireSession_(token);

  const sh = garantirAbaHistoricoCobertura_();
  const data = sh.getDataRange().getValues();

  if (data.length < 2) {
    return {
      resumo: {
        escolasMonitoradas: 0,
        escolasCriticas: 0,
        vacinaMaisCritica: "-",
        menorCobertura: 0,
        maiorQueda: "-"
      },
      rankingEscolas: [],
      vacinasCriticas: [],
      alertasQueda: [],
      evolucaoMunicipal: { labels: [], values: [] },
      prioridades: []
    };
  }

  const idx = mapHeaders_(data[0]);

  const linhas = data.slice(1).map(function(r) {
    return {
      data: String(r[idx.DATA] || "").trim(),
      escola: String(r[idx.ESCOLA] || "").trim(),
      segmento: String(r[idx.SEGMENTO] || "").trim().toUpperCase(),
      vacina: String(r[idx.VACINA] || "").trim(),
      cobertura: Number(r[idx.COBERTURA] || 0)
    };
  }).filter(function(x) {
    return x.data && x.escola && x.vacina;
  });

  if (!linhas.length) {
    return {
      resumo: {
        escolasMonitoradas: 0,
        escolasCriticas: 0,
        vacinaMaisCritica: "-",
        menorCobertura: 0,
        maiorQueda: "-"
      },
      rankingEscolas: [],
      vacinasCriticas: [],
      alertasQueda: [],
      evolucaoMunicipal: { labels: [], values: [] },
      prioridades: []
    };
  }

  const datas = [...new Set(linhas.map(function(x) { return x.data; }))].sort();
  const dataMaisRecente = datas[datas.length - 1];

  const linhasRecentes = linhas.filter(function(x) { return x.data === dataMaisRecente; });

  const escolasMap = {};
  linhasRecentes.forEach(function(x) {
    if (!escolasMap[x.escola]) escolasMap[x.escola] = [];
    escolasMap[x.escola].push(x.cobertura);
  });

  const rankingEscolas = Object.keys(escolasMap).map(function(escola) {
    const arr = escolasMap[escola];
    const media = arr.reduce(function(a, b) { return a + b; }, 0) / arr.length;
    return {
      escola: escola,
      cobertura: Number(media.toFixed(1)),
      prioridade: media < 70 ? "ALTA" : media < 80 ? "MÉDIA" : "BAIXA"
    };
  }).sort(function(a, b) { return a.cobertura - b.cobertura; });

  const vacinasMap = {};
  linhasRecentes.forEach(function(x) {
    if (!vacinasMap[x.vacina]) vacinasMap[x.vacina] = [];
    vacinasMap[x.vacina].push(x.cobertura);
  });

  const vacinasCriticas = Object.keys(vacinasMap).map(function(vacina) {
    const arr = vacinasMap[vacina];
    const media = arr.reduce(function(a, b) { return a + b; }, 0) / arr.length;
    return {
      vacina: vacina,
      cobertura: Number(media.toFixed(1)),
      prioridade: media < 70 ? "ALTA" : media < 80 ? "MÉDIA" : "BAIXA"
    };
  }).sort(function(a, b) { return a.cobertura - b.cobertura; });

  const evolucaoMunicipal = {
    labels: datas.map(function(d) {
      const p = d.split("-");
      return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : d;
    }),
    values: datas.map(function(d) {
      const arr = linhas.filter(function(x) { return x.data === d; }).map(function(x) { return x.cobertura; });
      if (!arr.length) return 0;
      return Number((arr.reduce(function(a, b) { return a + b; }, 0) / arr.length).toFixed(1));
    })
  };

  const alertasQueda = [];
  if (datas.length >= 2) {
    const dataAnterior = datas[datas.length - 2];

    const chaveMap = {};
    linhas.forEach(function(x) {
      const chave = normalizarTexto_(x.escola) + "|" + normalizarTexto_(x.segmento) + "|" + normalizarTexto_(x.vacina);
      if (!chaveMap[chave]) chaveMap[chave] = {};
      chaveMap[chave][x.data] = x;
    });

    Object.keys(chaveMap).forEach(function(chave) {
      const anterior = chaveMap[chave][dataAnterior];
      const atual = chaveMap[chave][dataMaisRecente];

      if (anterior && atual) {
        const diff = Number((atual.cobertura - anterior.cobertura).toFixed(1));
        if (diff < 0) {
          alertasQueda.push({
            escola: atual.escola,
            segmento: atual.segmento,
            vacina: atual.vacina,
            anterior: anterior.cobertura,
            atual: atual.cobertura,
            queda: Math.abs(diff)
          });
        }
      }
    });

    alertasQueda.sort(function(a, b) { return b.queda - a.queda; });
  }

  const prioridades = [];
  rankingEscolas.forEach(function(e) {
    if (e.cobertura < 80) {
      prioridades.push({
        tipo: "ESCOLA",
        item: e.escola,
        cobertura: e.cobertura,
        prioridade: e.prioridade,
        acao: e.prioridade === "ALTA"
          ? "Ação imediata: revisar nominativo, planejar busca ativa e pactuar intervenção com escola/unidade."
          : "Acompanhar semanalmente e organizar busca ativa dirigida."
      });
    }
  });

  vacinasCriticas.forEach(function(v) {
    if (v.cobertura < 80) {
      prioridades.push({
        tipo: "VACINA",
        item: v.vacina,
        cobertura: v.cobertura,
        prioridade: v.prioridade,
        acao: v.prioridade === "ALTA"
          ? "Priorizar esta vacina nas ações extramuros e checar estoque/registro."
          : "Monitorar pendências e orientar equipes."
      });
    }
  });

  const menorCobertura = rankingEscolas.length ? rankingEscolas[0].cobertura : 0;
  const vacinaMaisCritica = vacinasCriticas.length ? vacinasCriticas[0].vacina : "-";
  const maiorQueda = alertasQueda.length
    ? alertasQueda[0].escola + " / " + alertasQueda[0].vacina + " (-" + alertasQueda[0].queda + " p.p.)"
    : "-";

  return {
    resumo: {
      escolasMonitoradas: rankingEscolas.length,
      escolasCriticas: rankingEscolas.filter(function(x) { return x.cobertura < 80; }).length,
      vacinaMaisCritica: vacinaMaisCritica,
      menorCobertura: menorCobertura,
      maiorQueda: maiorQueda
    },
    rankingEscolas: rankingEscolas,
    vacinasCriticas: vacinasCriticas,
    alertasQueda: alertasQueda.slice(0, 20),
    evolucaoMunicipal: evolucaoMunicipal,
    prioridades: prioridades.slice(0, 40)
  };
}


function getHistoricoCobertura(token, escola, segmento, turmaFiltro, vacinaFiltro) {
  requireSession_(token);

  escola = String(escola || "").trim();
  segmento = String(segmento || "TODOS").trim().toUpperCase();
  turmaFiltro = String(turmaFiltro || "TODAS").trim();
  vacinaFiltro = String(vacinaFiltro || "TODAS").trim();

  const tz = Session.getScriptTimeZone();
  const anoAtual = new Date().getFullYear();

  const nomesMeses = [
    "",
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro"
  ];

  // Série histórica operacional iniciando em abril.
  const mesesFixos = [];
  for (let mes = 4; mes <= 12; mes++) {
    const mesStr = String(mes).padStart(2, "0");
    mesesFixos.push(anoAtual + "-" + mesStr);
  }

  const labelsFixos = mesesFixos.map(function(mesIso) {
    const partes = mesIso.split("-");
    const mesNum = parseInt(partes[1], 10);
    return nomesMeses[mesNum];
  });

  if (!escola) {
    return {
      labels: labelsFixos,
      values: labelsFixos.map(function() { return null; }),
      datasets: [],
      titulo: "Evolução mensal da cobertura vacinal",
      inicioSerie: "Abril/" + anoAtual
    };
  }

  const sh = garantirAbaHistoricoCobertura_();
  const data = sh.getDataRange().getValues();

  if (data.length < 2) {
    return {
      labels: labelsFixos,
      values: labelsFixos.map(function() { return null; }),
      datasets: [],
      titulo: "Evolução mensal da cobertura vacinal",
      inicioSerie: "Abril/" + anoAtual
    };
  }

  const idx = mapHeaders_(data[0]);

  function dataParaMesIso_(valor) {
    if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor.getTime())) {
      return Utilities.formatDate(valor, tz, "yyyy-MM");
    }

    const txt = String(valor || "").trim();

    // yyyy-MM-dd
    if (/^\d{4}-\d{2}-\d{2}/.test(txt)) {
      return txt.substring(0, 7);
    }

    // dd/MM/yyyy
    if (/^\d{2}\/\d{2}\/\d{4}/.test(txt)) {
      const partes = txt.substring(0, 10).split("/");
      return partes[2] + "-" + partes[1];
    }

    return txt.length >= 7 ? txt.substring(0, 7) : txt;
  }

  let linhas = data.slice(1).map(function(r) {
    const mes = dataParaMesIso_(r[idx.DATA]);

    return {
      mes: mes,
      escola: String(r[idx.ESCOLA] || "").trim(),
      segmento: String(r[idx.SEGMENTO] || "").trim().toUpperCase(),
      turma: String(idx.TURMA != null ? (r[idx.TURMA] || "") : "TODAS").trim() || "TODAS",
      vacina: String(r[idx.VACINA] || "").trim(),
      cobertura: Number(r[idx.COBERTURA] || 0)
    };
  }).filter(function(item) {
    const escolaOk = normalizarTexto_(item.escola) === normalizarTexto_(escola);
    const segmentoOk = segmento === "TODOS" || item.segmento === segmento;
    const turmaOk = turmaFiltro === "TODAS" || normalizarTexto_(item.turma) === normalizarTexto_(turmaFiltro);
    const vacinaOk = vacinaFiltro === "TODAS" || normalizarTexto_(item.vacina) === normalizarTexto_(vacinaFiltro);
    const mesOk = mesesFixos.indexOf(item.mes) !== -1;
    return escolaOk && segmentoOk && turmaOk && vacinaOk && mesOk;
  });

  const vacinas = [...new Set(linhas.map(function(x) { return x.vacina; }).filter(Boolean))]
    .sort(function(a, b) { return a.localeCompare(b, "pt-BR"); });

  const datasets = vacinas.map(function(vacina) {
    const valores = mesesFixos.map(function(mesIso) {
      const registros = linhas.filter(function(x) {
        return x.mes === mesIso && normalizarTexto_(x.vacina) === normalizarTexto_(vacina);
      });

      if (!registros.length) return null;

      const soma = registros.reduce(function(s, x) {
        return s + Number(x.cobertura || 0);
      }, 0);

      return Number((soma / registros.length).toFixed(1));
    });

    return {
      label: vacina,
      data: valores
    };
  });

  const values = mesesFixos.map(function(mesIso) {
    const registros = linhas.filter(function(x) { return x.mes === mesIso; });
    if (!registros.length) return null;

    const soma = registros.reduce(function(s, x) {
      return s + Number(x.cobertura || 0);
    }, 0);

    return Number((soma / registros.length).toFixed(1));
  });

  return {
    labels: labelsFixos,
    values: values,
    datasets: datasets,
    titulo: vacinaFiltro !== "TODAS"
      ? "Evolução mensal da cobertura - " + vacinaFiltro
      : "Evolução mensal da cobertura vacinal",
    inicioSerie: "Abril/" + anoAtual
  };
}

function salvarHistoricoCoberturaManual(token, escola, segmento) {
  const data = getPainelVacinalPorEscola(token, escola, segmento || "TODOS", "TODAS", "TODAS");
  return {
    ok: true,
    mensagem: "Histórico atualizado.",
    diagnostico: data.diagnostico || {}
  };
}






function normalizePerfil_(perfil) {
  perfil = String(perfil || "").trim().toUpperCase();
  return perfil
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizarTexto_(valor) {
  return String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normalizarTokensEscola_(valor) {
  const stopwords = {
    DE: true, DA: true, DO: true, DAS: true, DOS: true,
    E: true, EM: true, NO: true, NA: true,
    BAIRRO: true
  };

  return normalizarTexto_(valor)
    .split(" ")
    .map(x => x.trim())
    .filter(x => x && !stopwords[x]);
}

function calcularSimilaridadeEscola_(nomeA, nomeB) {
  const aNorm = normalizarTexto_(nomeA);
  const bNorm = normalizarTexto_(nomeB);

  if (!aNorm || !bNorm) return 0;
  if (aNorm === bNorm) return 1;
  if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) return 0.95;

  const tokensA = normalizarTokensEscola_(nomeA);
  const tokensB = normalizarTokensEscola_(nomeB);

  if (!tokensA.length || !tokensB.length) return 0;

  const setA = {};
  const setB = {};
  tokensA.forEach(t => setA[t] = true);
  tokensB.forEach(t => setB[t] = true);

  const intersecao = Object.keys(setA).filter(t => setB[t]).length;
  const totalUnico = new Set(tokensA.concat(tokensB)).size;

  if (!intersecao || !totalUnico) return 0;

  const jaccard = intersecao / totalUnico;
  const coberturaMinima = intersecao / Math.min(Object.keys(setA).length, Object.keys(setB).length);

  return Math.max(jaccard, coberturaMinima * 0.9);
}

function encontrarMelhorEscolaNaBase_(escolaUsuario, escolasDaBase) {
  const alvo = String(escolaUsuario || "").trim();
  if (!alvo) return "";

  let melhorNome = "";
  let melhorScore = 0;

  escolasDaBase.forEach(escolaBase => {
    const score = calcularSimilaridadeEscola_(alvo, escolaBase);
    if (score > melhorScore) {
      melhorScore = score;
      melhorNome = escolaBase;
    }
  });

  return melhorScore >= 0.6 ? melhorNome : "";
}

function getSheet_(name) {
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`A aba ${name} não foi encontrada.`);
  return sh;
}

function lerAbaComoObjetos_(sheetName) {
  const sh = getSheet_(sheetName);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(h => String(h).trim());
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function mapHeaders_(headers) {
  const idx = {};
  headers.forEach((h, i) => idx[String(h).trim()] = i);
  return idx;
}

function findUserRow_(perfil, usuario) {
  const sh = getSheet_(ABA_USUARIOS);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return null;

  const idx = mapHeaders_(data[0]);

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const perfilRow = normalizePerfil_(r[idx.PERFIL]);
    const usuarioRow = String(r[idx.USUARIO] || "").trim();

    if (perfilRow === perfil && usuarioRow === usuario) {
      const user = {};
      data[0].forEach((h, j) => user[String(h).trim()] = r[j]);
      return { rowIndex: i + 1, user };
    }
  }

  return null;
}

function parseEscolasPermitidas_(valor) {
  const texto = String(valor || "").trim();
  if (!texto) return [];

  const vistas = {};
  return texto
    .split(/[;,]/)
    .map(function(x) { return String(x || "").trim(); })
    .filter(Boolean)
    .filter(function(escola) {
      const chave = normalizarTexto_(escola);
      if (vistas[chave]) return false;
      vistas[chave] = true;
      return true;
    });
}

function createSalt_() {
  return Utilities.getUuid().replace(/-/g, "").slice(0, 16);
}

function hashPassword_(senha, salt) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + senha,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? "0" + v : v;
  }).join("");
}

function validarNovaSenha_(novaSenha, confirmarSenha) {
  novaSenha = String(novaSenha || "").trim();
  confirmarSenha = String(confirmarSenha || "").trim();

  if (!novaSenha || !confirmarSenha) throw new Error("Preencha os dois campos de senha.");
  if (novaSenha !== confirmarSenha) throw new Error("As senhas não conferem.");
  if (!/^[A-Za-z0-9]+$/.test(novaSenha)) throw new Error("A senha deve conter apenas letras e números.");
  if (novaSenha.length < 6) throw new Error("A senha deve ter no mínimo 6 caracteres.");
}

function isBloqueado_(bloqueadoAte) {
  if (!bloqueadoAte) return false;
  const dt = new Date(bloqueadoAte);
  return dt.getTime() > Date.now();
}

function incrementarTentativaFalha_(rowIndex, user) {
  const sh = getSheet_(ABA_USUARIOS);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const idx = mapHeaders_(headers);

  let tentativas = Number(user.TENTATIVAS || 0) + 1;
  sh.getRange(rowIndex, idx.TENTATIVAS + 1).setValue(tentativas);

  if (tentativas >= MAX_TENTATIVAS) {
    const bloqueadoAte = new Date(Date.now() + MINUTOS_BLOQUEIO * 60 * 1000);
    sh.getRange(rowIndex, idx.BLOQUEADO_ATE + 1).setValue(bloqueadoAte);
    sh.getRange(rowIndex, idx.TENTATIVAS + 1).setValue(0);
  }
}

function resetTentativas_(rowIndex) {
  const sh = getSheet_(ABA_USUARIOS);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const idx = mapHeaders_(headers);

  sh.getRange(rowIndex, idx.TENTATIVAS + 1).setValue(0);
  sh.getRange(rowIndex, idx.BLOQUEADO_ATE + 1).setValue("");
}

function generateRecoveryCode_() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function createSession_(data) {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(token, JSON.stringify(data), HORAS_SESSAO * 3600);
  return token;
}

function updateSession_(token, data) {
  CacheService.getScriptCache().put(token, JSON.stringify(data), HORAS_SESSAO * 3600);
}

function requireSession_(token) {
  token = String(token || "").trim();
  if (!token) throw new Error("Sessão inválida.");

  const raw = CacheService.getScriptCache().get(token);
  if (!raw) throw new Error("Sessão expirada. Faça login novamente.");

  return JSON.parse(raw);
}

function validarBase_(baseKey) {
  if (!CONFIG_BASES[baseKey]) throw new Error("Base inválida.");
}

function validarAcessoBase_(session, baseKey) {
  if (session.perfil === "EDUCACAO" && session.base !== baseKey) {
    throw new Error("Você não tem acesso a essa base.");
  }
}

function filtrarEscolasPermitidasNaBase_(session, dadosBase) {
  const escolasDaBase = [...new Set(
    dadosBase
      .map(function(x) { return String(x.escola || "").trim(); })
      .filter(Boolean)
  )];

  const perfil = normalizarTexto_(session && session.perfil ? session.perfil : "");
  const baseSessao = normalizarTexto_(session && session.base ? session.base : "");

  // ADM / gestão geral vê todas as escolas da base.
  if (perfil === "ADM" || baseSessao === "TODAS") {
    return escolasDaBase;
  }

  // SAÚDE e EDUCAÇÃO usam a coluna ESCOLA da aba USUARIOS.
  // Para SAÚDE, a coluna ESCOLA pode ter várias escolas separadas por ponto e vírgula.
  const escolasUsuarioOriginais = (session && session.escolasPermitidas ? session.escolasPermitidas : [])
    .flatMap(function(e) {
      return String(e || "")
        .split(/[;,]/)
        .map(function(x) { return String(x || "").trim(); });
    })
    .filter(Boolean);

  const mapaBase = {};
  escolasDaBase.forEach(function(escola) {
    mapaBase[normalizarTexto_(escola)] = escola;
  });

  const escolasEncontradas = [];
  const usadas = {};

  escolasUsuarioOriginais.forEach(function(escolaUsuario) {
    const chaveExata = normalizarTexto_(escolaUsuario);
    let escolaBase = mapaBase[chaveExata] || "";

    // Tenta aproximar nomes quando houver pequenas diferenças entre USUARIOS e BASE.
    if (!escolaBase) {
      escolaBase = encontrarMelhorEscolaNaBase_(escolaUsuario, escolasDaBase);
    }

    if (escolaBase) {
      const chaveBase = normalizarTexto_(escolaBase);
      if (!usadas[chaveBase]) {
        escolasEncontradas.push(escolaBase);
        usadas[chaveBase] = true;
      }
    }
  });

  return escolasEncontradas;
}

function normalizarEscolaFiltro_(session, baseKey, escolaFiltro, escolasPermitidasNaBase) {
  if (session.perfil === "EDUCACAO") {
    return escolasPermitidasNaBase[0] || "TODAS";
  }

  if (!escolaFiltro || escolaFiltro === "TODAS") return "TODAS";

  const escolaCanonica = (escolasPermitidasNaBase || []).find(function(escolaBase) {
    return normalizarTexto_(escolaBase) === normalizarTexto_(escolaFiltro);
  });

  if (!escolaCanonica) throw new Error("Escola não permitida para este usuário.");
  return escolaCanonica;
}


function obterValorColunaFlex_(row, candidatos) {
  const chaves = Object.keys(row || {});
  for (var i = 0; i < candidatos.length; i++) {
    var alvo = normalizarTexto_(candidatos[i]);
    var chaveEncontrada = chaves.find(function(k) {
      return normalizarTexto_(k) === alvo;
    });
    if (chaveEncontrada) return row[chaveEncontrada];
  }
  return "";
}


function padronizarLinhaVacinal_(row, config) {
  const cols = config.columns;
  const coberturaFlags = {};
  const vacinasNaoTomadasElegiveis = [];
  const vacinasElegiveis = [];

  const idadeAluno = numeroIdadeVacinal_(obterValorColunaFlex_(row, [cols.idade, "IDADE"]));

  (config.vacinas || []).forEach(function(vac) {
    const valorVacina = obterValorColunaFlex_(row, [
      vac.column,
      vac.label,
      "TEM " + vac.label + "?",
      "POSSUI " + vac.label + "?"
    ]);

    const infoStatus = interpretarStatusVacinaComElegibilidade_(valorVacina, idadeAluno, vac);

    coberturaFlags[vac.key] = {
      tomou: infoStatus.tomou,
      elegivel: infoStatus.elegivel,
      emAtraso: infoStatus.emAtraso,
      semInfo: infoStatus.semInfo,
      foraIdade: infoStatus.foraIdade,
      statusOriginal: infoStatus.statusOriginal
    };

    if (infoStatus.elegivel) {
      vacinasElegiveis.push(vac.label);
    }

    if (infoStatus.elegivel && infoStatus.emAtraso) {
      vacinasNaoTomadasElegiveis.push(vac.label);
    }
  });

  const vacinasAtrasoInformado = String(obterValorColunaFlex_(row, [cols.vacinasAtraso, "VACINAS_ATRASO", "VACINAS EM ATRASO"]) || "").trim();
  const vacinasAtrasoCalculado = vacinasNaoTomadasElegiveis.join(", ");

  let atraso;
  let vacinasAtrasoFinal;

  if (config.usaColunaAtraso) {
    atraso = normalizarAtraso_(obterValorColunaFlex_(row, [cols.atraso, "ATRASO", "EM ATRASO"]), vacinasAtrasoInformado || vacinasAtrasoCalculado);
    vacinasAtrasoFinal = atraso ? (vacinasAtrasoInformado || vacinasAtrasoCalculado) : "";
  } else {
    atraso = vacinasNaoTomadasElegiveis.length > 0;
    vacinasAtrasoFinal = atraso ? vacinasAtrasoCalculado : "";
  }

  return {
    nome: obterNomeLinha_(row, cols),
    matricula: String(obterValorColunaFlex_(row, [cols.matricula, "MAT.", "MAT", "MATRICULA", "MATRÍCULA", "Nº MATRÍCULA", "N° MATRÍCULA", "NUMERO DE MATRICULA", "NÚMERO DE MATRÍCULA"]) || "").trim(),
    idade: obterValorColunaFlex_(row, [cols.idade, "IDADE"]) || "",
    escola: String(obterValorColunaFlex_(row, [cols.escola, "ESCOLA", "NOME DA ESCOLA"]) || "SEM ESCOLA").trim(),
    turma: String(obterValorColunaFlex_(row, [cols.turma, "TURMA", "SÉRIE", "SERIE"]) || "SEM TURMA").trim(),
    cpf: String(obterValorColunaFlex_(row, [cols.cpf, "CPF"]) || "").trim(),
    cns: String(obterValorColunaFlex_(row, [cols.cns, "CNS", "CARTAO SUS", "CARTÃO SUS"]) || "").trim(),
    atraso: atraso,
    vacinasAtraso: vacinasAtrasoFinal,
    vacinasElegiveis: vacinasElegiveis,
    coberturaFlags: coberturaFlags
  };
}



function numeroIdadeVacinal_(valor) {
  if (typeof valor === "number") return valor;
  const txt = String(valor || "").replace(",", ".").trim();
  const match = txt.match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function dentroDaFaixaEtariaVacina_(idade, vac) {
  if (vac.idadeMin == null && vac.idadeMax == null) return true;
  if (idade == null || isNaN(idade)) return false;
  if (vac.idadeMin != null && idade < Number(vac.idadeMin)) return false;
  if (vac.idadeMax != null && idade > Number(vac.idadeMax)) return false;
  return true;
}

function interpretarStatusVacinaComElegibilidade_(valor, idade, vac) {
  const texto = normalizarTexto_(valor);

  if (!dentroDaFaixaEtariaVacina_(idade, vac)) {
    return {
      tomou: false,
      elegivel: false,
      emAtraso: false,
      semInfo: false,
      foraIdade: true,
      statusOriginal: texto || "FORA DA FAIXA ETARIA"
    };
  }

  if (STATUS_NAO_TEM_IDADE.map(normalizarTexto_).indexOf(texto) !== -1) {
    return {
      tomou: false,
      elegivel: false,
      emAtraso: false,
      semInfo: false,
      foraIdade: true,
      statusOriginal: texto
    };
  }

  if (!texto) {
    return {
      tomou: false,
      elegivel: true,
      emAtraso: true,
      semInfo: true,
      foraIdade: false,
      statusOriginal: ""
    };
  }

  if (STATUS_SIM.map(normalizarTexto_).indexOf(texto) !== -1) {
    return {
      tomou: true,
      elegivel: true,
      emAtraso: false,
      semInfo: false,
      foraIdade: false,
      statusOriginal: texto
    };
  }

  if (STATUS_NAO.map(normalizarTexto_).indexOf(texto) !== -1) {
    return {
      tomou: false,
      elegivel: true,
      emAtraso: true,
      semInfo: false,
      foraIdade: false,
      statusOriginal: texto
    };
  }

  // Valor desconhecido: entra no denominador como sem informação.
  return {
    tomou: false,
    elegivel: true,
    emAtraso: true,
    semInfo: true,
    foraIdade: false,
    statusOriginal: texto
  };
}

function interpretarStatusVacina_(valor) {
  const texto = normalizarTexto_(valor);

  if (STATUS_NAO_TEM_IDADE.map(normalizarTexto_).indexOf(texto) !== -1) {
    return {
      tomou: false,
      elegivel: false,
      emAtraso: false,
      statusOriginal: texto
    };
  }

  if (!texto) {
    return {
      tomou: false,
      elegivel: true,
      emAtraso: true,
      statusOriginal: ""
    };
  }

  if (STATUS_SIM.map(normalizarTexto_).indexOf(texto) !== -1) {
    return {
      tomou: true,
      elegivel: true,
      emAtraso: false,
      statusOriginal: texto
    };
  }

  if (STATUS_NAO.map(normalizarTexto_).indexOf(texto) !== -1) {
    return {
      tomou: false,
      elegivel: true,
      emAtraso: true,
      statusOriginal: texto
    };
  }

  return {
    tomou: false,
    elegivel: true,
    emAtraso: true,
    statusOriginal: texto
  };
}


function obterNomeLinha_(row, cols) {
  const tentativas = [
    cols && cols.nome,
    "NOME",
    "ALUNO",
    "NOME DO ALUNO",
    "ALUNO(A)"
  ].filter(Boolean);

  for (var i = 0; i < tentativas.length; i++) {
    var chave = tentativas[i];
    var valor = String(row[chave] || "").trim();
    if (valor) return valor;
  }
  return "";
}

function normalizarAtraso_(atrasoRaw, vacinasAtraso) {
  const texto = String(atrasoRaw || "").trim().toUpperCase();
  if (["SIM", "S", "EM ATRASO", "ATRASO"].includes(texto)) return true;
  if (["NÃO", "NAO", "N", "OK", "SEM ATRASO"].includes(texto)) return false;
  return String(vacinasAtraso || "").trim() !== "";
}

function montarIndicadoresVacinais_(dados, config) {
  const total = dados.length;

  const alunosNaoElegiveis = dados.filter(function(item) {
    const flags = item && item.coberturaFlags ? Object.keys(item.coberturaFlags).map(function(k) { return item.coberturaFlags[k]; }) : [];
    if (!flags.length) return false;
    return flags.every(function(f) { return !f || !f.elegivel; });
  }).length;

  const alunosElegiveis = Math.max(0, total - alunosNaoElegiveis);
  const atraso = dados.filter(function(x) { return x.atraso; }).length;
  const alunosEmDia = Math.max(0, alunosElegiveis - atraso);

  const coberturaAluno = alunosElegiveis > 0
    ? Number(((alunosEmDia / alunosElegiveis) * 100).toFixed(1))
    : 0;

  return {
    totalAlunos: total,
    alunosElegiveis: alunosElegiveis,
    alunosNaoElegiveis: alunosNaoElegiveis,
    naoElegiveis: alunosNaoElegiveis,
    alunosEmAtraso: atraso,
    alunosEmDia: alunosEmDia,
    vacinados: alunosEmDia,
    coberturaGeral: coberturaAluno.toFixed(1),
    escolasAbaixo80: calcularAlertasEscolas_(dados, config)
  };
}

function calcularAlertasEscolas_(dados, config) {
  const mapa = {};

  dados.forEach(item => {
    const escola = item.escola || "SEM ESCOLA";
    if (!mapa[escola]) mapa[escola] = [];
    mapa[escola].push(item);
  });

  return Object.entries(mapa).map(([escola, itens]) => {
    const atraso = itens.filter(x => x.atraso).length;
    const coberturas = [];

    (config.vacinas || []).forEach(vac => {
      const elegiveis = itens.filter(x => x.coberturaFlags[vac.key] && x.coberturaFlags[vac.key].elegivel);
      if (!elegiveis.length) return;
      const tomaram = elegiveis.filter(x => x.coberturaFlags[vac.key].tomou).length;
      coberturas.push((tomaram / elegiveis.length) * 100);
    });

    const cobertura = coberturas.length
      ? coberturas.reduce((a, b) => a + b, 0) / coberturas.length
      : 0;

    return {
      escola,
      cobertura: Number(cobertura.toFixed(1)),
      total: itens.length,
      atraso
    };
  }).filter(x => x.cobertura < 80).sort((a, b) => a.cobertura - b.cobertura);
}


function listarVacinasCoberturaPorSegmento_(segmento) {
  segmento = String(segmento || "TODOS").trim().toUpperCase();

  const bases = segmento === "TODOS"
    ? Object.keys(CONFIG_BASES)
    : [segmento];

  const vacinas = [];

  bases.forEach(function(baseKey) {
    const config = CONFIG_BASES[baseKey];
    if (!config || !config.vacinas) return;

    config.vacinas.forEach(function(vac) {
      const label = String(vac.label || vac.column || vac.key || "").trim();
      if (label) vacinas.push(label);
    });
  });

  return [...new Set(vacinas)]
    .sort(function(a, b) { return a.localeCompare(b, "pt-BR"); });
}



function montarGraficosVacinais_(dados, config) {
  dados = Array.isArray(dados) ? dados : [];

  const atrasoPorEscolaMap = {};
  const atrasoPorTurmaMap = {};

  dados.forEach(function(item) {
    const escola = String(item.escola || "SEM ESCOLA").trim() || "SEM ESCOLA";
    const turma = String(item.turma || "SEM TURMA").trim() || "SEM TURMA";

    if (item.atraso) {
      atrasoPorEscolaMap[escola] = (atrasoPorEscolaMap[escola] || 0) + 1;
      atrasoPorTurmaMap[turma] = (atrasoPorTurmaMap[turma] || 0) + 1;
    }
  });

  const atrasoPorEscolaEntries = Object.entries(atrasoPorEscolaMap)
    .sort(function(a, b) { return b[1] - a[1]; });

  const atrasoPorTurmaEntries = Object.entries(atrasoPorTurmaMap)
    .sort(function(a, b) { return b[1] - a[1]; });

  const coberturaLabels = [];
  const coberturaValues = [];

  const situacaoCompletaLabels = [];
  const situacaoVacinados = [];
  const situacaoNaoVacinados = [];
  const situacaoSemInfo = [];
  const situacaoDenominador = [];
  const alertasQualidade = [];

  (config.vacinas || []).forEach(function(vac) {
    const label = String(vac.label || vac.column || vac.key || "").trim();
    if (!label) return;

    let denominador = 0;
    let vacinados = 0;
    let naoVacinados = 0;
    let semInfo = 0;

    dados.forEach(function(item) {
      const flag = item.coberturaFlags && item.coberturaFlags[vac.key]
        ? item.coberturaFlags[vac.key]
        : null;

      if (!flag || !flag.elegivel) return;

      denominador++;

      if (flag.tomou) {
        vacinados++;
      } else if (flag.semInfo) {
        semInfo++;
      } else {
        naoVacinados++;
      }
    });

    const cobertura = denominador > 0
      ? Number(((vacinados / denominador) * 100).toFixed(1))
      : 0;

    coberturaLabels.push(label);
    coberturaValues.push(cobertura);

    situacaoCompletaLabels.push(label);
    situacaoVacinados.push(vacinados);
    situacaoNaoVacinados.push(naoVacinados);
    situacaoSemInfo.push(semInfo);
    situacaoDenominador.push(denominador);

    const percSemInfo = denominador > 0
      ? Number(((semInfo / denominador) * 100).toFixed(1))
      : 0;

    if (percSemInfo >= 20) {
      alertasQualidade.push({
        vacina: label,
        denominador: denominador,
        semInfo: semInfo,
        percentual: percSemInfo,
        mensagem: label + ": " + percSemInfo + "% sem informação."
      });
    }
  });

  return {
    atrasoPorEscola: {
      labels: atrasoPorEscolaEntries.map(function(x) { return x[0]; }),
      values: atrasoPorEscolaEntries.map(function(x) { return x[1]; })
    },
    atrasoPorTurma: {
      labels: atrasoPorTurmaEntries.map(function(x) { return x[0]; }),
      values: atrasoPorTurmaEntries.map(function(x) { return x[1]; })
    },
    coberturaVacinas: {
      labels: coberturaLabels,
      values: coberturaValues
    },
    situacaoVacinalCompleta: {
      labels: situacaoCompletaLabels,
      vacinados: situacaoVacinados,
      naoVacinados: situacaoNaoVacinados,
      semInfo: situacaoSemInfo,
      denominador: situacaoDenominador
    },
    alertasQualidade: alertasQualidade
  };
}


function agruparContagem_(lista, chave) {
  const mapa = {};
  lista.forEach(item => {
    const k = item[chave] || "SEM INFORMAÇÃO";
    mapa[k] = (mapa[k] || 0) + 1;
  });

  const entries = Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  return {
    labels: entries.map(x => x[0]),
    values: entries.map(x => x[1])
  };
}

function montarFiltros_(dadosPadronizados, escolaSelecionada) {
  const escolas = [...new Set(dadosPadronizados.map(x => x.escola).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  let turmasBase = dadosPadronizados;
  if (escolaSelecionada && escolaSelecionada !== "TODAS") {
    turmasBase = turmasBase.filter(x => x.escola === escolaSelecionada);
  }

  const turmas = [...new Set(turmasBase.map(x => x.turma).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  return { escolas, turmas };
}

function isCpfInconsistente_(cpf) {
  const limpo = String(cpf || "").replace(/\D/g, "");
  if (!limpo) return true;
  if (limpo.length !== 11) return true;
  if (/^0{11}$/.test(limpo)) return true;
  return false;
}

function isEnderecoInconsistente_(endereco) {
  const texto = String(endereco || "").trim().toUpperCase();
  if (!texto) return true;
  const invalidos = ["NAO INFORMADO", "NÃO INFORMADO", "SEM ENDERECO", "SEM ENDEREÇO", "---"];
  return invalidos.includes(texto);
}

function logAcesso_(perfil, usuario, escola, acao) {
  const sh = getSheet_(ABA_LOG);
  sh.appendRow([
    new Date(),
    perfil,
    usuario,
    escola,
    acao
  ]);
}

function sanitizeFileName_(name) {
  return String(name || "").replace(/[\\/:*?"<>|#%&{}]/g, "").trim();
}

function exportSheetAsPdfMelhorado_(spreadsheetId, sheetId, fileName) {
  const url =
    "https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/export" +
    "?format=pdf" +
    "&portrait=false" +
    "&size=A4" +
    "&fitw=true" +
    "&sheetnames=false" +
    "&printtitle=false" +
    "&pagenumbers=true" +
    "&gridlines=false" +
    "&fzr=true" +
    "&top_margin=0.35" +
    "&bottom_margin=0.35" +
    "&left_margin=0.30" +
    "&right_margin=0.30" +
    "&gid=" + sheetId;

  const response = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) throw new Error("Erro ao gerar PDF.");
  return response.getBlob().setName(fileName);
}


/**
 * ==========================================================
 * SIMVE — MÓDULO DE TRANSFERÊNCIA DE ALUNOS — ETAPA 2A
 * Fluxo seguro:
 * 1) Escola origem solicita transferência.
 * 2) Aluno fica como TRANSFERENCIA_ENVIADA na planilha de origem.
 * 3) Registro entra na aba TRANSFERENCIAS_PENDENTES.
 * 4) Escola destino aceita e informa a turma.
 * 5) Sistema cria nova linha na planilha destino e marca origem como TRANSFERIDO.
 *
 * IMPORTANTE:
 * - A base municipal consolidada NÃO é editada diretamente.
 * - A consolidação diária refletirá as mudanças das planilhas origem.
 * ==========================================================
 */

const ABA_TRANSFERENCIAS_PENDENTES = "TRANSFERENCIAS_PENDENTES";
const ABA_LOG_TRANSFERENCIAS = "LOG_TRANSFERENCIAS";

const CABECALHO_LOG_TRANSFERENCIAS = [
  "DATA_HORA",
  "ID_TRANSFERENCIA",
  "ACAO",
  "PERFIL",
  "USUARIO",
  "BASE",
  "CPF",
  "MAT_ORIGEM",
  "ALUNO",
  "ESCOLA_ORIGEM",
  "ESCOLA_DESTINO",
  "TURMA_ORIGEM",
  "TURMA_DESTINO",
  "STATUS_ANTERIOR",
  "STATUS_NOVO",
  "MOTIVO",
  "OBSERVACAO",
  "RESULTADO"
];

const CABECALHO_TRANSFERENCIAS_PENDENTES = [
  "ID_TRANSFERENCIA",
  "DATA_SOLICITACAO",
  "BASE",
  "CPF",
  "MAT_ORIGEM",
  "ALUNO",
  "ESCOLA_ORIGEM",
  "TURMA_ORIGEM",
  "ESCOLA_DESTINO",
  "TURMA_DESTINO",
  "STATUS",
  "MOTIVO",
  "OBSERVACAO",
  "USUARIO_ORIGEM",
  "USUARIO_DESTINO",
  "DATA_ACEITE",
  "DATA_RECUSA",
  "JUSTIFICATIVA_RECUSA",
  "DESTINO_ORIGEM",
  "DESTINO_NOVA_LINHA"
];

function garantirAbaTransferenciasPendentes_() {
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  let sh = ss.getSheetByName(ABA_TRANSFERENCIAS_PENDENTES);

  if (!sh) {
    sh = ss.insertSheet(ABA_TRANSFERENCIAS_PENDENTES);
  }

  const lastCol = Math.max(sh.getLastColumn(), CABECALHO_TRANSFERENCIAS_PENDENTES.length);

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, CABECALHO_TRANSFERENCIAS_PENDENTES.length).setValues([CABECALHO_TRANSFERENCIAS_PENDENTES]);
    sh.setFrozenRows(1);
    return sh;
  }

  const headersAtuais = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
    return String(h || "").trim();
  });

  let precisaAtualizar = false;
  CABECALHO_TRANSFERENCIAS_PENDENTES.forEach(function(h, i) {
    if (headersAtuais[i] !== h) precisaAtualizar = true;
  });

  if (precisaAtualizar) {
    sh.getRange(1, 1, 1, CABECALHO_TRANSFERENCIAS_PENDENTES.length).setValues([CABECALHO_TRANSFERENCIAS_PENDENTES]);
    sh.setFrozenRows(1);
  }

  return sh;
}

function garantirAbaLogTransferencias_() {
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  let sh = ss.getSheetByName(ABA_LOG_TRANSFERENCIAS);

  if (!sh) {
    sh = ss.insertSheet(ABA_LOG_TRANSFERENCIAS);
  }

  const lastCol = Math.max(sh.getLastColumn(), CABECALHO_LOG_TRANSFERENCIAS.length);

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, CABECALHO_LOG_TRANSFERENCIAS.length).setValues([CABECALHO_LOG_TRANSFERENCIAS]);
    sh.setFrozenRows(1);
    return sh;
  }

  const headersAtuais = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
    return String(h || "").trim();
  });

  let precisaAtualizar = false;
  CABECALHO_LOG_TRANSFERENCIAS.forEach(function(h, i) {
    if (headersAtuais[i] !== h) precisaAtualizar = true;
  });

  if (precisaAtualizar) {
    sh.getRange(1, 1, 1, CABECALHO_LOG_TRANSFERENCIAS.length).setValues([CABECALHO_LOG_TRANSFERENCIAS]);
    sh.setFrozenRows(1);
  }

  return sh;
}

function registrarLogTransferencia_(session, dados) {
  try {
    const sh = garantirAbaLogTransferencias_();
    dados = dados || {};
    sh.appendRow([
      new Date(),
      dados.idTransferencia || "",
      dados.acao || "",
      session && session.perfil ? session.perfil : "",
      session && session.usuario ? session.usuario : "",
      dados.base || "",
      dados.cpf || "",
      dados.matricula || dados.matOrigem || "",
      dados.aluno || dados.nome || "",
      dados.escolaOrigem || "",
      dados.escolaDestino || "",
      dados.turmaOrigem || "",
      dados.turmaDestino || "",
      dados.statusAnterior || "",
      dados.statusNovo || "",
      dados.motivo || "",
      dados.observacao || "",
      dados.resultado || "Sucesso"
    ]);
  } catch (e) {
    Logger.log("Falha ao registrar LOG_TRANSFERENCIAS: " + e);
  }
}

function perfilPodeSolicitarTransferencia_(session) {
  const perfil = normalizarTexto_(session && session.perfil ? session.perfil : "");
  return perfil === "EDUCACAO" || perfil === "EDUCAÇÃO" || perfil === "ADM";
}

function perfilPodeAceitarTransferencia_(session) {
  const perfil = normalizarTexto_(session && session.perfil ? session.perfil : "");
  return perfil === "EDUCACAO" || perfil === "EDUCAÇÃO" || perfil === "ADM";
}

function normalizarStatusMatricula_(valor) {
  const txt = normalizarTexto_(valor);
  if (!txt) return "ATIVO";
  return txt;
}

function perfilPodeTransferir_(session) {
  const perfil = normalizarTexto_(session && session.perfil ? session.perfil : "");
  return perfil === "EDUCACAO" || perfil === "EDUCAÇÃO" || perfil === "ADM";
}

function usuarioPodeAcessarEscolaTransferencia_(session, escola) {
  const perfil = normalizarTexto_(session && session.perfil ? session.perfil : "");
  if (perfil === "ADM") return true;

  const permitidas = (session && session.escolasPermitidas ? session.escolasPermitidas : [])
    .flatMap(function(e) {
      return String(e || "").split(/[;,]/).map(function(x) { return String(x || "").trim(); });
    })
    .filter(Boolean);

  return permitidas.some(function(e) {
    return normalizarTexto_(e) === normalizarTexto_(escola);
  });
}

function idxHeaderOrigemFlex_(headersNorm, nomes) {
  for (let i = 0; i < nomes.length; i++) {
    const idx = headersNorm.indexOf(normalizarTexto_(nomes[i]));
    if (idx !== -1) return idx;
  }
  return -1;
}

function garantirColunasTransferenciaNaAba_(sh, headerIndex) {
  const obrigatorias = [
    "STATUS_MATRICULA",
    "ESCOLA_DESTINO",
    "TURMA_DESTINO",
    "DATA_TRANSFERENCIA",
    "STATUS_TRANSFERENCIA",
    "ID_TRANSFERENCIA"
  ];

  let headers = sh.getRange(headerIndex + 1, 1, 1, sh.getLastColumn()).getValues()[0];
  let headersNorm = headers.map(function(h) { return normalizarTexto_(h); });

  obrigatorias.forEach(function(col) {
    if (headersNorm.indexOf(normalizarTexto_(col)) === -1) {
      sh.insertColumnAfter(sh.getLastColumn());
      sh.getRange(headerIndex + 1, sh.getLastColumn()).setValue(col);
      headers.push(col);
      headersNorm.push(normalizarTexto_(col));
    }
  });

  return {
    headers: headers,
    headersNorm: headersNorm
  };
}

function localizarLinhaAlunoNaPlanilhaOrigem_(payload) {
  const destino = getPlanilhaEscolaDestino_(payload.escola, payload.base);
  if (!destino.spreadsheetId) throw new Error("ID_PLANILHA não informado para a escola: " + payload.escola);

  const ss = SpreadsheetApp.openById(destino.spreadsheetId);
  const sh = ss.getSheetByName(destino.sheetName || "BASE_GERAL");
  if (!sh) throw new Error("Aba de origem não encontrada: " + (destino.sheetName || "BASE_GERAL"));

  const valores = sh.getDataRange().getValues();
  if (valores.length < 2) throw new Error("Planilha sem dados para localizar o aluno.");

  const headerIndex = localizarCabecalhoPlanilhaOrigem_(valores);
  if (headerIndex === -1) throw new Error("Não consegui identificar o cabeçalho da planilha de origem.");

  garantirColunasTransferenciaNaAba_(sh, headerIndex);

  const valoresAtualizados = sh.getDataRange().getValues();
  const headersNorm = valoresAtualizados[headerIndex].map(function(h) { return normalizarTexto_(h); });

  const idxMat = idxHeaderOrigemFlex_(headersNorm, ["MAT.", "MAT", "MATRICULA", "MATRÍCULA", "Nº MATRÍCULA", "N° MATRÍCULA"]);
  const idxCpf = idxHeaderOrigemFlex_(headersNorm, ["CPF", "CPF DO ALUNO", "DOCUMENTO"]);
  const idxNome = idxHeaderOrigemFlex_(headersNorm, ["NOME", "NOME DO ALUNO", "ALUNO", "ESTUDANTE", "NOME COMPLETO", "CRIANÇA", "CRIANCA"]);
  const idxEscola = idxHeaderOrigemFlex_(headersNorm, ["ESCOLA", "NOME DA ESCOLA", "INSTITUICAO", "INSTITUIÇÃO"]);
  const idxTurma = idxHeaderOrigemFlex_(headersNorm, ["TURMA", "SERIE", "SÉRIE", "ANO", "SALA"]);

  if (idxMat === -1 && idxCpf === -1) throw new Error("A planilha precisa ter MAT. ou CPF para localizar o aluno.");

  const matNorm = normalizarTexto_(payload.matricula || payload.matOrigem || "");
  const cpfNorm = String(payload.cpf || "").replace(/\D/g, "");
  const nomeNorm = normalizarTexto_(payload.nome || payload.aluno || "");
  const escolaNorm = normalizarTexto_(payload.escola || payload.escolaOrigem || "");

  let linhaEncontrada = -1;

  for (let i = headerIndex + 1; i < valoresAtualizados.length; i++) {
    const row = valoresAtualizados[i];

    const matOk = matNorm && idxMat !== -1 && normalizarTexto_(row[idxMat]) === matNorm;
    const cpfLinha = idxCpf !== -1 ? String(row[idxCpf] || "").replace(/\D/g, "") : "";
    const cpfOk = cpfNorm && cpfLinha && cpfLinha === cpfNorm;
    const nomeOk = !nomeNorm || idxNome === -1 || normalizarTexto_(row[idxNome]) === nomeNorm;
    const escolaOk = !escolaNorm || idxEscola === -1 || normalizarTexto_(row[idxEscola]) === escolaNorm;

    if ((matOk || cpfOk) && nomeOk && escolaOk) {
      linhaEncontrada = i + 1;
      break;
    }
  }

  if (linhaEncontrada === -1) {
    throw new Error("Aluno não localizado na planilha de origem. Confira escola, base, matrícula/CPF e nome.");
  }

  return {
    ss: ss,
    sh: sh,
    destino: destino,
    headerIndex: headerIndex,
    headersNorm: headersNorm,
    linha: linhaEncontrada,
    valores: valoresAtualizados,
    row: valoresAtualizados[linhaEncontrada - 1],
    idx: {
      mat: idxMat,
      cpf: idxCpf,
      nome: idxNome,
      escola: idxEscola,
      turma: idxTurma,
      statusMatricula: idxHeaderOrigemFlex_(headersNorm, ["STATUS_MATRICULA"]),
      escolaDestino: idxHeaderOrigemFlex_(headersNorm, ["ESCOLA_DESTINO"]),
      turmaDestino: idxHeaderOrigemFlex_(headersNorm, ["TURMA_DESTINO"]),
      dataTransferencia: idxHeaderOrigemFlex_(headersNorm, ["DATA_TRANSFERENCIA"]),
      statusTransferencia: idxHeaderOrigemFlex_(headersNorm, ["STATUS_TRANSFERENCIA"]),
      idTransferencia: idxHeaderOrigemFlex_(headersNorm, ["ID_TRANSFERENCIA"])
    }
  };
}

function existeTransferenciaPendenteAtiva_(base, cpf, matricula, escolaOrigem) {
  const sh = garantirAbaTransferenciasPendentes_();
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return false;

  const idx = mapHeaders_(data[0]);
  const cpfNorm = String(cpf || "").replace(/\D/g, "");
  const matNorm = normalizarTexto_(matricula);
  const escolaNorm = normalizarTexto_(escolaOrigem);
  const baseNorm = normalizarTexto_(base);

  return data.slice(1).some(function(r) {
    const status = normalizarTexto_(r[idx.STATUS]);
    if (status !== "AGUARDANDO_ACEITE" && status !== "PENDENTE") return false;

    const mesmaBase = normalizarTexto_(r[idx.BASE]) === baseNorm;
    const mesmaEscola = normalizarTexto_(r[idx.ESCOLA_ORIGEM]) === escolaNorm;
    const mesmoCpf = cpfNorm && String(r[idx.CPF] || "").replace(/\D/g, "") === cpfNorm;
    const mesmaMat = matNorm && normalizarTexto_(r[idx.MAT_ORIGEM]) === matNorm;

    return mesmaBase && mesmaEscola && (mesmoCpf || mesmaMat);
  });
}

function solicitarTransferenciaAluno(token, payload) {
  const session = requireSession_(token);
  if (!perfilPodeSolicitarTransferencia_(session)) {
    throw new Error("Apenas EDUCAÇÃO ou ADM podem solicitar transferência de aluno. O perfil SAÚDE apenas visualiza.");
  }

  payload = payload || {};

  const base = String(payload.base || "ESCOLAR").trim().toUpperCase();
  const escolaOrigem = String(payload.escolaOrigem || payload.escola || "").trim();
  const escolaDestino = String(payload.escolaDestino || "").trim();
  const matricula = String(payload.matricula || payload.matOrigem || "").trim();
  const aluno = String(payload.aluno || payload.nome || "").trim();
  const cpf = String(payload.cpf || "").trim();
  const motivo = String(payload.motivo || "").trim();
  const observacao = String(payload.observacao || "").trim();

  if (!CONFIG_BASES[base]) throw new Error("Base inválida para transferência.");
  if (!escolaOrigem) throw new Error("Escola de origem não informada.");
  if (!escolaDestino) throw new Error("Escola de destino não informada.");
  if (normalizarTexto_(escolaOrigem) === normalizarTexto_(escolaDestino)) {
    throw new Error("A escola de destino deve ser diferente da escola de origem.");
  }
  if (!matricula && !cpf) throw new Error("Informe matrícula ou CPF para localizar o aluno.");

  if (!usuarioPodeAcessarEscolaTransferencia_(session, escolaOrigem)) {
    throw new Error("Você só pode solicitar transferência de aluno da sua própria escola.");
  }

  const origem = localizarLinhaAlunoNaPlanilhaOrigem_({
    base: base,
    escola: escolaOrigem,
    matricula: matricula,
    cpf: cpf,
    nome: aluno
  });

  const alunoNome = aluno || (origem.idx.nome !== -1 ? String(origem.row[origem.idx.nome] || "").trim() : "");
  const cpfAtual = cpf || (origem.idx.cpf !== -1 ? String(origem.row[origem.idx.cpf] || "").trim() : "");
  const matAtual = matricula || (origem.idx.mat !== -1 ? String(origem.row[origem.idx.mat] || "").trim() : "");
  const turmaOrigem = origem.idx.turma !== -1 ? String(origem.row[origem.idx.turma] || "").trim() : "";

  const statusAtual = origem.idx.statusMatricula !== -1 ? normalizarStatusMatricula_(origem.row[origem.idx.statusMatricula]) : "ATIVO";
  if (statusAtual === "TRANSFERIDO") throw new Error("Este aluno já está marcado como transferido.");
  if (statusAtual === "TRANSFERENCIA_ENVIADA" || statusAtual === "TRANSFERÊNCIA ENVIADA") {
    throw new Error("Este aluno já possui transferência enviada/pendente.");
  }

  if (existeTransferenciaPendenteAtiva_(base, cpfAtual, matAtual, escolaOrigem)) {
    throw new Error("Já existe uma transferência pendente para este aluno.");
  }

  // Confirma que a escola destino existe na configuração.
  getPlanilhaEscolaDestino_(escolaDestino, base);

  const idTransferencia = "TRF-" + Utilities.getUuid();
  const dataSolicitacao = new Date();

  origem.sh.getRange(origem.linha, origem.idx.statusMatricula + 1).setValue("TRANSFERENCIA_ENVIADA");
  origem.sh.getRange(origem.linha, origem.idx.escolaDestino + 1).setValue(escolaDestino);
  origem.sh.getRange(origem.linha, origem.idx.turmaDestino + 1).setValue("");
  origem.sh.getRange(origem.linha, origem.idx.dataTransferencia + 1).setValue(dataSolicitacao);
  origem.sh.getRange(origem.linha, origem.idx.statusTransferencia + 1).setValue("AGUARDANDO_ACEITE");
  origem.sh.getRange(origem.linha, origem.idx.idTransferencia + 1).setValue(idTransferencia);

  const shPend = garantirAbaTransferenciasPendentes_();
  shPend.appendRow([
    idTransferencia,
    dataSolicitacao,
    base,
    cpfAtual,
    matAtual,
    alunoNome,
    escolaOrigem,
    turmaOrigem,
    escolaDestino,
    "",
    "AGUARDANDO_ACEITE",
    motivo,
    observacao,
    session.usuario || "",
    "",
    "",
    "",
    "",
    origem.ss.getName() + " / " + origem.sh.getName() + " / linha " + origem.linha,
    ""
  ]);

  registrarLogCadastro_(session, {
    acao: "SOLICITAR_TRANSFERENCIA",
    base: base,
    escola: escolaOrigem,
    matricula: matAtual,
    nome: alunoNome,
    cpfAnterior: cpfAtual,
    cpfNovo: "",
    destino: escolaDestino,
    resultado: "AGUARDANDO_ACEITE"
  });

  registrarLogTransferencia_(session, {
    idTransferencia: idTransferencia,
    acao: "SOLICITAR_TRANSFERENCIA",
    base: base,
    cpf: cpfAtual,
    matricula: matAtual,
    aluno: alunoNome,
    escolaOrigem: escolaOrigem,
    escolaDestino: escolaDestino,
    turmaOrigem: turmaOrigem,
    turmaDestino: "",
    statusAnterior: statusAtual,
    statusNovo: "AGUARDANDO_ACEITE",
    motivo: motivo,
    observacao: observacao,
    resultado: "Solicitação enviada para aceite da escola destino"
  });

  return {
    ok: true,
    idTransferencia: idTransferencia,
    mensagem: "Transferência enviada. A escola destino deverá aceitar e vincular a turma.",
    status: "AGUARDANDO_ACEITE"
  };
}

function listarTransferenciasPendentes(token, filtros) {
  const session = requireSession_(token);
  filtros = filtros || {};
  const sh = garantirAbaTransferenciasPendentes_();
  const data = sh.getDataRange().getValues();

  if (data.length < 2) {
    return {
      recebidas: [],
      enviadas: [],
      todas: [],
      resumo: { recebidas: 0, enviadas: 0, pendentes: 0 }
    };
  }

  const idx = mapHeaders_(data[0]);
  const tz = Session.getScriptTimeZone();

  function formatarData_(valor) {
    if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor.getTime())) {
      return Utilities.formatDate(valor, tz, "dd/MM/yyyy HH:mm:ss");
    }
    return String(valor || "");
  }

  const lista = data.slice(1).map(function(r, i) {
    return {
      linha: i + 2,
      idTransferencia: String(r[idx.ID_TRANSFERENCIA] || "").trim(),
      dataSolicitacao: formatarData_(r[idx.DATA_SOLICITACAO]),
      base: String(r[idx.BASE] || "").trim(),
      cpf: String(r[idx.CPF] || "").trim(),
      matricula: String(r[idx.MAT_ORIGEM] || "").trim(),
      aluno: String(r[idx.ALUNO] || "").trim(),
      escolaOrigem: String(r[idx.ESCOLA_ORIGEM] || "").trim(),
      turmaOrigem: String(r[idx.TURMA_ORIGEM] || "").trim(),
      escolaDestino: String(r[idx.ESCOLA_DESTINO] || "").trim(),
      turmaDestino: String(r[idx.TURMA_DESTINO] || "").trim(),
      status: String(r[idx.STATUS] || "").trim(),
      motivo: String(r[idx.MOTIVO] || "").trim(),
      observacao: String(r[idx.OBSERVACAO] || "").trim(),
      usuarioOrigem: String(r[idx.USUARIO_ORIGEM] || "").trim(),
      usuarioDestino: String(r[idx.USUARIO_DESTINO] || "").trim(),
      dataAceite: formatarData_(r[idx.DATA_ACEITE]),
      dataRecusa: formatarData_(r[idx.DATA_RECUSA]),
      justificativaRecusa: String(r[idx.JUSTIFICATIVA_RECUSA] || "").trim()
    };
  });

  const statusFiltro = normalizarTexto_(filtros.status || "");
  const incluirHistorico = filtros && filtros.incluirHistorico === true;
  const somentePendentes = statusFiltro ? false : !incluirHistorico;

  let filtrada = lista.filter(function(item) {
    if (statusFiltro && normalizarTexto_(item.status) !== statusFiltro) return false;
    if (somentePendentes && normalizarTexto_(item.status) !== "AGUARDANDO_ACEITE") return false;
    return true;
  });

  const recebidas = filtrada.filter(function(item) {
    return usuarioPodeAcessarEscolaTransferencia_(session, item.escolaDestino);
  });

  const enviadas = filtrada.filter(function(item) {
    return usuarioPodeAcessarEscolaTransferencia_(session, item.escolaOrigem);
  });

  const perfil = normalizarTexto_(session && session.perfil ? session.perfil : "");
  const todas = perfil === "ADM" ? filtrada : filtrada.filter(function(item) {
    return usuarioPodeAcessarEscolaTransferencia_(session, item.escolaOrigem) ||
      usuarioPodeAcessarEscolaTransferencia_(session, item.escolaDestino);
  });

  return {
    recebidas: recebidas,
    enviadas: enviadas,
    todas: todas,
    resumo: {
      recebidas: recebidas.length,
      enviadas: enviadas.length,
      pendentes: todas.filter(function(x) { return normalizarTexto_(x.status) === "AGUARDANDO_ACEITE"; }).length
    }
  };
}

function localizarTransferenciaPendentePorId_(idTransferencia) {
  const sh = garantirAbaTransferenciasPendentes_();
  const data = sh.getDataRange().getValues();
  if (data.length < 2) throw new Error("Não há transferências registradas.");

  const idx = mapHeaders_(data[0]);
  const idNorm = normalizarTexto_(idTransferencia);

  for (let i = 1; i < data.length; i++) {
    if (normalizarTexto_(data[i][idx.ID_TRANSFERENCIA]) === idNorm) {
      return {
        sh: sh,
        idx: idx,
        linha: i + 1,
        row: data[i]
      };
    }
  }

  throw new Error("Transferência não encontrada.");
}

function copiarAlunoParaPlanilhaDestino_(origemInfo, escolaDestino, turmaDestino, idTransferencia) {
  const base = String(origemInfo.base || "ESCOLAR").toUpperCase();
  const destino = getPlanilhaEscolaDestino_(escolaDestino, base);

  const ssDestino = SpreadsheetApp.openById(destino.spreadsheetId);
  const shDestino = ssDestino.getSheetByName(destino.sheetName || "BASE_GERAL");
  if (!shDestino) throw new Error("Aba da escola destino não encontrada: " + (destino.sheetName || "BASE_GERAL"));

  const valoresDestino = shDestino.getDataRange().getValues();
  const headerIndexDestino = localizarCabecalhoPlanilhaOrigem_(valoresDestino);
  if (headerIndexDestino === -1) throw new Error("Não consegui identificar o cabeçalho da escola destino.");

  garantirColunasTransferenciaNaAba_(shDestino, headerIndexDestino);

  const valoresDestinoAtualizados = shDestino.getDataRange().getValues();
  const headersDestino = valoresDestinoAtualizados[headerIndexDestino];
  const headersDestinoNorm = headersDestino.map(function(h) { return normalizarTexto_(h); });

  const origemLinha = localizarLinhaAlunoNaPlanilhaOrigem_({
    base: base,
    escola: origemInfo.escolaOrigem,
    matricula: origemInfo.matricula,
    cpf: origemInfo.cpf,
    nome: origemInfo.aluno
  });

  const headersOrigem = origemLinha.valores[origemLinha.headerIndex];
  const headersOrigemNorm = headersOrigem.map(function(h) { return normalizarTexto_(h); });
  const rowOrigem = origemLinha.row;

  const novaLinha = headersDestino.map(function(h, j) {
    const hNorm = headersDestinoNorm[j];

    if (hNorm === "ESCOLA" || hNorm === "NOME DA ESCOLA") return escolaDestino;
    if (hNorm === "TURMA" || hNorm === "SERIE" || hNorm === "SÉRIE") return turmaDestino;
    if (hNorm === "STATUS_MATRICULA") return "ATIVO";
    if (hNorm === "ESCOLA_DESTINO") return "";
    if (hNorm === "TURMA_DESTINO") return "";
    if (hNorm === "DATA_TRANSFERENCIA") return new Date();
    if (hNorm === "STATUS_TRANSFERENCIA") return "CONCLUIDA";
    if (hNorm === "ID_TRANSFERENCIA") return idTransferencia;

    const idxOrigem = headersOrigemNorm.indexOf(hNorm);
    return idxOrigem !== -1 ? rowOrigem[idxOrigem] : "";
  });

  shDestino.appendRow(novaLinha);
  const linhaNova = shDestino.getLastRow();

  // Atualiza origem como transferida.
  origemLinha.sh.getRange(origemLinha.linha, origemLinha.idx.statusMatricula + 1).setValue("TRANSFERIDO");
  origemLinha.sh.getRange(origemLinha.linha, origemLinha.idx.escolaDestino + 1).setValue(escolaDestino);
  origemLinha.sh.getRange(origemLinha.linha, origemLinha.idx.turmaDestino + 1).setValue(turmaDestino);
  origemLinha.sh.getRange(origemLinha.linha, origemLinha.idx.dataTransferencia + 1).setValue(new Date());
  origemLinha.sh.getRange(origemLinha.linha, origemLinha.idx.statusTransferencia + 1).setValue("CONCLUIDA");
  origemLinha.sh.getRange(origemLinha.linha, origemLinha.idx.idTransferencia + 1).setValue(idTransferencia);

  return {
    destinoNovaLinha: ssDestino.getName() + " / " + shDestino.getName() + " / linha " + linhaNova,
    destinoOrigem: origemLinha.ss.getName() + " / " + origemLinha.sh.getName() + " / linha " + origemLinha.linha
  };
}

function confirmarTransferenciaAluno(token, payload) {
  const session = requireSession_(token);
  if (!perfilPodeAceitarTransferencia_(session)) {
    throw new Error("Apenas EDUCAÇÃO destino ou ADM podem confirmar transferência. O perfil SAÚDE apenas visualiza.");
  }

  payload = payload || {};
  const idTransferencia = String(payload.idTransferencia || "").trim();
  const turmaDestino = String(payload.turmaDestino || "").trim();

  if (!idTransferencia) throw new Error("ID da transferência não informado.");
  if (!turmaDestino) throw new Error("Informe a turma de destino antes de confirmar.");

  const tr = localizarTransferenciaPendentePorId_(idTransferencia);
  const r = tr.row;
  const idx = tr.idx;

  const statusAtual = normalizarTexto_(r[idx.STATUS]);
  if (statusAtual !== "AGUARDANDO_ACEITE") {
    throw new Error("Esta transferência não está aguardando aceite.");
  }

  const escolaDestino = String(r[idx.ESCOLA_DESTINO] || "").trim();
  if (!usuarioPodeAcessarEscolaTransferencia_(session, escolaDestino)) {
    throw new Error("Você só pode aceitar transferência destinada à sua escola.");
  }

  const origemInfo = {
    base: String(r[idx.BASE] || "").trim(),
    cpf: String(r[idx.CPF] || "").trim(),
    matricula: String(r[idx.MAT_ORIGEM] || "").trim(),
    aluno: String(r[idx.ALUNO] || "").trim(),
    escolaOrigem: String(r[idx.ESCOLA_ORIGEM] || "").trim(),
    turmaOrigem: String(r[idx.TURMA_ORIGEM] || "").trim()
  };

  const resultado = copiarAlunoParaPlanilhaDestino_(origemInfo, escolaDestino, turmaDestino, idTransferencia);

  tr.sh.getRange(tr.linha, idx.TURMA_DESTINO + 1).setValue(turmaDestino);
  tr.sh.getRange(tr.linha, idx.STATUS + 1).setValue("CONCLUIDA");
  tr.sh.getRange(tr.linha, idx.USUARIO_DESTINO + 1).setValue(session.usuario || "");
  tr.sh.getRange(tr.linha, idx.DATA_ACEITE + 1).setValue(new Date());
  tr.sh.getRange(tr.linha, idx.DESTINO_ORIGEM + 1).setValue(resultado.destinoOrigem);
  tr.sh.getRange(tr.linha, idx.DESTINO_NOVA_LINHA + 1).setValue(resultado.destinoNovaLinha);

  registrarLogCadastro_(session, {
    acao: "CONFIRMAR_TRANSFERENCIA",
    base: origemInfo.base,
    escola: escolaDestino,
    matricula: origemInfo.matricula,
    nome: origemInfo.aluno,
    cpfAnterior: origemInfo.cpf,
    cpfNovo: "",
    destino: resultado.destinoNovaLinha,
    resultado: "CONCLUIDA"
  });

  registrarLogTransferencia_(session, {
    idTransferencia: idTransferencia,
    acao: "CONFIRMAR_TRANSFERENCIA",
    base: origemInfo.base,
    cpf: origemInfo.cpf,
    matricula: origemInfo.matricula,
    aluno: origemInfo.aluno,
    escolaOrigem: origemInfo.escolaOrigem,
    escolaDestino: escolaDestino,
    turmaOrigem: origemInfo.turmaOrigem,
    turmaDestino: turmaDestino,
    statusAnterior: "AGUARDANDO_ACEITE",
    statusNovo: "CONCLUIDA",
    motivo: String(r[idx.MOTIVO] || ""),
    observacao: String(r[idx.OBSERVACAO] || ""),
    resultado: resultado.destinoNovaLinha
  });

  return {
    ok: true,
    mensagem: "Transferência concluída. O aluno foi vinculado à turma informada na escola destino.",
    idTransferencia: idTransferencia,
    status: "CONCLUIDA",
    destinoNovaLinha: resultado.destinoNovaLinha
  };
}

function recusarTransferenciaAluno(token, payload) {
  const session = requireSession_(token);
  if (!perfilPodeAceitarTransferencia_(session)) {
    throw new Error("Apenas EDUCAÇÃO destino ou ADM podem recusar transferência. O perfil SAÚDE apenas visualiza.");
  }

  payload = payload || {};
  const idTransferencia = String(payload.idTransferencia || "").trim();
  const justificativa = String(payload.justificativa || "").trim();

  if (!idTransferencia) throw new Error("ID da transferência não informado.");
  if (!justificativa) throw new Error("Informe a justificativa da recusa.");

  const tr = localizarTransferenciaPendentePorId_(idTransferencia);
  const r = tr.row;
  const idx = tr.idx;

  const statusAtual = normalizarTexto_(r[idx.STATUS]);
  if (statusAtual !== "AGUARDANDO_ACEITE") {
    throw new Error("Esta transferência não está aguardando aceite.");
  }

  const escolaDestino = String(r[idx.ESCOLA_DESTINO] || "").trim();
  if (!usuarioPodeAcessarEscolaTransferencia_(session, escolaDestino)) {
    throw new Error("Você só pode recusar transferência destinada à sua escola.");
  }

  const origemInfo = {
    base: String(r[idx.BASE] || "").trim(),
    cpf: String(r[idx.CPF] || "").trim(),
    matricula: String(r[idx.MAT_ORIGEM] || "").trim(),
    aluno: String(r[idx.ALUNO] || "").trim(),
    escolaOrigem: String(r[idx.ESCOLA_ORIGEM] || "").trim()
  };

  const origemLinha = localizarLinhaAlunoNaPlanilhaOrigem_({
    base: origemInfo.base,
    escola: origemInfo.escolaOrigem,
    matricula: origemInfo.matricula,
    cpf: origemInfo.cpf,
    nome: origemInfo.aluno
  });

  origemLinha.sh.getRange(origemLinha.linha, origemLinha.idx.statusMatricula + 1).setValue("ATIVO");
  origemLinha.sh.getRange(origemLinha.linha, origemLinha.idx.escolaDestino + 1).setValue("");
  origemLinha.sh.getRange(origemLinha.linha, origemLinha.idx.turmaDestino + 1).setValue("");
  origemLinha.sh.getRange(origemLinha.linha, origemLinha.idx.statusTransferencia + 1).setValue("RECUSADA");

  tr.sh.getRange(tr.linha, idx.STATUS + 1).setValue("RECUSADA");
  tr.sh.getRange(tr.linha, idx.USUARIO_DESTINO + 1).setValue(session.usuario || "");
  tr.sh.getRange(tr.linha, idx.DATA_RECUSA + 1).setValue(new Date());
  tr.sh.getRange(tr.linha, idx.JUSTIFICATIVA_RECUSA + 1).setValue(justificativa);

  registrarLogCadastro_(session, {
    acao: "RECUSAR_TRANSFERENCIA",
    base: origemInfo.base,
    escola: escolaDestino,
    matricula: origemInfo.matricula,
    nome: origemInfo.aluno,
    cpfAnterior: origemInfo.cpf,
    destino: origemInfo.escolaOrigem,
    resultado: "RECUSADA"
  });

  registrarLogTransferencia_(session, {
    idTransferencia: idTransferencia,
    acao: "RECUSAR_TRANSFERENCIA",
    base: origemInfo.base,
    cpf: origemInfo.cpf,
    matricula: origemInfo.matricula,
    aluno: origemInfo.aluno,
    escolaOrigem: origemInfo.escolaOrigem,
    escolaDestino: escolaDestino,
    turmaOrigem: String(r[idx.TURMA_ORIGEM] || ""),
    turmaDestino: "",
    statusAnterior: "AGUARDANDO_ACEITE",
    statusNovo: "RECUSADA",
    motivo: String(r[idx.MOTIVO] || ""),
    observacao: justificativa,
    resultado: "RECUSADA"
  });

  return {
    ok: true,
    mensagem: "Transferência recusada. O aluno voltou ao status ATIVO na escola de origem.",
    idTransferencia: idTransferencia,
    status: "RECUSADA"
  };
}

function testarModuloTransferencias() {
  garantirAbaTransferenciasPendentes_();
  garantirAbaLogTransferencias_();
  return {
    ok: true,
    mensagem: "Módulo de transferências carregado. Abas TRANSFERENCIAS_PENDENTES e LOG_TRANSFERENCIAS garantidas.",
    aba: ABA_TRANSFERENCIAS_PENDENTES,
    log: ABA_LOG_TRANSFERENCIAS
  };
}


/**
 * Lista escolas disponíveis para transferência, usando CONFIG_PLANILHAS_ESCOLAS.
 * Necessário para o App preencher o campo "Escola destino".
 */
function listarEscolasTransferencia(token, base) {
  const session = requireSession_(token);
  if (!perfilPodeTransferir_(session)) {
    throw new Error("Apenas EDUCAÇÃO ou ADM podem consultar escolas de destino.");
  }

  base = String(base || "ESCOLAR").trim().toUpperCase();

  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const aba = ss.getSheetByName("CONFIG_PLANILHAS_ESCOLAS");
  if (!aba) {
    throw new Error("Aba CONFIG_PLANILHAS_ESCOLAS não encontrada.");
  }

  const data = aba.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0].map(function(h) { return normalizarTexto_(h); });
  const idxEscola = headers.indexOf("ESCOLA");
  const idxTipoBase = headers.indexOf("TIPO_BASE");
  const idxAtivo = headers.indexOf("ATIVO");

  if (idxEscola === -1) {
    throw new Error("CONFIG_PLANILHAS_ESCOLAS precisa ter a coluna ESCOLA.");
  }

  const mapa = {};

  for (let i = 1; i < data.length; i++) {
    const escola = String(data[i][idxEscola] || "").trim();
    if (!escola) continue;

    if (idxTipoBase !== -1) {
      const tipoBase = String(data[i][idxTipoBase] || "").trim().toUpperCase();
      if (tipoBase && normalizarTexto_(tipoBase) !== normalizarTexto_(base)) continue;
    }

    if (idxAtivo !== -1) {
      const ativo = normalizarTexto_(data[i][idxAtivo]);
      if (ativo && ativo !== "SIM" && ativo !== "S" && ativo !== "ATIVO") continue;
    }

    mapa[normalizarTexto_(escola)] = escola;
  }

  return Object.keys(mapa).map(function(k) { return mapa[k]; }).sort(function(a, b) {
    return a.localeCompare(b, "pt-BR");
  });
}
