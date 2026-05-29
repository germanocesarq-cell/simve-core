# Estratégia de Observabilidade do SIMVE

## 1. Problemas atuais de rastreamento
- O SIMVE não possui uma camada de observabilidade dedicada.
- O diagnóstico depende principalmente de inspeção manual do console e leitura de código.
- Erros e tempos de resposta do backend não são centralizados ou correlacionados.
- Falhas em caminhos específicos do `apiService` ficam difíceis de isolar.

## 2. Limitações do console atual
- O console é usado apenas de forma ad hoc e sem padrão.
- Mensagens não têm prefixos ou contexto consistente.
- Não há separação clara entre logs de aplicação, warnings e erros do `apiService`.
- Sem uma camada de timing, fica difícil medir latência de chamadas específicas.

## 3. Objetivo do `ApiDebug.html`
- Criar uma camada leve preparatória de observabilidade.
- Fornecer um objeto global `window.apiDebug` para logs controlados.
- Não alterar o comportamento da aplicação atual.
- Não interceptar chamadas nem integrar logs ainda.
- Permitir futura instrumentação gradual do `apiService`.

## 4. Estratégia de logs leves
- Usar `apiDebug.log()`, `apiDebug.warn()` e `apiDebug.error()` como wrappers mínimos.
- Padronizar prefixos de mensagem, por exemplo `[apiDebug]`.
- Evitar logs excessivos: registrar apenas eventos relevantes.
- Manter a camada de logs quando o `apiService` começar a crescer.

## 5. Estratégia de timing
- Usar `apiDebug.timingStart(label)` e `apiDebug.timingEnd(label)` para medir segmentos.
- Começar com timings de chamadas críticas e fluxos de leitura importantes.
- Garantir que os rótulos sejam claros e únicos por chamada.
- Evitar mensuração em loops de alta frequência para não poluir o console.

## 6. Estratégia futura de monitoramento de falhas
- Evoluir de logs locais para captura estruturada de erros.
- Associar falhas a contexto de chamada, usuário e tela.
- Considerar envio para backend de observabilidade apenas em modo de diagnóstico controlado.
- Priorizar identificação de falhas em `apiService` e `google.script.run`.

## 7. Estratégia futura de retries
- Definir políticas de retry para falhas transitórias de rede ou Apps Script.
- Logar tentativas e resultados para permitir análise do comportamento.
- Evitar retries automáticos em operações idempotentes somente sem confirmação.
- Usar `ApiDebug` para marcar início/fim de retrys em futuros wrappers.

## 8. Estratégia futura de timeout
- Implementar timeouts ao redor de `apiService.run()` para evitar waits indefinidos.
- Logar o evento de timeout com contexto da chamada.
- Garantir fallback visível na UI quando uma chamada demora demais.
- Manter o timeout configurável e desabilitável para troubleshooting.

## 9. Estratégia futura para Supabase
- Estruturar logs e métricas de modo a permitir integração futura com Supabase ou outro destino.
- Evitar design acoplado a um backend de logs específico nesta fase.
- Utilizar `ApiDebug` como porta de entrada para exportação futura de eventos.
- Priorizar formato leve e extensível, não integração imediata.

## 10. O que NÃO fazer agora
- Não integrar logs a nenhum serviço externo.
- Não interceptar as chamadas do `apiService`.
- Não alterar `App.html`, `ApiService.html` ou a lógica atual.
- Não aumentar o volume de console além do necessário.
- Não usar `ApiDebug` como mecanismo de produção antes de validar a abordagem.

## 11. Como evitar poluição de console
- Registrar apenas eventos de alto valor ou erros inesperados.
- Evitar `console.log` em loops ou chamadas recorrentes.
- Usar prefixos claros para encontrar rapidamente logs relevantes.
- Remover ou silenciar logs de debug em ambientes de produção quando apropriado.

## 12. Estratégia segura de ativação gradual
- Iniciar com `ApiDebug` disponível no runtime, mas sem uso ativo.
- Gradualmente adicionar logs em caminhos específicos do `apiService` quando necessário.
- Validar cada adição em ambiente de teste.
- Manter reversão simples: remover o call-site se o log gerar ruído ou problemas.

---

Esta estratégia mantém o foco em observabilidade leve e futura, sem alterar o comportamento atual do SIMVE ou o runtime existente.