function gerarConfigPlanilhasEscolas() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let aba = ss.getSheetByName("CONFIG_PLANILHAS_ESCOLAS");

  if (!aba) {
    aba = ss.insertSheet("CONFIG_PLANILHAS_ESCOLAS");
  }

  aba.clearContents();

  aba.getRange(1, 1, 1, 5).setValues([[
    "ESCOLA",
    "TIPO_BASE",
    "ID_PLANILHA",
    "ABA_ORIGEM",
    "ATIVO"
  ]]);

  const linhas = [];

  processarIdsConfig_(IDS_ESCOLAR, "ESCOLAR", linhas);
  processarIdsConfig_(IDS_INFANTIL, "INFANTIL", linhas);

  if (linhas.length > 0) {
    aba.getRange(2, 1, linhas.length, 5).setValues(linhas);
  }

  aba.autoResizeColumns(1, 5);

  SpreadsheetApp.getUi().alert(
    "CONFIG_PLANILHAS_ESCOLAS gerada com sucesso!"
  );
}

function processarIdsConfig_(listaIds, tipoBase, linhas) {

  listaIds.forEach(function(id) {

    try {

      const ssOrigem = SpreadsheetApp.openById(id);

      const abaOrigem = ssOrigem.getSheetByName("BASE_GERAL");

      if (!abaOrigem) return;

      const ultimaLinha = abaOrigem.getLastRow();
      const ultimaColuna = abaOrigem.getLastColumn();

      if (ultimaLinha < 7) return;

      const cabecalho = abaOrigem
        .getRange(6, 1, 1, ultimaColuna)
        .getValues()[0];

      const dados = abaOrigem
        .getRange(7, 1, Math.min(20, ultimaLinha - 6), ultimaColuna)
        .getValues();

      const idxEscola = cabecalho.findIndex(function(h) {

        const texto = String(h || "")
          .trim()
          .toUpperCase();

        return (
          texto === "ESCOLA" ||
          texto.includes("ESCOLA") ||
          texto.includes("INSTITUI")
        );

      });

      let escola = ssOrigem.getName();

      if (idxEscola !== -1) {

        for (let i = 0; i < dados.length; i++) {

          const valor = String(dados[i][idxEscola] || "").trim();

          if (valor) {
            escola = valor;
            break;
          }
        }
      }

      linhas.push([
        escola,
        tipoBase,
        id,
        "BASE_GERAL",
        "SIM"
      ]);

    } catch (e) {

      Logger.log(
        "Erro ao processar ID: " + id + " -> " + e.message
      );

    }

  });

}