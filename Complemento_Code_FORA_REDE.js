/**
 * SIMVE — Complemento Transferências: FORA_REDE / retirada da cobrança
 * Criar como arquivo separado no Apps Script: Transferencias_ForaRede.gs
 * Depende das funções já existentes no seu Code.gs:
 * - requireSession_
 * - normalizarTexto_
 * - localizarLinhaAlunoNaPlanilhaOrigem_
 * - registrarLogCadastro_
 */
function registrarSaidaRedeAluno(token, payload) {
  const session = requireSession_(token);
  payload = payload || {};

  const perfil = normalizarTexto_(session && session.perfil ? session.perfil : "");
  if (perfil !== "EDUCACAO" && perfil !== "EDUCAÇÃO" && perfil !== "ADM") {
    throw new Error("Apenas EDUCAÇÃO ou ADM podem retirar aluno da cobrança.");
  }

  const base = String(payload.base || "ESCOLAR").trim().toUpperCase();
  const escolaOrigem = String(payload.escolaOrigem || payload.escola || "").trim();
  const matricula = String(payload.matricula || payload.matOrigem || "").trim();
  const cpf = String(payload.cpf || "").trim();
  const aluno = String(payload.nome || payload.aluno || "").trim();
  const tipo = String(payload.tipoMovimentacao || "FORA_REDE").trim().toUpperCase();
  const motivo = String(payload.motivo || "").trim();
  const observacao = String(payload.observacao || "").trim();
  const municipioDestino = String(payload.municipioDestino || "").trim();

  if (!base || !CONFIG_BASES[base]) throw new Error("Base inválida.");
  if (!escolaOrigem) throw new Error("Escola de origem não informada.");
  if (!matricula && !cpf) throw new Error("Informe matrícula ou CPF para localizar o aluno.");

  if (typeof usuarioPodeAcessarEscolaTransferencia_ === "function") {
    if (!usuarioPodeAcessarEscolaTransferencia_(session, escolaOrigem)) {
      throw new Error("Você só pode retirar da cobrança aluno da sua própria escola.");
    }
  }

  const origem = localizarLinhaAlunoNaPlanilhaOrigem_({
    base: base,
    escola: escolaOrigem,
    matricula: matricula,
    cpf: cpf,
    nome: aluno
  });

  const idTransferencia = "FORA-" + Utilities.getUuid();
  const agora = new Date();
  const statusFinal = tipo === "DUPLICIDADE" ? "DUPLICIDADE" : (tipo === "INATIVO" ? "INATIVO" : "FORA_REDE");

  origem.sh.getRange(origem.linha, origem.idx.statusMatricula + 1).setValue(statusFinal);
  origem.sh.getRange(origem.linha, origem.idx.escolaDestino + 1).setValue(municipioDestino || motivo || "FORA DA REDE");
  origem.sh.getRange(origem.linha, origem.idx.turmaDestino + 1).setValue("");
  origem.sh.getRange(origem.linha, origem.idx.dataTransferencia + 1).setValue(agora);
  origem.sh.getRange(origem.linha, origem.idx.statusTransferencia + 1).setValue("CONCLUIDA");
  origem.sh.getRange(origem.linha, origem.idx.idTransferencia + 1).setValue(idTransferencia);

  if (typeof registrarLogCadastro_ === "function") {
    registrarLogCadastro_(session, {
      acao: "RETIRAR_COBRANCA_" + statusFinal,
      base: base,
      escola: escolaOrigem,
      matricula: matricula,
      nome: aluno,
      cpfAnterior: cpf,
      cpfNovo: "",
      destino: municipioDestino || motivo || statusFinal,
      resultado: observacao || "CONCLUIDA"
    });
  }

  return {
    ok: true,
    idTransferencia: idTransferencia,
    status: statusFinal,
    mensagem: "Aluno marcado como " + statusFinal + ". Ele não deve ser cobrado após a próxima atualização dos indicadores."
  };
}
