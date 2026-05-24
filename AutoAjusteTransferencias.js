/**
 * AutoAjusteTransferencias.gs
 * Script separado para preparar as planilhas ESCOLARES das unidades/escolas
 * para o fluxo de transferência de alunos no SIMVE.
 *
 * IMPORTANTE:
 * - Rode primeiro a função testarAutoAjusteTransferenciasEscolar()
 * - Se estiver tudo certo, rode autoAjustarColunasTransferenciaEscolar()
 * - Este script NÃO altera dados dos alunos, apenas insere colunas faltantes no cabeçalho.
 */

const NOME_ABA_ORIGEM_TRANSFERENCIA = "BASE_GERAL";
const LINHA_CABECALHO_TRANSFERENCIA = 6;

// IDs das planilhas ESCOLARES identificadas no script de consolidação municipal.
const IDS_ESCOLAR_TRANSFERENCIA = [
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

const COLUNAS_TRANSFERENCIA_ESCOLAR = [
  "STATUS_MATRICULA",
  "STATUS_TRANSFERENCIA",
  "ESCOLA_DESTINO",
  "TURMA_DESTINO",
  "DATA_TRANSFERENCIA",
  "ID_TRANSFERENCIA",
  "USUARIO_TRANSFERENCIA",
  "OBS_TRANSFERENCIA"
];

const STATUS_MATRICULA_OPCOES = [
  "ATIVO",
  "TRANSFERENCIA_ENVIADA",
  "TRANSFERIDO",
  "PENDENTE_VINCULO",
  "INATIVO"
];

const STATUS_TRANSFERENCIA_OPCOES = [
  "",
  "AGUARDANDO_ACEITE",
  "CONCLUIDA",
  "RECUSADA",
  "CANCELADA"
];

/**
 * Use esta função primeiro.
 * Ela apenas verifica quais colunas faltam em cada planilha, sem alterar nada.
 */
function testarAutoAjusteTransferenciasEscolar() {
  const resultado = [];
  IDS_ESCOLAR_TRANSFERENCIA.forEach(id => {
    try {
      const ss = SpreadsheetApp.openById(id);
      const aba = ss.getSheetByName(NOME_ABA_ORIGEM_TRANSFERENCIA);

      if (!aba) {
        resultado.push([new Date(), ss.getName(), id, "ERRO", "Aba BASE_GERAL não encontrada"]);
        return;
      }

      const ultimaColuna = aba.getLastColumn();
      const cabecalho = aba.getRange(LINHA_CABECALHO_TRANSFERENCIA, 1, 1, ultimaColuna).getValues()[0]
        .map(h => normalizarCabecalhoTransferencia_(h));

      const faltantes = COLUNAS_TRANSFERENCIA_ESCOLAR.filter(col => !cabecalho.includes(normalizarCabecalhoTransferencia_(col)));

      resultado.push([
        new Date(),
        ss.getName(),
        id,
        faltantes.length === 0 ? "OK" : "FALTANDO",
        faltantes.join(", ")
      ]);
    } catch (e) {
      resultado.push([new Date(), "", id, "ERRO", e.message]);
    }
  });

  gravarLogAutoAjusteTransferencia_("LOG_TESTE_AUTOAJUSTE_TRANSFERENCIAS", resultado);
}

/**
 * Roda o autoajuste real.
 * Insere somente as colunas que ainda não existem.
 */
function autoAjustarColunasTransferenciaEscolar() {
  const resultado = [];

  IDS_ESCOLAR_TRANSFERENCIA.forEach(id => {
    try {
      const ss = SpreadsheetApp.openById(id);
      const aba = ss.getSheetByName(NOME_ABA_ORIGEM_TRANSFERENCIA);

      if (!aba) {
        resultado.push([new Date(), ss.getName(), id, "ERRO", "Aba BASE_GERAL não encontrada"]);
        return;
      }

      const ultimaColunaAntes = aba.getLastColumn();
      const cabecalhoAtual = aba.getRange(LINHA_CABECALHO_TRANSFERENCIA, 1, 1, ultimaColunaAntes).getValues()[0]
        .map(h => normalizarCabecalhoTransferencia_(h));

      const faltantes = COLUNAS_TRANSFERENCIA_ESCOLAR.filter(col => !cabecalhoAtual.includes(normalizarCabecalhoTransferencia_(col)));

      if (faltantes.length === 0) {
        aplicarValidacoesTransferencia_(aba);
        resultado.push([new Date(), ss.getName(), id, "OK", "Nenhuma coluna faltante. Validações conferidas."]);
        return;
      }

      const primeiraNovaColuna = aba.getLastColumn() + 1;
      aba.getRange(LINHA_CABECALHO_TRANSFERENCIA, primeiraNovaColuna, 1, faltantes.length).setValues([faltantes]);

      formatarCabecalhosTransferencia_(aba, primeiraNovaColuna, faltantes.length);
      aplicarValidacoesTransferencia_(aba);

      resultado.push([
        new Date(),
        ss.getName(),
        id,
        "AJUSTADO",
        "Colunas inseridas: " + faltantes.join(", ")
      ]);
    } catch (e) {
      resultado.push([new Date(), "", id, "ERRO", e.message]);
    }
  });

  gravarLogAutoAjusteTransferencia_("LOG_AUTOAJUSTE_TRANSFERENCIAS", resultado);
}

/**
 * Validações/listas suspensas nas colunas de status.
 */
function aplicarValidacoesTransferencia_(aba) {
  const ultimaColuna = aba.getLastColumn();
  const ultimaLinha = Math.max(aba.getMaxRows(), 1000);

  const cabecalho = aba.getRange(LINHA_CABECALHO_TRANSFERENCIA, 1, 1, ultimaColuna).getValues()[0]
    .map(h => normalizarCabecalhoTransferencia_(h));

  const colStatusMatricula = cabecalho.indexOf("STATUS_MATRICULA") + 1;
  const colStatusTransferencia = cabecalho.indexOf("STATUS_TRANSFERENCIA") + 1;

  if (colStatusMatricula > 0) {
    const regraMatricula = SpreadsheetApp.newDataValidation()
      .requireValueInList(STATUS_MATRICULA_OPCOES, true)
      .setAllowInvalid(false)
      .build();

    aba.getRange(LINHA_CABECALHO_TRANSFERENCIA + 1, colStatusMatricula, ultimaLinha - LINHA_CABECALHO_TRANSFERENCIA, 1)
      .setDataValidation(regraMatricula);
  }

  if (colStatusTransferencia > 0) {
    const regraTransferencia = SpreadsheetApp.newDataValidation()
      .requireValueInList(STATUS_TRANSFERENCIA_OPCOES, true)
      .setAllowInvalid(false)
      .build();

    aba.getRange(LINHA_CABECALHO_TRANSFERENCIA + 1, colStatusTransferencia, ultimaLinha - LINHA_CABECALHO_TRANSFERENCIA, 1)
      .setDataValidation(regraTransferencia);
  }
}

/**
 * Formatação leve dos novos cabeçalhos.
 */
function formatarCabecalhosTransferencia_(aba, primeiraNovaColuna, quantidade) {
  const range = aba.getRange(LINHA_CABECALHO_TRANSFERENCIA, primeiraNovaColuna, 1, quantidade);
  range.setFontWeight("bold");
  range.setHorizontalAlignment("center");
  range.setBackground("#EAF3FF");
  range.setWrap(true);
}

/**
 * Grava log na planilha municipal onde o script estiver rodando.
 */
function gravarLogAutoAjusteTransferencia_(nomeAbaLog, linhas) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let abaLog = ss.getSheetByName(nomeAbaLog);

  if (!abaLog) {
    abaLog = ss.insertSheet(nomeAbaLog);
    abaLog.getRange(1, 1, 1, 5).setValues([[
      "DATA_HORA",
      "NOME_PLANILHA",
      "ID_PLANILHA",
      "STATUS",
      "DETALHES"
    ]]);
    abaLog.setFrozenRows(1);
  }

  if (linhas.length > 0) {
    abaLog.getRange(abaLog.getLastRow() + 1, 1, linhas.length, 5).setValues(linhas);
  }
}

function normalizarCabecalhoTransferencia_(valor) {
  return String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
