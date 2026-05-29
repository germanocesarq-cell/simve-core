# ANÁLISE APP vs APPSCRIPT

## 1. Runtime principal
No runtime principal do SIMVE, o arquivo que é efetivamente incluído em tempo de execução é `Index.html`.

## 2. Como `Index.html` inclui `App.html`
No final do corpo de `Index.html` existe a instrução:

```html
  <?!= include('App'); ?>
```

Isto demonstra que o aplicativo é carregado por meio da inclusão do componente `App.html` dentro de `Index.html`.

## 3. Evidências de que `AppScript.html` não está incluído
- `Index.html` inclui diretamente `App.html`.
- Não há nenhuma referência a `AppScript.html` em `Index.html` como `script src`, `include('AppScript')` ou similar.
- A busca por `AppScript.html` no workspace não retorna nenhum include ativo em arquivos HTML/JS/GS que façam o browser carregar esse arquivo.

Portanto, `AppScript.html` não está presente no runtime principal como dependência carregada por `Index.html`.

## 4. Riscos de divergência
- `App.html` e `AppScript.html` podem evoluir separadamente.
- Se as duas versões ficarem desalinhadas, o DOM/IDs e a lógica Vue podem não corresponder.
- Isso pode gerar bugs silenciosos, especialmente em elementos que existem em `App.html` mas não são tratados na lógica de `AppScript.html` ou vice-versa.

## 5. Problemas de manutenção duplicada
- Manter dois arquivos semelhantes cria duplicação de conhecimento e aumenta o custo de alterações.
- Correções de UI em `App.html` podem precisar de ajustes paralelos em `AppScript.html` sem que isso seja imediatamente óbvio.
- A presença de `AppScript.html` como artefato separado torna mais difícil entender qual arquivo é a fonte de verdade.

## 6. Estratégia segura futura
- Tratar `App.html` como a fonte principal da aplicação e ponto único de inclusão no runtime.
- Identificar o uso real de `AppScript.html` apenas como documento legado ou referência histórica.
- Evitar alterações em `Index.html` e no mecanismo de inclusão atual enquanto não houver um plano de migração gradual bem definido.

## 7. Recomendação
- `App.html` deve ser reconhecido como fonte principal de marcação/tela do SIMVE.
- `AppScript.html` deve ser mantido apenas como legado temporário, sem alterar o runtime ou as inclusões atuais.

## 8. O que NÃO fazer ainda
- Não remover `AppScript.html`.
- Não alterar nenhum include em `Index.html`.
- Não alterar o runtime ou a forma como `App.html` é incluído.
- Não migrar ou mesclar código sem antes validar o fluxo atual em um ambiente de teste.

## 9. Estratégia futura de convergência
- Mapear claramente o que está em `App.html` (estrutura e template) e o que está em `AppScript.html` (lógica Vue/estado/handlers).
- Criar uma fase de convergência onde `AppScript.html` seja refatorado para arquivos modulares menores (`client_utils`, componentes Vue, etc.)
- Depois de validar a separação de responsabilidades, escolher um único ponto de inclusão e reduzir a dependência de arquivos duplicados.
- A longo prazo, unificar a aplicação em um único fluxo de arquivo ou componente que contenha:
  - marcação em `App.html`
  - lógica em módulos reutilizáveis
  - um único ponto de montagem Vue controlado a partir de `Index.html`.
