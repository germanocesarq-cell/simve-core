# HELPERS_MAPEAMENTO_SIMVE

Objetivo: documentar os helpers/utilitários candidatos à primeira extração segura do SIMVE.

Formato por entrada:
1. Nome da função
2. Arquivo atual
3. Finalidade
4. Pura? (sem DOM/backend)
5. Dependências
6. Risco de extração (baixo/médio/alto)
7. Pode ir para helpers.js? (Sim/Não/Parcial)
8. Prioridade (baixa/média/alta)
9. Ordem recomendada de extração (número)

---

## Normalização

- Nome: `normalizeText`
  - Arquivo atual: AppScript.html (cliente)
  - Finalidade: remover acentos, normalizar caixa, trim e reduzir espaços
  - Pura?: Sim
  - Dependências: nenhuma
  - Risco de extração: baixo
  - Pode ir para helpers.js?: Sim
  - Prioridade: alta
  - Ordem: 1

- Nome: `normalizarTexto_`
  - Arquivo atual: code.js (servidor)
  - Finalidade: mesma finalidade do cliente (normalização de strings)
  - Pura?: Sim
  - Dependências: nenhuma
  - Risco de extração: baixo
  - Pode ir para helpers.js?: Sim (módulo server_utils)
  - Prioridade: alta
  - Ordem: 1

- Nome: `normalizarTokensEscola_`
  - Arquivo atual: code.js
  - Finalidade: tokenizar/normalizar termos de nome de escola (stopwords)
  - Pura?: Sim
  - Dependências: `normalizarTexto_`
  - Risco de extração: baixo-médio
  - Pode ir para helpers.js?: Sim
  - Prioridade: média
  - Ordem: 3

- Nome: `normalizePerfil_`
  - Arquivo atual: code.js
  - Finalidade: normalizar valor do perfil de usuário
  - Pura?: Sim
  - Dependências: `normalizarTexto_`
  - Risco de extração: baixo
  - Pode ir para helpers.js?: Sim
  - Prioridade: média
  - Ordem: 3

---

## Formatação

- Nome: `formatNumero`
  - Arquivo atual: AppScript.html
  - Finalidade: formatar números para `pt-BR`
  - Pura?: Sim
  - Dependências: nenhuma
  - Risco de extração: baixo
  - Pode ir para helpers.js?: Sim
  - Prioridade: alta
  - Ordem: 2

- Nome: `sanitizeFileName_`
  - Arquivo atual: code.js
  - Finalidade: remover caracteres inválidos de nomes de arquivo
  - Pura?: Sim
  - Dependências: nenhuma
  - Risco de extração: baixo
  - Pode ir para helpers.js?: Sim (server_utils)
  - Prioridade: alta
  - Ordem: 1

- Nome: `maskCpfCadastral` / `mascararCpfCadastral_`
  - Arquivo atual: AppScript.html / code.js
  - Finalidade: formatar/mascarar CPF para exibição
  - Pura?: Sim
  - Dependências: `onlyNumbers` / helper de remoção de não-dígitos
  - Risco de extração: baixo
  - Pode ir para helpers.js?: Sim
  - Prioridade: alta
  - Ordem: 1

---

## Paginação

- Nome: `getPageItems`
  - Arquivo atual: AppScript.html
  - Finalidade: retornar itens de uma página (slice)
  - Pura?: Sim
  - Dependências: nenhuma
  - Risco de extração: baixo
  - Pode ir para helpers.js?: Sim
  - Prioridade: média
  - Ordem: 4

- Nome: `getVisiblePages`
  - Arquivo atual: AppScript.html
  - Finalidade: calcular páginas visíveis (navegação)
  - Pura?: Sim
  - Dependências: nenhuma
  - Risco de extração: baixo
  - Pode ir para helpers.js?: Sim
  - Prioridade: média
  - Ordem: 4

---

## Filtros

- Nome: `getSortedFilteredList`
  - Arquivo atual: AppScript.html
  - Finalidade: aplicar filtro de texto e ordenação em arrays de objetos
  - Pura?: Sim (opera em dados passados)
  - Dependências: `normalizeText`, `normalizeForSort`
  - Risco de extração: médio (vários call-sites e chaves esperadas)
  - Pode ir para helpers.js?: Sim (parcial — testar contratos)
  - Prioridade: alta
  - Ordem: 5

- Nome: `montarFiltros_`
  - Arquivo atual: code.js
  - Finalidade: montar listas de `escolas` e `turmas` a partir de dados padronizados
  - Pura?: Sim
  - Dependências: nenhuma (opera em array de objetos)
  - Risco de extração: baixo-médio
  - Pode ir para helpers.js?: Sim (server_utils)
  - Prioridade: média
  - Ordem: 6

---

## Ordenação

- Nome: `normalizeForSort` / `valorOrdenacaoCadastral` / `aplicarOrdenacaoCadastral`
  - Arquivo atual: AppScript.html
  - Finalidade: normalizar valores para ordenação e aplicar ordenação por chave
  - Pura?: Sim
  - Dependências: `normalizeText`
  - Risco de extração: médio (contratos de sortKey)
  - Pode ir para helpers.js?: Sim
  - Prioridade: média
  - Ordem: 4

- Nome: `agruparContagem_`
  - Arquivo atual: code.js
  - Finalidade: agrupar lista por chave e contar ocorrências (labels/values)
  - Pura?: Sim
  - Dependências: nenhuma
  - Risco de extração: baixo
  - Pode ir para helpers.js?: Sim
  - Prioridade: média
  - Ordem: 5

---

## Datas

