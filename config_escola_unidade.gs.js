function atualizarConfigEscolaUnidade() {
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const nomeAbaConfig = "CONFIG_ESCOLA_UNIDADE";

  let abaConfig = ss.getSheetByName(nomeAbaConfig);
  if (!abaConfig) {
    abaConfig = ss.insertSheet(nomeAbaConfig);
  }

  // 🔹 Mapa do que já existe (não perder unidade já preenchida)
  const mapaExistente = {};
  const ultimaLinha = abaConfig.getLastRow();

  if (ultimaLinha >= 2) {
    const dados = abaConfig.getRange(2, 1, ultimaLinha - 1, 2).getValues();
    dados.forEach(linha => {
      const escola = normalizarTexto_(linha[0]);
      const unidade = linha[1];
      if (escola) mapaExistente[escola] = unidade;
    });
  }

  const escolasSet = new Set();

  // 🔹 Lê BASE_ESCOLAR e BASE_INFANTIL
  ["BASE_ESCOLAR", "BASE_INFANTIL"].forEach(nomeAba => {
    const sh = ss.getSheetByName(nomeAba);
    if (!sh) return;

    const dados = sh.getDataRange().getValues();
    if (dados.length < 2) return;

    const headers = dados[0].map(h => String(h || "").trim());
    const idxEscola = headers.indexOf("ESCOLA");

    if (idxEscola === -1) return;

    for (let i = 1; i < dados.length; i++) {
      const escola = String(dados[i][idxEscola] || "").trim();
      if (escola) escolasSet.add(escola);
    }
  });

  // 🔹 Monta nova tabela
  const linhas = Array.from(escolasSet)
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map(escola => [
      escola,
      mapaExistente[normalizarTexto_(escola)] || ""
    ]);

  // 🔹 Escreve na aba
  abaConfig.clearContents();
  abaConfig.getRange(1, 1, 1, 2).setValues([["ESCOLA", "UNIDADE"]]);

  if (linhas.length > 0) {
    abaConfig.getRange(2, 1, linhas.length, 2).setValues(linhas);
  }

  abaConfig.setFrozenRows(1);
  abaConfig.autoResizeColumns(1, 2);

  Logger.log("Total de escolas: " + linhas.length);
}