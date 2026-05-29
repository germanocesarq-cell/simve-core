# CHECKLIST DE TESTES - SIMVE

Objetivo: Documentar os testes obrigatórios antes de qualquer refatoração do SIMVE.

Instruções: executar estes testes em ambiente de desenvolvimento ou cópia da planilha de produção; não realizar alterações em produção sem backup completo.

1) Testes de login
- Verificar login com usuário válido (usuário/senha corretos) → sessão criada, UI redireciona para tela inicial.
- Verificar login com usuário inválido → mensagem de erro apropriada, sem criação de sessão.
- Verificar primeiro acesso (senha temporária/redefinição) → fluxo de cadastro/alteração de senha concluído.
- Verificar tempo limite de tentativas (se aplicável) e mensagens de bloqueio.

2) Testes de recuperação de senha
- Solicitar recuperação por e-mail/código → código gerado e retornado/registrado conforme implementação.
- Confirmar redefinição com código correto → senha atualizada e possível login.
- Tentar redefinição com código inválido/expirado → mensagem de erro adequada.

3) Testes de sessão/token
- Confirmar que `sessionToken` é definido após login e enviado em chamadas subsequentes.
- Encerrar sessão (logout) → token inválido e UI volta ao login.
- Reexecução de chamadas com token expirado → comportamento esperado (relogin ou erro claro).
- Testar simultaneidade de sessões (se aplicável).

4) Testes da tela inicial
- Carregamento inicial: dados de resumo (cobertura, pendências) aparecem sem erro.
- Verificar seleção de escolas/perfis e conteúdo condicional por perfil.
- Ações iniciais (ex.: acessar Vacinal/Cadastral/Ranking) mudam a view corretamente.
- Performance: tempo de carregamento aceitável para dados agregados.

5) Testes da Situação Vacinal
- Carregar painel vacinal por escola → dados consistentes com a planilha fonte.
- Validar gráficos (Chart.js): dados renderizados, legendas e eixos corretos.
- Operações de paginação/filtragem por turma/ano → resultados esperados.
- Testar atualizações que apenas leem dados (sem escrita) não alteram planilha.
- Em operações de escrita (se existirem testes controlados), usar planilha de teste e validar alteração desejada.

6) Testes da Situação Cadastral
- Carregar lista cadastral e detalhes do aluno → informação consistente com planilha.
- Salvar CPF cadastral (fluxo `salvarCpfAlunoCadastral`) em ambiente de teste → confirmar escrita apenas na cópia da planilha e que IDs/linhas correspondem.
- Testar importação em lote (`salvarCpfsAlunosCadastral`) com amostras válidas e inválidas → erros tratados e parcial/rollback documentado.
- Validar máscaras e formatação de CPF e tratamento de entradas inválidas.

7) Testes do Ranking
- Gerar painel de ranking e validar agregação por escola/CPF → checar consistência com dados-fonte.
- Casos ambíguos de identificação por nome/CPF → checar heurísticas de unificação (duplicates).
- Performance em conjuntos grandes e estabilidade dos cálculos.

8) Testes de exportação PDF/CSV
- Gerar exportação em PDF e CSV a partir das views suportadas → arquivo criado no Drive (ou baixado) e conteúdo legível.
- Validar metadados (nomes, datas, filtros aplicados) embutidos no arquivo.
- Testar em amostras de dados grandes para avaliar timeouts e tamanho máximo.

9) Testes de gatilhos (ScriptApp)
- Verificar existência e estado do gatilho `rotinaHistoricoCoberturaDiario18h` (listar gatilhos).
- Criar/excluir gatilho via UI (se disponível) em ambiente de teste → gatilho criado/excluído sem erro.
- Executar manualmente a rotina de histórico em ambiente de teste e validar saída esperada.

10) Testes de histórico
- Executar `registrarHistoricoCoberturaTodasAsEscolas_` em cópia de dados → novas linhas no histórico criadas com timestamps corretos.
- Verificar consistência entre histórico e instantâneo (cobertura) no mesmo dia.
- Testar idempotência parcial (se rerodar a rotina, evitar duplicações indesejadas).

11) Testes de permissões por perfil
- Testar acessos com perfis distintos (gestor, admin, operador, leitura) → cada perfil vê apenas o que deve e ações de escrita/administrativas estão restritas.
- Testar tentativas de executar funções administrativas sem permissão → erro/negado apropriado.

12) Testes mobile/responsivo
- Verificar layout e funcionalidades nas resoluções mais comuns (desktop, tablet, mobile).
- Testar ações críticas (login, navegação entre views, geração de relatórios) em mobile.
- Confirmar que gráficos são renderizados ou mensagem alternativa é exibida corretamente.

13) Fluxos críticos que exigem backup antes de alteração
- Escrita de CPF/dados cadastrais (`salvarCpfAlunoCadastral`, `salvarCpfsAlunosCadastral`).
- Rotinas que alteram várias abas/planilhas em lote (importações, sincronizações). 
- Gatilhos que geram histórico ou escrevem em massa (`registrarHistoricoCoberturaTodasAsEscolas_`).
- Operações de exportação que removem/arquivam dados.
- Antes de qualquer alteração nesses fluxos: executar backup completo da planilha (copiar Spreadsheet), exportar CSVs relevantes e registrar ponto-in-time.

14) Estratégia de rollback
- Pré-requisitos: backup completo da planilha de produção (cópia de segurança no Drive) e exportação de CSVs das abas críticas.
- Passos de rollback mínimos:
  - Restaurar a cópia da planilha para o estado anterior ou substituir dados nas abas afetadas pelos CSVs exportados.
  - Reverter alterações de gatilhos (recriar/excluir conforme estado anterior).
  - Verificar logs de uso e confirmar integridade dos dados restaurados.
- Pós-rollback: executar suíte mínima de smoke tests (login, carregamento inicial, leitura de dados críticos) antes de liberar acesso.

---

Observações finais:
- Sempre executar estes testes em uma cópia da planilha de produção quando envolver escrita.
- Documentar resultados (data, executor, ambiente, observações) em um changelog antes de qualquer refatoração.

