function preencherCodigoEscolaNasBases() {
  const ss = SpreadsheetApp.openById(ID_PLANILHA);

  const ref = ss.getSheetByName("ESCOLAS_REFERENCIA").getDataRange().getValues();
  const idxRef = mapHeaders_(ref[0]);

  const mapa = {};

  ref.slice(1).forEach(r => {
    const nome = normalizarTextoDebug_(r[idxRef.NOME_OFICIAL]);
    const codigo = r[idxRef.CODIGO_ESCOLA];
    mapa[nome] = codigo;
  });

  atualizarBase("BASE_ESCOLAR", mapa);
  atualizarBase("BASE_INFANTIL", mapa);

  Logger.log("Códigos preenchidos com sucesso.");
}

function atualizarBase(nomeAba, mapa) {
  const ss = SpreadsheetApp.openById(ID_PLANILHA);
  const sh = ss.getSheetByName(nomeAba);

  const dados = sh.getDataRange().getValues();
  const idx = mapHeaders_(dados[0]);

  if (idx["ESCOLA"] == null) throw new Error("Coluna ESCOLA não encontrada em " + nomeAba);

  // cria coluna se não existir
  let colCodigo = idx["CODIGO_ESCOLA"];
  if (colCodigo == null) {
    colCodigo = dados[0].length;
    sh.getRange(1, colCodigo + 1).setValue("CODIGO_ESCOLA");
  }

  const novos = [];

  dados.slice(1).forEach(linha => {
    const nome = normalizarTextoDebug_(linha[idx["ESCOLA"]]);
    const codigo = mapa[nome] || "";
    novos.push([codigo]);
  });

  sh.getRange(2, colCodigo + 1, novos.length, 1).setValues(novos);
}