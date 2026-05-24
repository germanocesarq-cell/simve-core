/**
 * SIMVE - Fluxo Modelo B
 * Status:
 * ATIVO
 * TRANSFERENCIA_ENVIADA
 * AGUARDANDO_VINCULO
 * FORA_REDE
 * RECUSADA
 */

function solicitarTransferenciaAluno(payload){
  return {
    sucesso: true,
    status: 'TRANSFERENCIA_ENVIADA',
    mensagem: 'Transferência enviada com sucesso.'
  };
}

function aceitarTransferenciaAluno(payload){
  return {
    sucesso: true,
    status: 'AGUARDANDO_VINCULO',
    mensagem: 'Transferência aceita. Aguardando definição de turma.'
  };
}

function confirmarVinculoTransferencia(payload){
  return {
    sucesso: true,
    status: 'ATIVO',
    mensagem: 'Vínculo confirmado.'
  };
}

function registrarLogTransferencia(log){
  Logger.log(log);
}
