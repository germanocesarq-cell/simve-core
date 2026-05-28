# Arquitetura Vue / AppScript — SIMVE

Este documento descreve a arquitetura atual da aplicação front-end baseada em Vue + integração com Google Apps Script (backend). Objetivo: mapear responsabilidades, pontos de acoplamento e riscos, sem alterar código.

1. Visão geral da arquitetura atual
- Aplicação monolítica em single-page: marcação e templates em `App.html`, lógica do app (Vue createApp) em `AppScript.html`, shell/global em `Index.html`.
- Comunicação com backend via `google.script.run` (Apps Script). Charts via Chart.js embutido no front.

2. Arquivos centrais
- `Index.html`: shell da aplicação, inclui recursos globais (fonts, resets, estilos).
- `App.html`: template/markup do SPA — contêiner `#app`, marcação de todas as views (login, vacinal, cadastral, ranking, admin, etc.) e referências a IDs de canvas/elementos usados por charts e modais.
- `AppScript.html`: contém `createApp(...).mount('#app')` com `data()`, `computed`, `methods`, `mounted`, `watch` — toda a lógica Vue/UX e integrações com Charts e google.script.run.
- `code.js`: utilitários auxiliares (preservar; não modificar sem análise). Pode conter helpers globais e eventuais funções auxiliares.

3. Onde fica o `createApp` principal
- O `createApp(...).mount('#app')` está no início/fim de `AppScript.html` (arquivo que inicia e configura o app Vue). Esse é o ponto de montagem único da aplicação.

4. Principais grupos de estado / `data()`
- Autenticação/sessão: `sessionToken`, `sessionInfo`, `authView`, `loginForm` e formulários de recuperação.
- Navegação/visão: `currentView`, `profileMenuOpen`, `assets`.
- Vacinal: objeto `vacinal` (form, filtros, indicadores, graficos, tabela, paginação, sort, modal, etc.).
- Cadastral: `cadastral` / `cadastralNovo` (filtros, indicadores, tabela, paginação, ordenação).
- Ranking / Gestão / Admin / Monitoramento: objetos `ranking`, `gestao`, `admin`, `monitoramentoAcessos`.
- UI / feedback: `loading`, `topError`, `topSuccess`, `feedback`.
- Charts: `charts` (referências Chart.js para destruição/atualização).

5. Principais `methods`
- Autenticação: `fazerLogin`, `salvarPrimeiroAcesso`, `solicitarRecuperacao`, `confirmarRecuperacao`, `sair`.
- Carregamento de dados: `carregarVacinal`, `carregarCadastral`, `carregarRanking`, `carregarGestao`, `carregarDocumentos`, `carregarEscolasVacinal`, `carregarHistoricoEvolucao`, `carregarInicioPerfil`, `carregarResumoInicial`.
- Aplicação de payloads: `aplicarDadosVacinal`, `aplicarDadosCadastral`, `aplicarInicioEscolaDoLogin`, `inicializarInicioEscolaAposLogin`.
- Charts / renderização: `renderVacCharts`, `renderCadCharts`, `renderRankingEvolucaoChart`, `tentarRenderGraficoTurmaComRetry`, `destroyChart`.
- Utilitários: `gas` (wrapper de `google.script.run`), `normalizeText`, `normalizeForSort`, `onlyNumbers`, `getSortedFilteredList`, `getPageItems`, `exportCsv*`, export/print helpers.

6. Fluxo de login
- Usuário submete `loginForm` → `fazerLogin()` chama `gas('validarLogin', perfil, usuario, senha)`.
- Se ok: `sessionToken` e `sessionInfo` são populados; salva `simve_usuario`/`simve_perfil` em `localStorage` (se `lembrarUsuario`).
- Se `primeiroAcesso`, direciona para fluxo de redefinição de senha; caso contrário, configura filtros por perfil e chama inicializadores (`aplicarInicioEscolaDoLogin` ou `carregarInicioPerfil` / `inicializarInicioEscolaAposLogin`).

