/*******************************************************
 * AUTOAJUSTE - COLUNAS DE TRANSFERÊNCIA NA BASE INFANTIL
 * -----------------------------------------------------
 * Objetivo:
 * Inserir, nas planilhas INFANTIS de origem, as colunas
 * necessárias para o fluxo de transferência/movimentação.
 *
 * IMPORTANTE:
 * - Não altera a consolidada municipal.
 * - Não duplica colunas já existentes.
 * - Usa a aba BASE_GERAL.
 * - Considera cabeçalho na linha 6.
 *******************************************************/

const NOME_ABA_ORIGEM_TRANSFERENCIA_INFANTIL = 'BASE_GERAL';
const LINHA_CABECALHO_TRANSFERENCIA_INFANTIL = 6;

const IDS_INFANTIL_TRANSFERENCIA = [
  '11ROG0HUkiJcitqGzlGjX_Rg3sGPPNKU0TDMmubBy_O4',
  '1ch72GOkhQkKTU0YbFNTXjNXlvfA8MQvaU-caa8Nk_U4',
  '1l8-ZtdwSSO-_ZdcXFYAA_guMMdm70vQqOiFr_ZLCg_A',
  '1z9kDtGJTfxLhN6-aP6-wl0LnOVQmZpGwAC1_qhXyYT0',
  '1Jp-vBT6413BDil94_RLbnNSs_G4g0By2y6GigYe-D94',
  '1zo4smA96h2n0C50Sd51gDnIbTLfX6Dp0R-LxPvovQDM',
  '1xCuakqIQfFQ2yo16rZ4D2hs_Te7h5lYcMDr__bRwVLY',
  '1c0si699Gm8WXwGk9W7NRb1xpXWlQ-w4Q1f4DNDc5fpo',
  '1AGFoPAvHcpoC0RUVle6oavkP2BYBXjMtOtjQ5OGh3GE',
  '1jxvEvlO18uI4f0xmc_RxyUYdFkbDKG49VbhOiuZHovk',
  '1YGns9FxRX07gXFm29Zn7jmhBhLsop3qcXU1qIHg5UvE',
  '1wWD0kQ0IF62DGBhDYEIzO8PuPlALAKk4625PZLivP5w',
  '1PwbhRdX7Ku4_X1T1PwlbI5oKF9RARIdipywCegRCQYo',
  '1nm8gSLzngJlcUrNur87Confru593VNE83vhzHdOaHws',
  '1DASuakGMXDQmeIGGW2yAEHhLU854iUiMqwywuC3pS5I',
  '1z5nnWBSTvi_MeFoAhwQYNbC2J0Kev8B1YhQRrNIxN-A',
  '1zLkiq4gXEbdZDvQFqT4Yv_VcB0VNnOZUzgoxBSPCZh8'
];

const COLUNAS_TRANSFERENCIA_INFANTIL = [
  'STATUS_MATRICULA',
  'ESCOLA_DESTINO',
  'TURMA_DESTINO',
  'DATA_TRANSFERENCIA',
  'STATUS_TRANSFERENCIA',
  'ID_TRANSFERENCIA'
];

/**
 * Use primeiro para conferir no LOG, sem alterar as planilhas.
 */
function testarAutoAjusteTransferenciasInfantil() {
  autoAjustarColunasTransferenciaInfantil_(true);
}

/**
 * Executa o ajuste real nas planilhas infantis.
 */
function autoAjustarColunasTransferenciaInfantil() {
  autoAjustarColunasTransferenciaInfantil_(false);
}

