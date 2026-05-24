function normalizarTextoEscola_(valor) {
  return String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function gerarEscolasReferenciaAutomatico() {
  const ss = SpreadsheetApp.openById(ID_PLANILHA);

  const shEscolar = ss.getSheetByName("BASE_ESCOLAR");
  const shInfantil = ss.getSheetByName("BASE_INFANTIL");

  if (!shEscolar) throw new Error("A aba BASE_ESCOLAR não foi encontrada.");
  if (!shInfantil) throw new Error("A aba BASE_INFANTIL não foi encontrada.");

  const dadosEscolar = shEscolar.getDataRange().getValues();
  const dadosInfantil = shInfantil.getDataRange().getValues();

  if (dadosEscolar.length < 2 && dadosInfantil.length < 2) {
    throw new Error("As bases estão vazias.");
  }

  const idxEscolar = mapHeaders_(dadosEscolar[0]);
  const idxInfantil = mapHeaders_(dadosInfantil[0]);

  if (idxEscolar["ESCOLA"] == null) throw new Error("Coluna ESCOLA não encontrada em BASE_ESCOLAR.");
  if (idxInfantil["ESCOLA"] == null) throw new Error("Coluna ESCOLA não encontrada em BASE_INFANTIL.");

  const mapa = {};

  // Lê BASE_ESCOLAR
  dadosEscolar.slice(1).forEach(linha => {
    const nome = String(linha[idxEscolar["ESCOLA"]] || "").trim();
    if (!nome) return;

    const chave = normalizarTextoEscola_(nome);

    if (!mapa[chave]) {
      mapa[chave] = {
        nomeOficial: nome,
        nomeCurto: nome,
        temEscolar: true,
        temInfantil: false
      };
    } else {
      mapa[chave].temEscolar = true;
    }
  });

  // Lê BASE_INFANTIL
  dadosInfantil.slice(1).forEach(linha => {
    const nome = String(linha[idxInfantil["ESCOLA"]] || "").trim();
    if (!nome) return;

    const chave = normalizarTextoEscola_(nome);

    if (!mapa[chave]) {
      mapa[chave] = {
        nomeOficial: nome,
        nomeCurto: nome,
        temEscolar: false,
        temInfantil: true
      };
    } else {
      mapa[chave].temInfantil = true;
    }
  });

  const linhas = Object.keys(mapa)
    .sort()
    .map((chave, i) => {
      const item = mapa[chave];

      let tipo = "";
      if (item.temEscolar && item.temInfantil) tipo = "AMBOS";
      else if (item.temEscolar) tipo = "ESCOLAR";
      else if (item.temInfantil) tipo = "INFANTIL";

      const codigo = "ESC" + String(i + 1).padStart(3, "0");

      return [
        codigo,
        item.nomeOficial,
        item.nomeCurto,
        tipo,
        "SIM",
        ""
      ];
    });

  let shRef = ss.getSheetByName("ESCOLAS_REFERENCIA");
  if (!shRef) {
    shRef = ss.insertSheet("ESCOLAS_REFERENCIA");
  } else {
    shRef.clearContents();
  }

  const cabecalho = [["CODIGO_ESCOLA", "NOME_OFICIAL", "NOME_CURTO", "TIPO", "ATIVO", "OBS"]];
  shRef.getRange(1, 1, 1, cabecalho[0].length).setValues(cabecalho);

  if (linhas.length) {
    shRef.getRange(2, 1, linhas.length, linhas[0].length).setValues(linhas);
  }

  shRef.setFrozenRows(1);
  shRef.autoResizeColumns(1, 6);

  Logger.log("ESCOLAS_REFERENCIA gerada com sucesso. Total de escolas: " + linhas.length);
}