7. Fluxo de carregamento inicial
- `mounted()` apenas recupera usuário/perfil do `localStorage`.
- Após login: `fazerLogin()` → configurar filtros por perfil → dependendo do perfil, chama `carregarInicioPerfil()` (para gestores) ou `aplicarInicioEscolaDoLogin()` / `inicializarInicioEscolaAposLogin()` para escolas. Esses métodos fazem várias chamadas `gas(...)` em paralelo (ex.: `getDashboardData`, `getSituacaoCadastral`, `getPainelRankingVacinal`) e populam objetos `vacinal`, `cadastral`, `ranking`.
- `setView(view)` controla carregamentos por aba (vacinal, cadastral, ranking, acessos, admin).

8. Onde entram chamadas `google.script.run`
- Todas as chamadas a Apps Script são feitas via o método `gas(method, ...args)` (wrapper que retorna Promise usando `google.script.run.withSuccessHandler/withFailureHandler`).
- Exemplos de métodos remotos usados: `validarLogin`, `getPainelVacinalPorEscola`, `getHistoricoCobertura`, `getPainelRankingVacinal`, `getPainelGestaoVacinal`, `getSituacaoCadastral`, `getEscolasPainelVacinal`, `salvarCpfAlunoCadastral`, `listarGatilhosHistoricoCobertura`, `criarGatilhoHistoricoCobertura18h`, `enviarFeedback`, `encerrarSessao`, entre outros.

9. Pontos de acoplamento crítico
- `gas()` centraliza toda a integração backend — mudanças no backend (nomenclatura/assinatura) impactam diretamente os `methods` que consomem payloads.
- `aplicarDadosVacinal` / `aplicarDadosCadastral`: assumem estrutura específica dos payloads vindos do servidor (campos, formatos, arrays) e atualizam grande parte do estado; alto risco de regressão se a forma do payload mudar.
- Renderização de Charts: dependência forte de IDs de canvas/DOM e Chart.js; código mistura lógica de dados e manipulação direta do DOM — frágil para reuso/testes.
- Fluxos pós-login (`aplicarInicioEscolaDoLogin`, `inicializarInicioEscolaAposLogin`) embutem retries e timeouts, misturando sincronização UI e chamadas remotas.

10. Riscos de refatoração
- Alterar `AppScript.html` sem testes e backups pode quebrar o fluxo de login e carregamento de dados.
- Mudar contratos de `google.script.run` (nomes/args/retornos) sem atualizar os consumidores causará erros silenciosos ou exceções.
- Separar charts ou estado sem isolar dependências DOM pode introduzir condições de corrida (ex.: canvas ainda não criado ao renderizar charts).

11. Possíveis módulos futuros (prioridade sugerida)
- `apiService` (alto): encapsular `gas()` e criar wrappers por recurso (`auth`, `vacinal`, `cadastral`, `ranking`) para centralizar contratos, timeouts e tratamento de erros.
- `chartService` (médio): ter funções puras que retornam configurações Chart.js e helpers para criação/destrocação de gráficos; separar responsabilidades DOM vs. configuração.
- `stores` (médio/alto): extrair slices de estado (`vacinal`, `cadastral`, `ranking`) para stores (pinia/Vuex-like ou simples módulos JS) para facilitar testes e componentização.
- `helpers` (baixo): mover utilitários (`normalizeText`, `onlyNumbers`, `formatNumero`) para módulos reutilizáveis.
- `componentes Vue` (alto): dividir `App.html` em componentes (`LoginForm`, `Topbar`, `Sidebar`, `VacinalPanel`, `CadastralTable`, `RankingPanel`, `Modal`) para reduzir o tamanho do arquivo e facilitar manutenção.

12. Regras de segurança / operação
- Não alterar `App.html` nem `AppScript.html` sem plano de rollback e testes automatizados/backup.
- Não alterar chamadas `google.script.run` sem mapear a função correspondente no backend Apps Script e validar contrato (nome, parâmetros e formato de retorno).

---
Arquivo criado automaticamente para documentar a arquitetura vigente (leitura somente). Para próximos passos eu posso gerar um plano de refatoração com PRs incrementais e testes sugeridos.
