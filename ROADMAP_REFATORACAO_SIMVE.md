# ROADMAP DE REFACTORAÇÃO - SIMVE

Objetivo: Documentar um plano em fases seguras para refatoração do SIMVE.

1. Estado atual da arquitetura
- SPA em `App.html` + `AppScript.html` (Vue createApp) comunicando via `google.script.run`.
- Backend em Google Apps Script (`code.js`) lendo/grava em Google Sheets.
- Chart.js para gráficos; lógica de UI e chamadas embarcadas no mesmo arquivo cliente.

2. O que já foi modularizado
- Separação visual (CSS em arquivos distintos listados no projeto).
- Algumas funções utilitárias no servidor mais ou menos isoladas (validação CPF, leitura de abas).
- Ainda há muita lógica acoplada ao DOM/estado no `AppScript.html`.

3. Camada CSS segura
- Identificar e consolidar variáveis/temas.
- Mover regras compartilhadas para arquivos reutilizáveis (já isolados em `*Styles.html`).
- Garantir que mudanças no CSS sejam compatíveis com as classes usadas no template.

4. Camada Vue/AppScript atual
- Monolítica: estado, chamadas `gas(...)`, render e helpers misturados.
- Objetivo: minimizar mudanças diretas; extrair helpers puros primeiro.

5. Principais riscos
- Escritas em planilha (CPF, importações, históricos) podem corromper dados.
- Gatilhos (ScriptApp) e rotinas agendadas que escrevem em massa.
- Heurísticas de agregação (ranking) que podem produzir duplicatas ou perder registros.
- Dependência direta de IDs/abas da planilha (`ID_PLANILHA`, nomes de abas).

6. Fase 0 — documentação e testes
- Criar `CHECKLIST_TESTES_SIMVE.md` (feito).
- Documentar endpoints/nomes de função do servidor usados pelo cliente.
- Criar ambiente de teste: cópia da planilha de produção e credenciais de teste.
- Executar bateria de testes manuais e automatizáveis (smoke + integração básica).

7. Fase 1 — helpers/utilitários puros
- Extrair funções puras do cliente que não dependem de DOM (formatadores, validações, máscaras).
- Colocar em arquivos `utils/*.js` ou módulos importáveis.
- Cobertura de testes unitários para cada helper.

8. Fase 2 — wrapper gas/apiService
- Implementar um wrapper `apiService` (pure JS) que encapsula `google.script.run`.
- Objetivo: padronizar chamadas, tratamento de erros e retries.
- Atualizar o cliente para usar `apiService.call('nomeFuncao', payload)` sem mudar lógica.

9. Fase 3 — chamadas read-only
- Identificar e isolar chamadas que apenas leem dados (painéis, dashboards).
- Refatorar estas chamadas para usar `apiService` e garantir que são read-only.
- Validar em ambiente de teste que comportamento/latência são equivalentes.

10. Fase 4 — charts/renderizadores
- Extrair renderizadores de gráficos (Chart.js) em componentes/ funções isoladas.
- Garantir testes visuais/ de snapshot para detectar regressões.
- Substituir chamadas diretas por componentes reutilizáveis.

11. Fase 5 — stores/estado
- Introduzir um store simples (pinia/vuex-like leve) ou módulo de estado centralizado.
- Migrar gradualmente partes do estado (filtros, página atual, seleção de escola).
- Manter compatibilidade de API local para minimizar mudanças nos handlers.

12. Fase 6 — backend crítico somente com backup
- Refatoração de funções de escrita e gatilhos somente após backups e testes robustos.
- Mover validações e sanitizações para utilitários compartilhados do lado servidor.
- Implementar feature-flags para ativar/ desativar rotinas de escrita em produção.

13. Fase 7 — preparação Supabase/PostgreSQL
- Mapear modelo de dados atual (abas → tabelas) e normalizar esquema.
- Implementar camadas de sincronização (cron/rotinas) para migrar dados históricos.
- Testar leitura/compare entre Sheets e DB em paralelo antes de cutover.

14. O que NÃO deve ser feito agora
- Refatorar ou remover gatilhos de gravação sem backup e testes completos.
- Alterar names/IDs de abas na planilha sem coordenar migração de dados.
- Mudar estrutura de sessão/auth sem estratégia de rollback e testes de compatibilidade.
- Refatorar múltiplas camadas ao mesmo tempo (ex.: migrar backend e estado cliente em um único passo).

---

Recomendações finais:
- Trabalhar em pequenas PRs por fase com revisão e testes manuais automatizados.
- Ter sempre uma cópia da planilha de produção como ponto de restauração.
- Priorizar extração de código puramente determinístico (helpers, api wrapper) antes de tocar estado ou escrita.