function autoAjustarColunasTransferenciaInfantil_(somenteTeste) {
  const ssLog = SpreadsheetApp.getActiveSpreadsheet();
  const abaLog = obterOuCriarAbaLogTransferenciaInfantil_(ssLog);

  registrarLogTransferenciaInfantil_(abaLog, somenteTeste
    ? '🟡 INÍCIO DO TESTE - Autoajuste colunas transferência INFANTIL'
    : '🟢 INÍCIO DA EXECUÇÃO - Autoajuste colunas transferência INFANTIL'
  );

  IDS_INFANTIL_TRANSFERENCIA.forEach((idPlanilha, indice) => {
    try {
      const ssOrigem = SpreadsheetApp.openById(String(idPlanilha).trim());
      const aba = ssOrigem.getSheetByName(NOME_ABA_ORIGEM_TRANSFERENCIA_INFANTIL);

      if (!aba) {
        registrarLogTransferenciaInfantil_(abaLog, `[${indice + 1}] ${ssOrigem.getName()} - ABA BASE_GERAL NÃO ENCONTRADA`);
        return;
      }

      const ultimaColuna = Math.max(aba.getLastColumn(), 1);
      const cabecalho = aba.getRange(LINHA_CABECALHO_TRANSFERENCIA_INFANTIL, 1, 1, ultimaColuna).getValues()[0]
        .map(v => normalizarCabecalhoTransferenciaInfantil_(v));

      const faltantes = COLUNAS_TRANSFERENCIA_INFANTIL.filter(col => !cabecalho.includes(normalizarCabecalhoTransferenciaInfantil_(col)));

      if (faltantes.length === 0) {
        registrarLogTransferenciaInfantil_(abaLog, `[${indice + 1}] ${ssOrigem.getName()} - OK, todas as colunas já existem.`);
        return;
      }

      registrarLogTransferenciaInfantil_(abaLog, `[${indice + 1}] ${ssOrigem.getName()} - Colunas faltantes: ${faltantes.join(', ')}`);

      if (!somenteTeste) {
        inserirColunasNoFinalTransferenciaInfantil_(aba, faltantes);
        aplicarValidacoesTransferenciaInfantil_(aba);
        registrarLogTransferenciaInfantil_(abaLog, `[${indice + 1}] ${ssOrigem.getName()} - Colunas inseridas com sucesso.`);
      }
    } catch (erro) {
      registrarLogTransferenciaInfantil_(abaLog, `[${indice + 1}] ERRO no ID ${idPlanilha}: ${erro.message}`);
    }
  });

  registrarLogTransferenciaInfantil_(abaLog, somenteTeste
    ? '✅ TESTE FINALIZADO - Nenhuma planilha foi alterada.'
    : '✅ EXECUÇÃO FINALIZADA - Autoajuste infantil concluído.'
  );
}

function inserirColunasNoFinalTransferenciaInfantil_(aba, colunas) {
  const ultimaColuna = aba.getLastColumn();
  aba.insertColumnsAfter(ultimaColuna, colunas.length);
  aba.getRange(LINHA_CABECALHO_TRANSFERENCIA_INFANTIL, ultimaColuna + 1, 1, colunas.length).setValues([colunas]);
  aba.getRange(LINHA_CABECALHO_TRANSFERENCIA_INFANTIL, ultimaColuna + 1, 1, colunas.length)
    .setFontWeight('bold')
    .setBackground('#EAF3FF')
    .setHorizontalAlignment('center');
}

function aplicarValidacoesTransferenciaInfantil_(aba) {
  const ultimaColuna = aba.getLastColumn();
  const cabecalho = aba.getRange(LINHA_CABECALHO_TRANSFERENCIA_INFANTIL, 1, 1, ultimaColuna).getValues()[0]
    .map(v => normalizarCabecalhoTransferenciaInfantil_(v));

  const idxStatusMatricula = cabecalho.indexOf('STATUS_MATRICULA') + 1;
  const idxStatusTransferencia = cabecalho.indexOf('STATUS_TRANSFERENCIA') + 1;

  const maxLinhas = Math.max(aba.getMaxRows() - LINHA_CABECALHO_TRANSFERENCIA_INFANTIL, 1);

  if (idxStatusMatricula > 0) {
    const regra = SpreadsheetApp.newDataValidation()
      .requireValueInList(['ATIVO', 'TRANSFERIDO', 'PENDENTE', 'INATIVO', 'DUPLICADO'], true)
      .setAllowInvalid(true)
      .build();
    aba.getRange(LINHA_CABECALHO_TRANSFERENCIA_INFANTIL + 1, idxStatusMatricula, maxLinhas).setDataValidation(regra);
  }

  if (idxStatusTransferencia > 0) {
    const regra = SpreadsheetApp.newDataValidation()
      .requireValueInList(['', 'AGUARDANDO ACEITE', 'CONCLUÍDA', 'RECUSADA', 'CANCELADA'], true)
      .setAllowInvalid(true)
      .build();
    aba.getRange(LINHA_CABECALHO_TRANSFERENCIA_INFANTIL + 1, idxStatusTransferencia, maxLinhas).setDataValidation(regra);
  }
}

function obterOuCriarAbaLogTransferenciaInfantil_(ss) {
  const nome = 'LOG_AUTOAJUSTE_INFANTIL';
  let aba = ss.getSheetByName(nome);
  if (!aba) {
    aba = ss.insertSheet(nome);
    aba.getRange(1, 1, 1, 2).setValues([['DATA_HORA', 'MENSAGEM']]);
  }
  return aba;
}

function registrarLogTransferenciaInfantil_(abaLog, mensagem) {
  abaLog.appendRow([new Date(), mensagem]);
}

function normalizarCabecalhoTransferenciaInfantil_(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
