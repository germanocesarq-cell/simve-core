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
