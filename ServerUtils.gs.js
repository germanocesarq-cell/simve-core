/**
 * ServerUtils.gs.js
 * 
 * Camada de helpers server-side puros (sem I/O com GAS).
 * Objetivo: iniciar isolamento de utilitários reutilizáveis do SIMVE.
 * 
 * Status: Em transição.
 * - Funções aqui espelhadas em code.js
 * - Gradualmente refatorar chamadas para usar ServerUtils
 * - Remover duplicatas após validação em produção
 * 
 * Referência: HELPERS_MAPEAMENTO_SIMVE.md
 * Roadmap: ROADMAP_REFATORACAO_SIMVE.md
 */

/**
 * sanitizeFileName_
 * 
 * Remove caracteres inválidos para nomes de arquivo.
 * Pura: Sim
 * Dependências: nenhuma
 * Risco: Baixo
 * 
 * Helper espelhado para futura migração segura.
 * Versão original: code.js (mantida para compatibilidade)
 * 
 * @param {string} name - Nome do arquivo (pode conter caracteres especiais)
 * @returns {string} Nome sanitizado
 */
function sanitizeFileName_(name) {
  return String(name || "").replace(/[\\/:*?"<>|#%&{}]/g, "").trim();
}
