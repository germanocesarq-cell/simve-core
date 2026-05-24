const NOME_ABA_ORIGEM = "BASE_GERAL";
const NOME_ABA_ESCOLAR = "BASE_ESCOLAR";
const NOME_ABA_INFANTIL = "BASE_INFANTIL";
const NOME_ABA_LOG = "LOG_ATUALIZACAO";

const LINHA_CABECALHO_ORIGEM = 6;
const LINHA_INICIO_DADOS_ORIGEM = 7;

// Colunas operacionais adicionadas nas planilhas de origem
// Mantidas também na consolidação municipal para evitar desalinhamento.
const COLUNAS_TRANSFERENCIA = [
  "STATUS_MATRICULA",
  "ESCOLA_DESTINO",
  "TURMA_DESTINO",
  "DATA_TRANSFERENCIA",
  "STATUS_TRANSFERENCIA",
  "ID_TRANSFERENCIA"
];

const IDS_ESCOLAR = [
  "1JnroUKcoM2faeWhZ2YEMLoDn5OouSS4SwKPBa7wHIws",
  "1jGWLO1ySLZGMKIVa9iVq2cZNF7Q5kkdhMmelefevpA0",
  "1npTL-lk1hxr789oZhL3akLbj8wxbJZuo-9Od-XmPtoo",
  "109-BI5tE5X49cMOv9r01WXQeya_hR5Ub5m4Ig16Gk3A",
  "12HkHBfLMZngFMbb62nwn6u8cNOjU6F__V090QwzkywE",
  "1g-B9w0A6ruc899J2ia2VT8x7qefUfOGBqrFL7MuCVbg",
  "13yjkoLabCyTTxmSlrpFYAXRqf_pIgjRfEUGVw_2yvD0",
  "1ryKHJlKT2cDTuCenCSz3PnZTH5wEKxW_plOBOxeQnBg",
  "1V5lDmVM68R8GYMTaMszukyf_FgEfzWYHbhuui-xqnkE",
  "1R1JNPMBR9arhVtZThU4LqPwTpv78Ek0GwjA3kQPoUkM",
  "1ZsOuprllnTatRnxPNIaGlkv8Ywj960Y2iwx_VkgLq3g",
  "1H-hcaiPZz-vGDxsf3ABppqbk8d6cb026Ny5OCTGd88c",
  "1TJdJ81qujSF3G6ZqduQadmetn6tK9FI92NEdTZMEL4w",
  "1WL7iW5Ixd8LCyNOwa1E_2prJpkt93ZaKGyGaut8gHO4",
  "1GJXeHqXd1Z3rpppiyf6YYYk03lKx-obYYEgZ2XuXdFU",
  "1WuCmQO7MwFcHRkHFzINXiW46-vzzhAbNiFFL7l-g5V0",
  "11WSfg-k_eChEiXpPDcvV-u1CvHo5RuZjfueVxouujCs",
  "1HuDge8r9Ga4XykcYDtVGXme4_RjJxQb9mA_ABKNa1PY"
];

const IDS_INFANTIL = [
  "11ROG0HUkiJcitqGzlGjX_Rg3sGPPNKU0TDMmubBy_O4",
  "1ch72GOkhQkKTU0YbFNTXjNXlvfA8MQvaU-caa8Nk_U4",
  "1l8-ZtdwSSO-_ZdcXFYAA_guMMdm70vQqOiFr_ZLCg_A",
  "1z9kDtGJTfxLhN6-aP6-wl0LnOVQmZpGwAC1_qhXyYT0",
  "1Jp-vBT6413BDil94_RLbnNSs_G4g0By2y6GigYe-D94",
  "1zo4smA96h2n0C50Sd51gDnIbTLfX6Dp0R-LxPvovQDM",
  "1xCuakqIQfFQ2yo16rZ4D2hs_Te7h5lYcMDr__bRwVLY",
  "1c0si699Gm8WXwGk9W7NRb1xpXWlQ-w4Q1f4DNDc5fpo",
  "1AGFoPAvHcpoC0RUVle6oavkP2BYBXjMtOtjQ5OGh3GE",
  "1jxvEvlO18uI4f0xmc_RxyUYdFkbDKG49VbhOiuZHovk",
  "1YGns9FxRX07gXFm29Zn7jmhBhLsop3qcXU1qIHg5UvE",
  "1wWD0kQ0IF62DGBhDYEIzO8PuPlALAKk4625PZLivP5w",
  "1PwbhRdX7Ku4_X1T1PwlbI5oKF9RARIdipywCegRCQYo",
  "1nm8gSLzngJlcUrNur87Confru593VNE83vhzHdOaHws",
  "1DASuakGMXDQmeIGGW2yAEHhLU854iUiMqwywuC3pS5I",
  "1z5nnWBSTvi_MeFoAhwQYNbC2J0Kev8B1YhQRrNIxN-A",
  "1zLkiq4gXEbdZDvQFqT4Yv_VcB0VNnOZUzgoxBSPCZh8"
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Atualização Municipal")
    .addItem("Atualizar ESCOLAR", "abrirDialogoEscolar")
    .addItem("Atualizar INFANTIL", "abrirDialogoInfantil")
    .addItem("Atualizar TODAS", "abrirDialogoTodas")
    .addSeparator()
    .addItem("Validar colunas de transferência", "validarColunasTransferenciaMunicipal")
    .addToUi();
}

