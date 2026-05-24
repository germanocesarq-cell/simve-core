function listarEscolas() {
  const ss = SpreadsheetApp.openById("1eGGyYr4d5ywxzt22iq6eFFTd5GCx5EA4l5MaoKHdy4U");

  const abas = ["BASE_ESCOLAR", "BASE_INFANTIL"];
  const escolas = new Set();

  abas.forEach(nomeAba => {
    const aba = ss.getSheetByName(nomeAba);
    const dados = aba.getDataRange().getValues();
    const cabecalho = dados[0];
    const colEscola = cabecalho.indexOf("ESCOLA");

    if (colEscola === -1) return;

    dados.slice(1).forEach(linha => {
      if (linha[colEscola]) {
        escolas.add(String(linha[colEscola]).trim());
      }
    });
  });

  Logger.log([...escolas].sort());
}