- Nome: `formatarData_` (inner em `listarTransferenciasPendentes`)
  - Arquivo atual: code.js
  - Finalidade: formatar objetos Date para `dd/MM/yyyy HH:mm:ss` usando timezone da script
  - Pura?: Parcial (depende de `Session.getScriptTimeZone()` — externa)
  - Dependências: `Session.getScriptTimeZone()`, `Utilities.formatDate`
  - Risco de extração: médio (timezone e Utilities dependentes de GAS)
  - Pode ir para helpers.js?: Parcial (extrair lógica de formatação, manter wrapper de timezone no servidor)
  - Prioridade: baixa
  - Ordem: 10

- Nome: `numeroIdadeVacinal_`
  - Arquivo atual: code.js
  - Finalidade: extrair número de idade a partir de string (parse decimal)
  - Pura?: Sim
  - Dependências: nenhuma
  - Risco de extração: baixo
  - Pode ir para helpers.js?: Sim
  - Prioridade: alta
  - Ordem: 2

---

## CPF / Documentos

- Nome: `cpfValidoCadastral_` / `cpfInvalidoCadastral_`
  - Arquivo atual: code.js
  - Finalidade: validar CPF (algoritmo de dígitos verificadores)
  - Pura?: Sim
  - Dependências: nenhuma
  - Risco de extração: baixo
  - Pode ir para helpers.js?: Sim (server_utils)
  - Prioridade: alta
  - Ordem: 1

- Nome: `isCpfInconsistente_`
  - Arquivo atual: code.js
  - Finalidade: heurística rápida para identificar CPF vazio/curto/zeros
  - Pura?: Sim
  - Dependências: nenhuma
  - Risco de extração: baixo
  - Pode ir para helpers.js?: Sim
  - Prioridade: alta
  - Ordem: 1

---

## Strings

- Nome: `onlyNumbers`
  - Arquivo atual: AppScript.html
  - Finalidade: remover tudo que não seja dígito
  - Pura?: Sim
  - Dependências: nenhuma
  - Risco de extração: baixo
  - Pode ir para helpers.js?: Sim
  - Prioridade: alta
  - Ordem: 1

- Nome: `normalizarAtraso_`
  - Arquivo atual: code.js
  - Finalidade: interpretar coluna/flag de atraso (mapear SIM/NÃO/OK/valor)
  - Pura?: Sim
  - Dependências: nenhuma
  - Risco de extração: baixo
  - Pode ir para helpers.js?: Sim
  - Prioridade: média
  - Ordem: 3

- Nome: `obterNomeLinha_`
  - Arquivo atual: code.js
  - Finalidade: heurística para obter campo de nome a partir de múltiplas chaves possíveis
  - Pura?: Sim
  - Dependências: nenhuma
  - Risco de extração: baixo
  - Pode ir para helpers.js?: Sim
  - Prioridade: média
  - Ordem: 4

---

## Arrays / Listas

- Nome: `montarIndicadoresVacinais_`
  - Arquivo atual: code.js
  - Finalidade: agregações para indicadores de cobertura vacinal (percentuais, totais)
  - Pura?: Sim
  - Dependências: formato dos itens padronizados (e.g., `coberturaFlags`), `calcularAlertasEscolas_`
  - Risco de extração: médio (negócio importante; requer fixtures)
  - Pode ir para helpers.js?: Sim (server_utils) — extração com testes
  - Prioridade: média
  - Ordem: 6

- Nome: `montarGraficosVacinais_`
  - Arquivo atual: code.js
  - Finalidade: construir labels/values para gráficos (agregação por escola/turma/vacina)
  - Pura?: Sim
  - Dependências: `coberturaFlags` e `config.vacinas`
  - Risco de extração: médio
  - Pode ir para helpers.js?: Sim
  - Prioridade: média
  - Ordem: 6

- Nome: `padronizarLinhaVacinal_`
  - Arquivo atual: code.js
  - Finalidade: transformar `row` bruto em objeto padronizado com flags de cobertura
  - Pura?: Sim (recebe `row` e `config`, não faz I/O)
  - Dependências: `obterValorColunaFlex_`, `interpretarStatusVacinaComElegibilidade_`, `numeroIdadeVacinal_`
  - Risco de extração: alto (muito usado e sensível ao contrato de dados)
  - Pode ir para helpers.js?: Sim (mas extrair tardiamente e com testes de fixtures)
  - Prioridade: alta
  - Ordem: 7

- Nome: `interpretarStatusVacinaComElegibilidade_` / `interpretarStatusVacina_`
  - Arquivo atual: code.js
  - Finalidade: mapear valor textual para flags (`tomou`, `elegivel`, `emAtraso`, `semInfo`)
  - Pura?: Sim
  - Dependências: `normalizarTexto_`, constantes `STATUS_SIM`, `STATUS_NAO`, `STATUS_NAO_TEM_IDADE`
  - Risco de extração: médio
  - Pode ir para helpers.js?: Sim
  - Prioridade: alta
  - Ordem: 5

---

## Observações gerais e recomendações

- Priorizar extração de utilitários idempotentes e sem I/O: normalização, parsing, formatação e validação (CPF, números, strings). Esses têm risco baixo e alto valor de reutilização.
- Arquivos sugeridos para criação futura (após validação): `client_utils.js` (funções do `AppScript.html`) e `server_utils.js` (funções de `code.js`).
- Não extrair funções que façam I/O com GAS (SpreadsheetApp, DriveApp, MailApp, CacheService, ScriptApp, Utilities com crypto) sem primeiro criar wrappers e testes end-to-end.
- Para funções de risco médio/alto (ex.: `padronizarLinhaVacinal_`, rankings), criar fixtures reais extraídas das planilhas e comparações antes/depois para garantir idempotência.

---

Arquivo gerado automaticamente pelo mapeamento solicitado em conversa com o time de refatoração.