function abrirDialogoEscolar() {
  abrirDialogo_("ESCOLAR");
}

function abrirDialogoInfantil() {
  abrirDialogo_("INFANTIL");
}

function abrirDialogoTodas() {
  abrirDialogo_("TODAS");
}

function abrirDialogo_(tipo) {
  const template = HtmlService.createTemplateFromFile("Progresso");
  template.tipo = tipo;
  const html = template.evaluate()
    .setWidth(420)
    .setHeight(280);
  SpreadsheetApp.getUi().showModelessDialog(html, "Atualização de Bases");
}

function getConfigAtualizacao(tipo) {
  if (tipo === "ESCOLAR") {
    return {
      tipo: "ESCOLAR",
      nomeAbaDestino: NOME_ABA_ESCOLAR,
      ids: IDS_ESCOLAR
    };
  }

  if (tipo === "INFANTIL") {
    return {
      tipo: "INFANTIL",
      nomeAbaDestino: NOME_ABA_INFANTIL,
      ids: IDS_INFANTIL
    };
  }

  if (tipo === "TODAS") {
    return {
      tipo: "TODAS",
      etapas: [
        { tipo: "ESCOLAR", nomeAbaDestino: NOME_ABA_ESCOLAR, ids: IDS_ESCOLAR },
        { tipo: "INFANTIL", nomeAbaDestino: NOME_ABA_INFANTIL, ids: IDS_INFANTIL }
      ]
    };
  }

  throw new Error("Tipo inválido.");
}

function prepararAtualizacao(tipo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = getConfigAtualizacao(tipo);

  if (tipo === "TODAS") {
    cfg.etapas.forEach(etapa => limparAbaDestino_(ss, etapa.nomeAbaDestino));
    registrarLog_(ss, "Início da atualização de TODAS as bases.");
    return {
      tipo: "TODAS",
      etapaAtual: 0,
      etapas: cfg.etapas.map(e => ({
        tipo: e.tipo,
        nomeAbaDestino: e.nomeAbaDestino,
        total: e.ids.length,
        atual: 0
      }))
    };
  }

  limparAbaDestino_(ss, cfg.nomeAbaDestino);
  registrarLog_(ss, `Início da atualização da base ${tipo}.`);
  return {
    tipo,
    nomeAbaDestino: cfg.nomeAbaDestino,
    total: cfg.ids.length,
    atual: 0
  };
}

function processarProximoArquivo(tipo, indiceEtapa, indiceArquivo) {
  const ssDestino = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = getConfigAtualizacao(tipo);

  let etapa;
  if (tipo === "TODAS") {
    etapa = cfg.etapas[indiceEtapa];
  } else {
    etapa = cfg;
  }

  const total = etapa.ids.length;

  if (indiceArquivo >= total) {
    return {
      concluido: true,
      tipoBase: etapa.tipo,
      indiceEtapa,
      indiceArquivo,
      total,
      percentual: 100
    };
  }

  const id = String(etapa.ids[indiceArquivo]).trim();
  const resultado = importarUmArquivo_(ssDestino, id, etapa.nomeAbaDestino, etapa.tipo);

  const atual = indiceArquivo + 1;
  const percentual = Math.round((atual / total) * 100);

  return {
    concluido: atual >= total,
    tipoBase: etapa.tipo,
    indiceEtapa,
    indiceArquivo: atual,
    total,
    percentual,
    mensagem: resultado.mensagem
  };
}

