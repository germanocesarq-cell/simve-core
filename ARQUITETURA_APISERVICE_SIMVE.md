# Arquitetura proposta — apiService para SIMVE

Este documento descreve uma proposta de arquitetura para um `apiService` que centralize as chamadas ao backend (Apps Script) usadas pelo front-end do SIMVE. É apenas documentação: NÃO IMPLEMENTAR código nem alterar arquivos existentes.

1. Problemas atuais do `google.script.run` espalhado
- Chamadas distribuídas por `AppScript.html` via um wrapper ad-hoc `gas()` tornam difícil: rastrear contratos, aplicar políticas comuns de erro/retry, injetar `sessionToken` de forma consistente e implementar testes unitários.
- Código repetido: tratamento de sucesso/falha, normalização de erros e passagem de `sessionToken` é duplicada ou implícita.
- Alto acoplamento: payloads do backend são consumidos diretamente por métodos que atualizam muito estado, dificultando refatoração incremental.

2. Objetivos do `apiService`
- Encapsular `google.script.run` e suas handlers em um único ponto de responsabilidade.
- Normalizar contratos (entrada/saída), erros e logs/telemetria.
- Fornecer `run(functionName, ...args)` e `runWithToken(fn, ...args)` que injetam/validam `sessionToken` automaticamente.
- Facilitar testes (mock do serviço) e migração incremental (feature flags).

3. Estrutura proposta (namespaces / módulos)
- `auth`
  - `login(perfil, usuario, senha)` → `validarLogin`
  - `logout()` → `encerrarSessao`
  - `primeiroAcesso(token, s1, s2)` → `redefinirSenhaPrimeiroAcesso`
  - `solicitarRecuperacao(perfil, usuario)` → `solicitarRecuperacaoSenha`
  - `confirmarRecuperacao(perfil, usuario, codigo, s1, s2)` → `redefinirSenhaPorCodigo`
- `vacinal`
  - `listEscolas()` → `getEscolasPainelVacinal`
  - `getPainelPorEscola(escola, segmento, turma)` → `getPainelVacinalPorEscola`
  - `getHistoricoCobertura(escola, segmento, turma, vacEvol)` → `getHistoricoCobertura`
  - `getDashboardData(base, ...)` → `getDashboardData`
- `cadastral`
  - `getSituacao(base, escola, turma)` → `getSituacaoCadastral`
  - `getPainelAlunos(filtros)` → `getPainelCadastralAlunos`
  - `salvarCpf(payload)` → `salvarCpfAlunoCadastral`
- `ranking`
  - `getPainel()` → `getPainelRankingVacinal`
  - `getHistoricoEscola(escola)` → `getHistoricoDesempenhoEscola`
- `dashboard`
  - `getInicioPorPerfil()` → `getPainelInicioPorPerfil`
  - `getDocumentos()` → `getDocumentos`
- `admin`
  - `listarGatilhos()` → `listarGatilhosHistoricoCobertura`
  - `criarGatilho()` → `criarGatilhoHistoricoCobertura18h`
  - `excluirGatilho()` → `excluirGatilhoHistoricoCobertura18h`
  - `salvarHistoricoAgora()` → `salvarHistoricoCoberturaAgora`
- `feedback`
  - `enviar(tipo, mensagem)` → `enviarFeedback`

4. Exemplo conceitual do wrapper `run()`
- Objetivo: centralizar `withSuccessHandler` / `withFailureHandler`, timeout, retry e logging.

Conceito (pseudo-código):

```js
function run(functionName, ...args) {
  return new Promise((resolve, reject) => {
    const call = google.script.run
      .withSuccessHandler(result => resolve(result))
      .withFailureHandler(err => reject(normalizeError(err)));

    call[functionName](...args);
  });
}

// Helper que injeta token automaticamente
function runWithToken(functionName, ...args) {
  const token = getToken(); // do módulo
  return run(functionName, token, ...args);
}
```

5. Estratégia para centralizar `sessionToken`
- `apiService` mantém `setToken(token)` / `getToken()` em closure/module.
- Padrão de chamadas: `runWithToken('nomeBackend', ...args)` ou `module.method(...args)` que chama internamente `runWithToken` quando necessário.
- Expiração/Reauth: o `run` deve detectar respostas que indicam sessão inválida (código específico do backend) e expor hook para tratar reautenticação no UI.

6. Estratégia de tratamento de erros
- Normalizar erros no `run`: converter failureHandler do Apps Script em objeto `{ kind, message, statusCode, details }`.
- Políticas:
  - retry automático para erros transitórios (ex.: timeout, 5xx) com backoff exponencial limitado.
  - sem retry para erros de negócio (ex.: credenciais inválidas).
  - logging centralizado (console + possível hook para telemetria externa).
  - mensagens amigáveis retornadas para a camada UI; detalhes mantidos em logs.

7. Ordem segura de migração (incremental)
- Preparação:
  1. Criar `apiService` como módulo novo (sem alterar consumidores) com `run` delegando `google.script.run`.
  2. Incluir `setToken/getToken` e tests unitários que mockem `run`.
- Migração por prioridade (menor → maior impacto):
  - Etapa A (baixo risco): `getDocumentos`, `enviarFeedback`, `listarGatilhosHistoricoCobertura`.
  - Etapa B (médio risco): `getEscolasPainelVacinal`, `getHistoricoCobertura`, `getPainelGestaoVacinal`, `getPainelRankingVacinal`.
  - Etapa C (alto risco): `getPainelVacinalPorEscola`, `getPainelCadastralAlunos`, `getSituacaoCadastral`, `getDashboardData`.
  - Etapa D (crítico): `validarLogin` (migrar por último ou com feature-flag dupla para manter rollback simples).

8. Riscos críticos
- Quebra de contrato nos payloads: UI espera campos e formatos muito específicos.
- Migração de `validarLogin` sem sincronizar token/initialization flow pode impedir login e bloquear acesso.
- Race conditions se `sessionToken` for trocado enquanto requisições paralelas estão ativas.
- Renderização imediata de charts exige que os dados cheguem no tempo certo — mover chamadas sem preservar nextTick/flow pode causar erros de canvas não encontrado.

9. Estratégia de rollback
- Não remover código antigo até que a migração esteja em produção e validada.
- Padrão: implementar adapter que permita alternar entre `gas()` original e `apiService` por feature-flag.
- Testes de smoke em staging: validar login, principais painéis (vacinal, cadastral, ranking) e export/print.
- Em caso de falha após deploy, revert rápido do deploy/branch e desativar feature-flag.

10. O que NÃO deve ser refatorado inicialmente
- `validarLogin` (migrar por último ou com toggle controlado)
- Chamadas que alimentam construção imediata de charts e dependem de DOM timeline (`getPainelVacinalPorEscola`, `getHistoricoCobertura`) sem testes de integração
- Qualquer alteração que mutile `aplicarDadosVacinal`/`aplicarDadosCadastral` ou mudança no shape do payload sem coordenação com backend

---
Arquivo de proposta criado (documentação somente). Posso agora gerar um esqueleto de assinaturas por módulo para revisão no chat (sem criar arquivos). 
