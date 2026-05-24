function normalizarTextoDebug_(valor) {
  return String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function diagnosticarEscolasUsuarioSaude() {
  const perfil = "SAUDE";
  const usuarioTeste = "865834"; // TROQUE PELO USUÁRIO REAL
  const baseKey = "ESCOLAR"; // depois teste também com "INFANTIL"

  const userRow = findUserRow_(perfil, usuarioTeste);
  if (!userRow) throw new Error("Usuário não encontrado.");

  const session = {
    perfil,
    usuario: usuarioTeste,
    base: String(userRow.user.BASE || "").trim().toUpperCase(),
    escolasPermitidas: parseEscolasPermitidas_(userRow.user.ESCOLA)
  };

  const config = CONFIG_BASES[baseKey];
  const rows = lerAbaComoObjetos_(config.sheetName);
  const dados = rows.map(row => padronizarLinhaVacinal_(row, config));

  const escolasDaBase = [...new Set(
    dados.map(x => String(x.escola || "").trim()).filter(Boolean)
  )];

  const escolasUsuarioNormalizadas = session.escolasPermitidas.map(e => ({
    original: e,
    normalizado: normalizarTextoDebug_(e)
  }));

  const escolasBaseNormalizadas = escolasDaBase.map(e => ({
    original: e,
    normalizado: normalizarTextoDebug_(e)
  }));

  const escolasQueCasaram = [];
  const escolasSemCorrespondencia = [];

  escolasUsuarioNormalizadas.forEach(escolaUser => {
    const match = escolasBaseNormalizadas.find(
      escolaBase => escolaBase.normalizado === escolaUser.normalizado
    );

    if (match) {
      escolasQueCasaram.push({
        usuario: escolaUser.original,
        base: match.original
      });
    } else {
      escolasSemCorrespondencia.push(escolaUser.original);
    }
  });

  Logger.log(JSON.stringify({
    usuario: usuarioTeste,
    baseKey,
    baseUsuario: session.base,
    escolasPermitidasUsuario: session.escolasPermitidas,
    escolasDaBase,
    escolasQueCasaram,
    escolasSemCorrespondencia
  }, null, 2));
}