function importarUmArquivo_(ssDestino, idPlanilha, nomeAbaDestino, tipoBase) {
  try {
    const ssOrigem = SpreadsheetApp.openById(idPlanilha);
    const abaOrigem = ssOrigem.getSheetByName(NOME_ABA_ORIGEM);

    if (!abaOrigem) {
      const msg = `[${tipoBase}] ${idPlanilha}: aba BASE_GERAL não encontrada`;
      registrarLog_(ssDestino, msg);
      return { ok: false, mensagem: msg };
    }

    const ultimaLinha = abaOrigem.getLastRow();
    const ultimaColuna = abaOrigem.getLastColumn();

    if (ultimaLinha < LINHA_INICIO_DADOS_ORIGEM) {
      const msg = `[${tipoBase}] ${ssOrigem.getName()}: sem dados suficientes`;
      registrarLog_(ssDestino, msg);
      return { ok: false, mensagem: msg };
    }

    const cabecalhoOrigem = abaOrigem
      .getRange(LINHA_CABECALHO_ORIGEM, 1, 1, ultimaColuna)
      .getValues()[0];

    const cabecalhoDestino = montarCabecalhoPadronizado_(cabecalhoOrigem);

    const dadosOrigem = abaOrigem
      .getRange(LINHA_INICIO_DADOS_ORIGEM, 1, ultimaLinha - (LINHA_INICIO_DADOS_ORIGEM - 1), ultimaColuna)
      .getValues();

    const dadosValidos = dadosOrigem
      .filter(linha => linhaTemAluno_(linha, cabecalhoOrigem))
      .map(linha => normalizarLinhaParaCabecalhoDestino_(linha, cabecalhoOrigem, cabecalhoDestino));

    const abaDestino = obterOuCriarAba_(ssDestino, nomeAbaDestino);
    garantirCabecalhoDestino_(abaDestino, cabecalhoDestino);

    if (dadosValidos.length > 0) {
      const primeiraLinhaLivre = abaDestino.getLastRow() + 1;
      abaDestino
        .getRange(primeiraLinhaLivre, 1, dadosValidos.length, cabecalhoDestino.length)
        .setValues(dadosValidos);
    }

    const msg = `[${tipoBase}] ${ssOrigem.getName()}: ${dadosValidos.length} registros importados`;
    registrarLog_(ssDestino, msg);
    return { ok: true, mensagem: msg };
  } catch (e) {
    const msg = `[${tipoBase}] Erro no arquivo ${idPlanilha}: ${e.message}`;
    registrarLog_(ssDestino, msg);
    return { ok: false, mensagem: msg };
  }
}

function montarCabecalhoPadronizado_(cabecalhoOrigem) {
  const cabecalhoLimpo = cabecalhoOrigem.map(h => String(h || "").trim());
  const resultado = cabecalhoLimpo.filter(h => h !== "");
  const existentes = resultado.map(normalizarTexto_);

  COLUNAS_TRANSFERENCIA.forEach(coluna => {
    if (!existentes.includes(normalizarTexto_(coluna))) {
      resultado.push(coluna);
      existentes.push(normalizarTexto_(coluna));
    }
  });

  return resultado;
}

function garantirCabecalhoDestino_(abaDestino, cabecalhoNecessario) {
  if (abaDestino.getLastRow() === 0) {
    abaDestino.getRange(1, 1, 1, cabecalhoNecessario.length).setValues([cabecalhoNecessario]);
    formatarCabecalho_(abaDestino, cabecalhoNecessario.length);
    return;
  }

  const ultimaColunaAtual = Math.max(abaDestino.getLastColumn(), 1);
  const cabecalhoAtual = abaDestino.getRange(1, 1, 1, ultimaColunaAtual).getValues()[0]
    .map(h => String(h || "").trim())
    .filter(h => h !== "");

  const atualNorm = cabecalhoAtual.map(normalizarTexto_);
  const final = cabecalhoAtual.slice();

  cabecalhoNecessario.forEach(coluna => {
    if (!atualNorm.includes(normalizarTexto_(coluna))) {
      final.push(coluna);
      atualNorm.push(normalizarTexto_(coluna));
    }
  });

  COLUNAS_TRANSFERENCIA.forEach(coluna => {
    if (!atualNorm.includes(normalizarTexto_(coluna))) {
      final.push(coluna);
      atualNorm.push(normalizarTexto_(coluna));
    }
  });

  abaDestino.getRange(1, 1, 1, final.length).setValues([final]);
  formatarCabecalho_(abaDestino, final.length);
}

