# Arquitetura Atual do SIMVE

## Branch de trabalho
arquitetura-clean

## Estado atual
Sistema funcionando normalmente após modularização inicial.

## Núcleo visual
CoreStyles.html

Responsável por:
- layout principal
- sidebar
- topbar
- menu
- responsividade base

## Login
LoginStyles.html

Responsável por:
- tela de login
- fundo institucional
- card de acesso
- responsividade do login

## Situação Vacinal
VacinalStyles.html

Blocos ativos:
- Bloco operacional Vacinal — versão final e overrides
- SIMVE V6C — detalhe inline na tabela vacinal

Legados removidos:
- V4
- duplicidades V3
- bloco operacional inicial

## Regras de segurança
- Trabalhar na branch arquitetura-clean
- Antes de alterar: git pull
- Depois de testar: git add, commit e push
- Não editar Index.html sem backup e teste
- Após npx clasp push, testar login, situação vacinal e console

## Próxima prioridade
Modularização JS e preparação futura para Supabase/PostgreSQL.