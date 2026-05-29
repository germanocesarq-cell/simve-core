# Arquitetura de Execução do ApiService

## 1. Estrutura atual do wrapper `gas()`
- O wrapper `gas()` está definido em `App.html` dentro dos métodos Vue.
- Ele recebe um `method` e `...args` e cria uma `Promise` que:
  - chama `google.script.run`,
  - usa `withSuccessHandler(resolve)`,
  - usa `withFailureHandler(reject)`,
  - invoca dinamicamente `[method](...args)`.
- Este wrapper é o ponto único usado atualmente para todas as chamadas client-side ao backend Apps Script.

## 2. Como `ApiService.html` funciona
- `ApiService.html` define um objeto global seguro em `window.apiService`.
- Ele expõe:
  - `run(method, ...args)` que encapsula `google.script.run` em uma `Promise` com os mesmos handlers de sucesso e falha do wrapper atual.
  - um namespace `documentos` com a função `getDocumentos(...args)`, que delega para `window.apiService.run('getDocumentos', ...args)`.
- O arquivo foi criado como uma camada conceitual futura, sem alterar o comportamento ou as chamadas existentes.

## 3. Relação entre Vue -> apiService -> google.script.run
- No modelo atual:
  - o código Vue chama `this.gas(method, ...args)`.
  - `this.gas()` chama `google.script.run` diretamente.
- Com `ApiService.html` presente:
  - `window.apiService` já está disponível no runtime,
  - mas o código Vue permanece inalterado para todas as chamadas não migradas.
- A transição segura é:
  - manter `this.gas()` enquanto o novo `apiService` cresce,
  - migrar um call-site de cada vez para `window.apiService.*`.

## 4. Primeira migração concluída: `getDocumentos`
- A primeira migração controlada foi feita apenas no ponto de chamada de `getDocumentos` em `App.html`.
- A linha agora usa:
  - `window.apiService.documentos.getDocumentos(this.sessionToken)`
- Isso significa:
  - o runtime já inclui `ApiService.html`,
  - a primeira chamada foi movida sem alterar outros `gas()`.

## 5. Estratégia de migração incremental
- Migrar apenas um call-site por vez.
- Preferir chamadas de leitura simples antes de chamadas com efeitos ou múltiplos consumers.
- Manter ambos os caminhos coexistindo enquanto valida cada migração.
- Não substituir o wrapper `gas()` global até que a migração seja estável.
- Evitar mudanças em lógica Vue, fluxos de loading ou backend durante cada passo.

## 6. Ordem recomendada de migração
1. `getDocumentos` (já migrado) – leitura simples e de baixo impacto.
2. leituras isoladas de painel que não desencadeiam muitos efeitos colaterais.
3. chamadas de dashboard e resumo inicial.
4. chamadas de escrita/atualização e ações de gatilho.

## 7. Chamadas de baixo risco
- `getDocumentos` – leitura limitada, sem efeito colateral.
- `getEscolasPainelVacinal` – leitura de lista de filtros.
- `listarEscolasTransferencia`/`listarTurmasEscolaTransferencia` – consultas de seleção.
- `getPainelRankingVacinal` desde que não altere estado crítico fora da própria view.

## 8. Chamadas de médio risco
- `getPainelInicioPorPerfil` – leitura de dashboard inicial do gestor, com várias dependências UI.
- `getDashboardData` – leitura de dados vacinais que alimenta resumos e gráficos.
- `getSituacaoCadastral` – leitura que impacta os dados de inconsistência cadastral.
- `getPainelGestaoVacinal` – painel de gestão com indicadores e filtros.

## 9. Chamadas críticas
- `validarLogin` e `encerrarSessao` – autenticação/session control.
- `solicitarRecuperacaoSenha` – fluxo de segurança de usuário.
- `salvarCpfAlunoCadastral` / `salvarCpfsAlunosCadastral` – escrita de dados sensíveis.
- `solicitarTransferenciaAluno` / `confirmarTransferenciaAluno` – ações de alteração de matrícula.
- `criarGatilhoHistoricoCobertura18h` / `excluirGatilhoHistoricoCobertura18h` / `salvarHistoricoCoberturaAgora` – operações de agendamento/efetuadas no backend.

## 10. Estratégia de rollback
- Cada migração deve ser reversível revertendo apenas a linha de call-site.
- Manter `ApiService.html` e `window.apiService` carregados sem usar caso uma migração seja reversa.
- Evitar alterações simultâneas em múltiplos call-sites para facilitar rollback.

## 11. Estratégia de validação
- Validar cada chamada migrada em ambiente de teste antes de avançar.
- Conferir:
  - o carregamento correto dos dados,
  - ausência de erros no console,
  - o comportamento da view específica afetada.
- Preferir testes manuais rápidos em UI e observação de mensagens de erro.

## 12. Riscos de loops reativos
- O Vue no SIMVE usa watchers em filtros `vacinal.*` e `cadastral.*`, mas não há watcher direto sobre `getDocumentos`.
- Migrações que impactem views iniciais ou resumos podem acionar rerenders ou recarregamentos indiretos.
- Assegurar que a migração não altere variáveis reativas usadas em watchers antes de validar.

## 13. Riscos de loading silencioso
- Alguns métodos, como `carregarResumoInicial()`, não definem `this.loading = true` diretamente.
- Chamadas migradas para essas rotas podem falhar silenciosamente se o novo path não estiver correto.
- Validar especialmente fluxos que não expõem spinner/overlay visível.

## 14. Riscos de estado Vue
- A migração de chamadas deve preservar a mesma forma de dados retornada.
- Alterações na assinatura ou nos valores retornados podem quebrar:
  - `aplicarDadosVacinal(...)`,
  - `completarHomeSaudeComRanking()`,
  - cálculo de `homeResumo` e `currentBaseLabel`.
- A camada `apiService` deve ser um wrapper transparente, sem alterar a estrutura do payload.

## 15. O que NÃO migrar agora
- `validarLogin`, `solicitarRecuperacaoSenha`, `encerrarSessao`
- chamadas de escrita e atualização de dados sensíveis
- `getDashboardData` e `getPainelInicioPorPerfil` até que as leituras simples estejam estáveis
- qualquer chamada que envolva lógica de retry/monitoramento sem validação prévia
- não remover ou substituir `this.gas()` enquanto o processo não estiver estabilizado

---

Esta estratégia mantém a arquitetura atual intacta, preserva `App.html` e `ApiService.html` como camadas separadas, e garante que a migração ocorra de forma controlada e reversível.