function normalizarLinhaParaCabecalhoDestino_(linhaOrigem, cabecalhoOrigem, cabecalhoDestino) {
  const mapaOrigem = criarMapaCabecalho_(cabecalhoOrigem);

  return cabecalhoDestino.map(colunaDestino => {
    const idx = mapaOrigem[normalizarTexto_(colunaDestino)];
    return idx === undefined ? "" : linhaOrigem[idx];
  });
}

function criarMapaCabecalho_(cabecalho) {
  const mapa = {};
  cabecalho.forEach((h, i) => {
    const chave = normalizarTexto_(h);
    if (chave && mapa[chave] === undefined) {
      mapa[chave] = i;
    }
  });
  return mapa;
}

function finalizarAtualizacao(tipo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const horario = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
  registrarLog_(ss, `Atualização ${tipo} concluída às ${horario}.`);
  return `✅ Atualização ${tipo} concluída às ${horario}.`;
}

function linhaTemAluno_(linha, cabecalho) {
  const idxAluno = cabecalho.findIndex(h => {
    const t = String(h || "").trim().toUpperCase();
    return t === "ALUNO" || t.includes("ALUNO") || t === "NOME";
  });

  if (idxAluno === -1) return false;

  const aluno = String(linha[idxAluno] || "").trim();
  if (!aluno) return false;

  const alunoU = aluno.toUpperCase();
  const proibidos = [
    "ÚLTIMA ATUALIZAÇÃO",
    "BASE GERAL",
    "CONTROLE VACINAL",
    "SEM DADOS",
    "ALUNO",
    "NOME"
  ];

  return !proibidos.some(p => alunoU.includes(p));
}

function limparAbaDestino_(ss, nomeAba) {
  let aba = ss.getSheetByName(nomeAba);
  if (!aba) {
    aba = ss.insertSheet(nomeAba);
  }
  aba.clearContents();
}

function obterOuCriarAba_(ss, nome) {
  let aba = ss.getSheetByName(nome);
  if (!aba) aba = ss.insertSheet(nome);
  return aba;
}

function registrarLog_(ss, mensagem) {
  let abaLog = ss.getSheetByName(NOME_ABA_LOG);

  if (!abaLog) {
    abaLog = ss.insertSheet(NOME_ABA_LOG);
    abaLog.getRange(1, 1, 1, 2).setValues([["DATA_HORA", "MENSAGEM"]]);
  }

  abaLog.appendRow([new Date(), mensagem]);
}

function formatarCabecalho_(aba, qtdColunas) {
  aba.getRange(1, 1, 1, qtdColunas)
    .setFontWeight("bold")
    .setBackground("#e8f0fe");
}

function normalizarTexto_(texto) {
  return String(texto || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

// Função de conferência manual.
// Verifica se a consolidação municipal já recebeu as colunas nas duas abas.
function validarColunasTransferenciaMunicipal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abas = [NOME_ABA_ESCOLAR, NOME_ABA_INFANTIL];
  const mensagens = [];

  abas.forEach(nomeAba => {
    const aba = ss.getSheetByName(nomeAba);
    if (!aba || aba.getLastRow() === 0) {
      mensagens.push(`${nomeAba}: ainda sem dados consolidados.`);
      return;
    }

    const cabecalho = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].map(normalizarTexto_);
    const faltantes = COLUNAS_TRANSFERENCIA.filter(c => !cabecalho.includes(normalizarTexto_(c)));

    if (faltantes.length === 0) {
      mensagens.push(`${nomeAba}: OK - colunas de transferência presentes.`);
    } else {
      mensagens.push(`${nomeAba}: faltando ${faltantes.join(", ")}.`);
    }
  });

  const msgFinal = mensagens.join("\n");
  SpreadsheetApp.getUi().alert(msgFinal);
  registrarLog_(ss, msgFinal);
}
