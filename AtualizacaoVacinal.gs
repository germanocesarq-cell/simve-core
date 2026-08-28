/**
 * ============================================================
 * SIMVE v69 - ATUALIZAÇÃO DA SITUAÇÃO VACINAL | PERFIL SAÚDE
 * ============================================================
 *
 * Arquivo adicional do projeto Apps Script.
 * Não substitui o Code.gs atual.
 *
 * Funções públicas usadas pelo App.html:
 *   - getAlunosAtualizacaoVacinal(token, escola)
 *   - getAlunoAtualizacaoVacinal(token, escola, base, matricula)
 *   - salvarAtualizacaoVacinal(token, payload)
 *
 * Segurança:
 *   1) Reaproveita a sessão atual do SIMVE.
 *   2) Reaproveita getEscolasPainelVacinal() para validar a escola permitida.
 *   3) Exige contexto de gestão (SAÚDE/ADM) no servidor.
 *   4) Recalcula a elegibilidade por data de nascimento antes de salvar.
 *   5) Só permite alterar cabeçalhos vacinais conhecidos.
 *   6) Nunca altera dados cadastrais.
 */

var SIMVE_AV_V69 = {
  ABA_BASE: 'BASE_GERAL',
  ABA_HISTORICO: 'HISTORICO_VACINAL',
  CACHE_SEGUNDOS: 21600,
  CABECALHO_MAX_LINHA: 12,
  LIMITE_SCAN_ARQUIVOS: 300,
  BASES: ['INFANTIL', 'ESCOLAR']
};

var SIMVE_AV_REGRAS_V69 = {
  INFANTIL: [
    {
      chave: 'H1N1',
      rotulo: 'H1N1',
      header: 'TEM H1N1 A PARTIR DE MARÇO DE 2026?',
      maxAnosExclusivo: 6,
      regraTexto: 'Menor de 6 anos',
      motivoAntes: '',
      motivoDepois: 'Disponível somente para crianças menores de 6 anos.'
    },
    {
      chave: 'D1_TRIPLICE_VIRAL',
      rotulo: 'D1 Tríplice Viral',
      header: 'TEM D1 TRIPLICE VIRAL?',
      minMeses: 12,
      regraTexto: 'A partir de 12 meses',
      motivoAntes: 'Disponível a partir de 12 meses.'
    },
    {
      chave: 'REF_PNM10',
      rotulo: 'Reforço PNM10',
      header: 'TEM REF. PNM10?',
      minMeses: 12,
      regraTexto: 'A partir de 12 meses',
      motivoAntes: 'Disponível a partir de 12 meses.'
    },
    {
      chave: 'REF_ACWY_INFANTIL',
      rotulo: 'Reforço ACWY',
      header: 'TEM REF. ACWY?',
      minMeses: 12,
      regraTexto: 'A partir de 12 meses',
      motivoAntes: 'Disponível a partir de 12 meses.'
    },
    {
      chave: 'TETRA',
      rotulo: 'Tetra',
      header: 'TEM TETRA?',
      minMeses: 15,
      regraTexto: 'A partir de 15 meses',
      motivoAntes: 'Disponível a partir de 15 meses.'
    },
    {
      chave: 'HEPATITE_A',
      rotulo: 'Hepatite A',
      header: 'TEM HEP.A?',
      minMeses: 15,
      regraTexto: 'A partir de 15 meses',
      motivoAntes: 'Disponível a partir de 15 meses.'
    },
    {
      chave: 'R1_DTP',
      rotulo: 'R1 DTP',
      header: 'TEM R1 DTP?',
      minMeses: 15,
      regraTexto: 'A partir de 15 meses',
      motivoAntes: 'Disponível a partir de 15 meses.'
    },
    {
      chave: 'REF_VIP',
      rotulo: 'Reforço VIP',
      header: 'TEM REF. VIP?',
      minMeses: 15,
      regraTexto: 'A partir de 15 meses',
      motivoAntes: 'Disponível a partir de 15 meses.'
    },
    {
      chave: 'R2_DTP',
      rotulo: 'R2 DTP',
      header: 'TEM R2 DTP?',
      minAnos: 4,
      regraTexto: 'A partir de 4 anos',
      motivoAntes: 'Disponível a partir de 4 anos.'
    },
    {
      chave: 'D2_VARICELA',
      rotulo: 'D2 Varicela',
      header: 'TEM D2 VARICELA?',
      minAnos: 4,
      regraTexto: 'A partir de 4 anos',
      motivoAntes: 'Disponível a partir de 4 anos.'
    },
    {
      chave: 'REF_FEBRE_AMARELA',
      rotulo: 'Reforço Febre Amarela',
      header: 'TEM REF. F.AMARELA?',
      minAnos: 4,
      regraTexto: 'A partir de 4 anos',
      motivoAntes: 'Disponível a partir de 4 anos.'
    }
  ],

  ESCOLAR: [
    {
      chave: 'HPV',
      rotulo: 'HPV',
      header: 'TEM HPV?',
      minAnos: 9,
      regraTexto: 'A partir de 9 anos',
      motivoAntes: 'Disponível a partir de 9 anos.'
    },
    {
      chave: 'DENGUE_D1',
      rotulo: 'Dengue D1',
      header: 'TEM D1 DENGUE?',
      minAnos: 10,
      regraTexto: 'A partir de 10 anos',
      motivoAntes: 'Disponível a partir de 10 anos.'
    },
    {
      chave: 'DENGUE_D2',
      rotulo: 'Dengue D2',
      header: 'TEM D2 DENGUE?',
      minAnos: 10,
      regraTexto: 'A partir de 10 anos',
      motivoAntes: 'Disponível a partir de 10 anos.'
    },
    {
      chave: 'ACWY_ESCOLAR',
      rotulo: 'ACWY',
      header: 'TEM ACWY?',
      minAnos: 11,
      maxAnos: 14,
      regraTexto: 'De 11 a 14 anos',
      motivoAntes: 'Disponível a partir de 11 anos.',
      motivoDepois: 'Indicada nesta base até 14 anos.'
    }
  ]
};


/* ============================================================
 * FUNÇÕES PÚBLICAS
 * ============================================================ */

function getAlunosAtualizacaoVacinal(token, escola) {
  var contexto = simveAV_validarAcessoEscrita_(token);
  var escolaPermitida = simveAV_validarEscolaPermitida_(token, escola);
  var nomeEscola = escolaPermitida.nome;
  var alunos = [];
  var vistos = {};

  SIMVE_AV_V69.BASES.forEach(function(base) {
    var ids = simveAV_resolverArquivosEscolaBase_(nomeEscola, base, escolaPermitida.meta);
    ids.forEach(function(id) {
      var registros = simveAV_lerRegistrosArquivo_(id, nomeEscola, base, false);
      registros.forEach(function(item) {
        var chave = base + '||' + String(item.matricula || item.cpf || item.nome || '');
        if (!vistos[chave]) {
          vistos[chave] = true;
          alunos.push(item);
        }
      });
    });
  });

  alunos.sort(function(a, b) {
    return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
  });

  return {
    ok: true,
    escola: nomeEscola,
    alunos: alunos,
    atualizadoEm: simveAV_formatarDataHora_(new Date()),
    contexto: simveAV_contextoPublico_(contexto)
  };
}


function getAlunoAtualizacaoVacinal(token, escola, base, matricula) {
  simveAV_validarAcessoEscrita_(token);
  var escolaPermitida = simveAV_validarEscolaPermitida_(token, escola);
  var nomeEscola = escolaPermitida.nome;
  var baseNorm = simveAV_normalizarBase_(base);

  if (SIMVE_AV_V69.BASES.indexOf(baseNorm) < 0) {
    throw new Error('Base vacinal inválida.');
  }

  var ids = simveAV_resolverArquivosEscolaBase_(nomeEscola, baseNorm, escolaPermitida.meta);
  var encontrado = null;

  for (var i = 0; i < ids.length && !encontrado; i++) {
    encontrado = simveAV_buscarAlunoNoArquivo_(ids[i], nomeEscola, baseNorm, matricula);
  }

  if (!encontrado) {
    throw new Error('Aluno não encontrado na base selecionada.');
  }

  return simveAV_montarAlunoDetalhado_(encontrado);
}


function salvarAtualizacaoVacinal(token, payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    var contexto = simveAV_validarAcessoEscrita_(token);
    payload = payload || {};

    var escolaPermitida = simveAV_validarEscolaPermitida_(token, payload.escola);
    var escola = escolaPermitida.nome;
    var base = simveAV_normalizarBase_(payload.base);
    var matricula = String(payload.matricula || '').trim();
    var alteracoes = payload.alteracoes || {};

    if (SIMVE_AV_V69.BASES.indexOf(base) < 0) {
      throw new Error('Base vacinal inválida.');
    }
    if (!matricula) {
      throw new Error('Matrícula do aluno não informada.');
    }
    if (!alteracoes || typeof alteracoes !== 'object') {
      throw new Error('Nenhuma alteração válida foi enviada.');
    }

    var ids = simveAV_resolverArquivosEscolaBase_(escola, base, escolaPermitida.meta);
    var registro = null;
    var arquivoId = '';

    for (var i = 0; i < ids.length && !registro; i++) {
      registro = simveAV_buscarAlunoNoArquivo_(ids[i], escola, base, matricula);
      if (registro) arquivoId = ids[i];
    }

    if (!registro || !arquivoId) {
      throw new Error('Não foi possível localizar o aluno na planilha de origem.');
    }

    var ss = SpreadsheetApp.openById(arquivoId);
    var sh = ss.getSheetByName(SIMVE_AV_V69.ABA_BASE);
    if (!sh) throw new Error('A aba BASE_GERAL não foi encontrada.');

    var cabecalhos = registro.cabecalhos;
    var indices = registro.indices;
    var regras = SIMVE_AV_REGRAS_V69[base] || [];
    var regrasPorChave = {};
    regras.forEach(function(r) { regrasPorChave[r.chave] = r; });

    var dn = registro.dnDate;
    var idade = simveAV_calcularIdade_(dn);
    var historico = [];
    var totalAlterado = 0;

    Object.keys(alteracoes).forEach(function(chave) {
      if (chave === 'OUTRAS_VACINAS') {
        var idxOutras = simveAV_indiceCabecalho_(cabecalhos, 'OUTRAS VACINAS');
        if (idxOutras < 0) throw new Error('Coluna OUTRAS VACINAS não encontrada.');

        var celOutras = sh.getRange(registro.row, idxOutras + 1);
        var anteriorOutras = String(celOutras.getDisplayValue() || '');
        var novoOutras = String(alteracoes[chave] == null ? '' : alteracoes[chave]).slice(0, 500);

        if (anteriorOutras !== novoOutras) {
          celOutras.setValue(novoOutras);
          totalAlterado++;
          historico.push(simveAV_linhaHistorico_(
            escola, base, registro, 'Outras Vacinas',
            anteriorOutras || 'NÃO AVALIADO',
            novoOutras || 'NÃO AVALIADO',
            contexto, payload
          ));
        }
        return;
      }

      var regra = regrasPorChave[chave];
      if (!regra) {
        throw new Error('Campo de vacina não autorizado: ' + chave);
      }

      var eleg = simveAV_verificarElegibilidade_(regra, idade);
      if (!eleg.elegivel) {
        throw new Error(regra.rotulo + ': alteração bloqueada pela regra de idade.');
      }

      var idxVacina = simveAV_indiceCabecalho_(cabecalhos, regra.header);
      if (idxVacina < 0) {
        throw new Error('Coluna não encontrada para ' + regra.rotulo + '.');
      }

      var novo = simveAV_normalizarValorEdicao_(alteracoes[chave]);
      var cel = sh.getRange(registro.row, idxVacina + 1);
      var anteriorDisplay = String(cel.getDisplayValue() || '').trim();
      var anterior = simveAV_normalizarSituacao_(anteriorDisplay, true);

      if (novo === anterior) return;

      if (novo === 'NAO_AVALIADO') {
        var formula = simveAV_formulaNaoAvaliado_(regra, registro.row, indices.dn);
        if (formula) {
          cel.setFormula(formula);
        } else {
          cel.clearContent();
        }
      } else if (novo === 'SIM') {
        cel.setValue('SIM');
      } else if (novo === 'NAO') {
        cel.setValue('NÃO');
      }

      totalAlterado++;
      historico.push(simveAV_linhaHistorico_(
        escola, base, registro, regra.rotulo,
        simveAV_rotuloSituacao_(anterior),
        simveAV_rotuloSituacao_(novo),
        contexto, payload
      ));
    });

    if (!totalAlterado) {
      return {
        ok: true,
        mensagem: 'Nenhuma alteração nova para salvar.',
        totalAlterado: 0
      };
    }

    SpreadsheetApp.flush();
    simveAV_registrarHistorico_(ss, historico);

    // Invalida o cache da resolução apenas se necessário no futuro.
    return {
      ok: true,
      mensagem: 'Situação vacinal atualizada com sucesso.',
      totalAlterado: totalAlterado,
      atualizadoEm: simveAV_formatarDataHora_(new Date())
    };

  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}


/* ============================================================
 * SEGURANÇA E ACESSO
 * ============================================================ */

function simveAV_validarAcessoEscrita_(token) {
  if (!token) throw new Error('Sessão inválida ou expirada.');

  var cache = CacheService.getScriptCache();
  var chave = 'SIMVE_AV_ROLE_' + simveAV_hashCurto_(String(token));
  var cacheado = cache.get(chave);
  if (cacheado) {
    try {
      var objCache = JSON.parse(cacheado);
      if (objCache && objCache.ok) return objCache.contexto || {};
    } catch (e) {}
  }

  if (typeof getPainelInicioPorPerfil !== 'function') {
    throw new Error('Função de validação de perfil do SIMVE não encontrada.');
  }

  var painel = getPainelInicioPorPerfil(token) || {};
  var perfilInicio = simveAV_norm_(painel.perfilInicio || painel.tipoPerfil || '');
  var perfilExplicito = simveAV_norm_(
    painel.perfil ||
    (painel.contexto && painel.contexto.perfil) ||
    ''
  );

  // O frontend atual usa GESTAO para SAÚDE/ADM e ranking para EDUCAÇÃO.
  // Se o backend informar o perfil explicitamente, só SAÚDE/ADM são aceitos.
  var perfilPermitido = !perfilExplicito ||
    perfilExplicito === 'SAUDE' ||
    perfilExplicito === 'ADM';

  if (perfilInicio !== 'GESTAO' || !perfilPermitido) {
    throw new Error('Acesso restrito ao perfil SAÚDE.');
  }

  var contexto = {
    perfilInicio: painel.perfilInicio || 'GESTAO',
    perfil: painel.perfil || (painel.contexto && painel.contexto.perfil) || '',
    usuario: painel.usuario || (painel.contexto && painel.contexto.usuario) || '',
    unidade:
      (painel.contexto && (painel.contexto.unidade || painel.contexto.nomeUnidade)) ||
      painel.unidade ||
      painel.nomeUnidade ||
      ''
  };

  try {
    cache.put(chave, JSON.stringify({ ok: true, contexto: contexto }), 300);
  } catch (e) {}

  return contexto;
}


function simveAV_validarEscolaPermitida_(token, escola) {
  if (typeof getEscolasPainelVacinal !== 'function') {
    throw new Error('Função de escolas permitidas do SIMVE não encontrada.');
  }

  var alvo = simveAV_norm_(escola);
  if (!alvo) throw new Error('Selecione uma escola.');

  var lista = getEscolasPainelVacinal(token);
  lista = Array.isArray(lista) ? lista : [];

  for (var i = 0; i < lista.length; i++) {
    var item = lista[i];
    var nome = typeof item === 'string' ? item : item.nome;
    if (simveAV_norm_(nome) === alvo) {
      return {
        nome: String(nome || escola).trim(),
        meta: typeof item === 'object' && item ? item : {}
      };
    }
  }

  throw new Error('Esta escola não está vinculada ao usuário logado.');
}


function simveAV_contextoPublico_(contexto) {
  return {
    unidade: contexto && contexto.unidade ? contexto.unidade : '',
    perfil: contexto && contexto.perfil ? contexto.perfil : ''
  };
}


/* ============================================================
 * LOCALIZAÇÃO DAS PLANILHAS
 * ============================================================ */

function simveAV_resolverArquivosEscolaBase_(escola, base, meta) {
  base = simveAV_normalizarBase_(base);
  var cache = CacheService.getScriptCache();
  var cacheKey = 'SIMVE_AV_FILE_' + simveAV_hashCurto_(simveAV_norm_(escola) + '|' + base);

  var cacheado = cache.get(cacheKey);
  if (cacheado) {
    try {
      var idsCache = JSON.parse(cacheado);
      if (Array.isArray(idsCache) && idsCache.length) return idsCache;
    } catch (e) {}
  }

  var ids = [];
  var vistos = {};

  function adicionar(id) {
    id = String(id || '').trim();
    if (!id || vistos[id]) return;
    vistos[id] = true;
    ids.push(id);
  }

  simveAV_idsDoMeta_(meta, base).forEach(adicionar);

  // Valida primeiro os IDs já conhecidos pelo backend atual.
  var validos = ids.filter(function(id) {
    return simveAV_arquivoContemEscolaBase_(id, escola, base);
  });

  if (!validos.length) {
    var tokens = simveAV_tokensBuscaArquivo_(escola);
    var candidatos = [];

    tokens.slice(0, 2).forEach(function(tokenBusca) {
      var query = "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false and title contains '" +
        String(tokenBusca).replace(/'/g, "\\'") + "'";
      try {
        var it = DriveApp.searchFiles(query);
        var n = 0;
        while (it.hasNext() && n < SIMVE_AV_V69.LIMITE_SCAN_ARQUIVOS) {
          candidatos.push(it.next().getId());
          n++;
        }
      } catch (e) {}
    });

    // Fallback por arquivos cujo título contém BASE.
    if (!candidatos.length) {
      try {
        var itBase = DriveApp.searchFiles(
          "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false and title contains 'BASE'"
        );
        var nb = 0;
        while (itBase.hasNext() && nb < SIMVE_AV_V69.LIMITE_SCAN_ARQUIVOS) {
          candidatos.push(itBase.next().getId());
          nb++;
        }
      } catch (e) {}
    }

    var candVistos = {};
    candidatos.forEach(function(id) {
      if (candVistos[id]) return;
      candVistos[id] = true;
      if (simveAV_arquivoContemEscolaBase_(id, escola, base)) validos.push(id);
    });
  }

  if (validos.length) {
    try { cache.put(cacheKey, JSON.stringify(validos), SIMVE_AV_V69.CACHE_SEGUNDOS); } catch (e) {}
  }

  return validos;
}


function simveAV_idsDoMeta_(meta, base) {
  meta = meta || {};
  var keysInf = [
    'spreadsheetIdInfantil', 'planilhaInfantilId', 'idPlanilhaInfantil',
    'baseInfantilId', 'arquivoInfantilId', 'infantilId'
  ];
  var keysEsc = [
    'spreadsheetIdEscolar', 'planilhaEscolarId', 'idPlanilhaEscolar',
    'baseEscolarId', 'arquivoEscolarId', 'escolarId'
  ];
  var keysGen = [
    'spreadsheetId', 'planilhaId', 'idPlanilha', 'arquivoId', 'fileId', 'id'
  ];

  var keys = base === 'INFANTIL' ? keysInf.slice() : keysEsc.slice();

  // Se a escola só possui uma das bases, um ID genérico também pode ser suficiente.
  var apenasUmaBase =
    (base === 'INFANTIL' && meta.infantil && !meta.escolar) ||
    (base === 'ESCOLAR' && meta.escolar && !meta.infantil);

  if (apenasUmaBase) keys = keys.concat(keysGen);

  var ids = [];
  keys.forEach(function(k) {
    var v = meta[k];
    if (Array.isArray(v)) {
      v.forEach(function(id) { if (id) ids.push(String(id)); });
    } else if (v) {
      ids.push(String(v));
    }
  });

  return ids;
}


function simveAV_tokensBuscaArquivo_(escola) {
  var ignorar = {
    'DE':1,'DA':1,'DO':1,'DAS':1,'DOS':1,'E':1,'EEF':1,'EMEF':1,'EMEI':1,
    'ESCOLA':1,'MUNICIPAL':1,'ENSINO':1,'FUNDAMENTAL':1,'INFANTIL':1,'CEI':1
  };

  return simveAV_norm_(escola)
    .split(/\s+/)
    .filter(function(t) { return t.length >= 4 && !ignorar[t]; })
    .sort(function(a, b) { return b.length - a.length; });
}


function simveAV_arquivoContemEscolaBase_(id, escola, base) {
  try {
    var ss = SpreadsheetApp.openById(id);
    var sh = ss.getSheetByName(SIMVE_AV_V69.ABA_BASE);
    if (!sh) return false;

    var headerRow = simveAV_encontrarLinhaCabecalho_(sh);
    if (!headerRow) return false;

    var lastRow = sh.getLastRow();
    if (lastRow <= headerRow) return false;

    var quantidade = Math.min(60, lastRow - headerRow);
    var vals = sh.getRange(headerRow + 1, 1, quantidade, Math.min(2, sh.getLastColumn())).getDisplayValues();
    var escolaNorm = simveAV_norm_(escola);
    var baseNorm = simveAV_normalizarBase_(base);

    for (var i = 0; i < vals.length; i++) {
      if (
        simveAV_norm_(vals[i][0]) === escolaNorm &&
        simveAV_normalizarBase_(vals[i][1]) === baseNorm
      ) return true;
    }
  } catch (e) {}

  return false;
}


/* ============================================================
 * LEITURA DA BASE
 * ============================================================ */

function simveAV_lerRegistrosArquivo_(arquivoId, escola, base, detalhado) {
  var ss = SpreadsheetApp.openById(arquivoId);
  var sh = ss.getSheetByName(SIMVE_AV_V69.ABA_BASE);
  if (!sh) return [];

  var headerRow = simveAV_encontrarLinhaCabecalho_(sh);
  if (!headerRow) return [];

  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow <= headerRow || !lastCol) return [];

  var cabecalhos = sh.getRange(headerRow, 1, 1, lastCol).getDisplayValues()[0];
  var indices = simveAV_indicesPrincipais_(cabecalhos);

  if (indices.escola < 0 || indices.base < 0 || indices.aluno < 0) return [];

  var rows = lastRow - headerRow;
  var range = sh.getRange(headerRow + 1, 1, rows, lastCol);
  var values = range.getValues();
  var display = range.getDisplayValues();

  var escolaNorm = simveAV_norm_(escola);
  var baseNorm = simveAV_normalizarBase_(base);
  var saida = [];

  for (var i = 0; i < rows; i++) {
    var linhaDisplay = display[i];
    var linhaValue = values[i];

    if (simveAV_norm_(linhaDisplay[indices.escola]) !== escolaNorm) continue;
    if (simveAV_normalizarBase_(linhaDisplay[indices.base]) !== baseNorm) continue;
    if (simveAV_registroInativo_(linhaDisplay, cabecalhos)) continue;

    var registro = simveAV_montarRegistro_(
      arquivoId, sh, headerRow + 1 + i, cabecalhos, indices, linhaValue, linhaDisplay
    );

    saida.push(detalhado ? simveAV_montarAlunoDetalhado_(registro) : simveAV_montarResumoAluno_(registro));
  }

  return saida;
}


function simveAV_buscarAlunoNoArquivo_(arquivoId, escola, base, matricula) {
  var ss = SpreadsheetApp.openById(arquivoId);
  var sh = ss.getSheetByName(SIMVE_AV_V69.ABA_BASE);
  if (!sh) return null;

  var headerRow = simveAV_encontrarLinhaCabecalho_(sh);
  if (!headerRow) return null;

  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow <= headerRow) return null;

  var cabecalhos = sh.getRange(headerRow, 1, 1, lastCol).getDisplayValues()[0];
  var indices = simveAV_indicesPrincipais_(cabecalhos);

  var rows = lastRow - headerRow;
  var range = sh.getRange(headerRow + 1, 1, rows, lastCol);
  var values = range.getValues();
  var display = range.getDisplayValues();

  var escolaNorm = simveAV_norm_(escola);
  var baseNorm = simveAV_normalizarBase_(base);
  var matNorm = String(matricula || '').trim();

  for (var i = 0; i < rows; i++) {
    var d = display[i];
    if (simveAV_norm_(d[indices.escola]) !== escolaNorm) continue;
    if (simveAV_normalizarBase_(d[indices.base]) !== baseNorm) continue;
    if (String(d[indices.matricula] || '').trim() !== matNorm) continue;
    if (simveAV_registroInativo_(d, cabecalhos)) continue;

    return simveAV_montarRegistro_(
      arquivoId, sh, headerRow + 1 + i, cabecalhos, indices, values[i], d
    );
  }

  return null;
}


function simveAV_montarRegistro_(arquivoId, sh, row, cabecalhos, indices, values, display) {
  var dnDate = simveAV_parseDate_(values[indices.dn], display[indices.dn]);
  return {
    arquivoId: arquivoId,
    sheetName: sh.getName(),
    row: row,
    cabecalhos: cabecalhos,
    indices: indices,
    values: values,
    display: display,
    escola: display[indices.escola] || '',
    base: simveAV_normalizarBase_(display[indices.base]),
    turma: display[indices.turma] || '',
    matricula: display[indices.matricula] || '',
    nome: display[indices.aluno] || '',
    cpf: indices.cpf >= 0 ? (display[indices.cpf] || '') : '',
    dnDate: dnDate,
    dn: dnDate ? simveAV_formatarData_(dnDate) : (display[indices.dn] || '')
  };
}


function simveAV_montarResumoAluno_(registro) {
  var detalhe = simveAV_montarAlunoDetalhado_(registro);
  return {
    nome: detalhe.nome,
    matricula: detalhe.matricula,
    cpf: detalhe.cpf,
    turma: detalhe.turma,
    base: detalhe.base,
    dn: detalhe.dn,
    idade: detalhe.idade,
    idadeTexto: detalhe.idadeTexto,
    situacao: detalhe.situacao
  };
}


function simveAV_montarAlunoDetalhado_(registro) {
  var idade = simveAV_calcularIdade_(registro.dnDate);
  var regras = SIMVE_AV_REGRAS_V69[registro.base] || [];
  var vacinas = [];
  var elegiveis = 0;
  var temNao = false;
  var temNaoAvaliado = false;

  regras.forEach(function(regra) {
    var idx = simveAV_indiceCabecalho_(registro.cabecalhos, regra.header);
    var eleg = simveAV_verificarElegibilidade_(regra, idade);
    var raw = idx >= 0 ? String(registro.display[idx] || '').trim() : '';
    var situacao;

    if (!eleg.elegivel) {
      situacao = 'NAO_TEM_IDADE';
    } else {
      elegiveis++;
      situacao = simveAV_normalizarSituacao_(raw, true);
      // Se a fórmula da planilha estiver divergente, a regra do SIMVE prevalece.
      if (situacao === 'NAO_TEM_IDADE') situacao = 'NAO_AVALIADO';
      if (situacao === 'NAO') temNao = true;
      if (situacao === 'NAO_AVALIADO') temNaoAvaliado = true;
    }

    vacinas.push({
      chave: regra.chave,
      rotulo: regra.rotulo,
      header: regra.header,
      regraTexto: regra.regraTexto || '',
      situacaoAtual: situacao,
      bloqueada: !eleg.elegivel,
      editavel: eleg.elegivel && idx >= 0,
      motivoBloqueio: !eleg.elegivel ? eleg.motivo : '',
      colunaEncontrada: idx >= 0
    });
  });

  var situacaoGeral = 'ATUALIZADA';
  if (!elegiveis) situacaoGeral = 'NAO_ELEGIVEL';
  else if (temNao) situacaoGeral = 'PENDENTE';
  else if (temNaoAvaliado) situacaoGeral = 'NAO_AVALIADO';

  var idxOutras = simveAV_indiceCabecalho_(registro.cabecalhos, 'OUTRAS VACINAS');

  return {
    nome: registro.nome,
    matricula: registro.matricula,
    cpf: registro.cpf,
    turma: registro.turma,
    base: registro.base,
    escola: registro.escola,
    dn: registro.dn,
    idade: idade.valida ? idade.anos : '',
    idadeTexto: simveAV_idadeTexto_(idade),
    situacao: situacaoGeral,
    vacinas: vacinas,
    outrasVacinas: idxOutras >= 0 ? String(registro.display[idxOutras] || '') : ''
  };
}


/* ============================================================
 * REGRAS DE IDADE
 * ============================================================ */

function simveAV_verificarElegibilidade_(regra, idade) {
  if (!idade || !idade.valida) {
    return {
      elegivel: false,
      motivo: 'Data de nascimento indisponível. Campo bloqueado por segurança.'
    };
  }

  if (typeof regra.minMeses === 'number' && idade.mesesTotal < regra.minMeses) {
    return { elegivel: false, motivo: regra.motivoAntes || ('Disponível a partir de ' + regra.minMeses + ' meses.') };
  }

  if (typeof regra.minAnos === 'number' && idade.anos < regra.minAnos) {
    return { elegivel: false, motivo: regra.motivoAntes || ('Disponível a partir de ' + regra.minAnos + ' anos.') };
  }

  if (typeof regra.maxAnos === 'number' && idade.anos > regra.maxAnos) {
    return { elegivel: false, motivo: regra.motivoDepois || ('Indicada até ' + regra.maxAnos + ' anos.') };
  }

  if (typeof regra.maxAnosExclusivo === 'number' && idade.anos >= regra.maxAnosExclusivo) {
    return { elegivel: false, motivo: regra.motivoDepois || ('Indicada para menores de ' + regra.maxAnosExclusivo + ' anos.') };
  }

  return { elegivel: true, motivo: '' };
}


function simveAV_calcularIdade_(dn) {
  if (!(dn instanceof Date) || isNaN(dn.getTime())) {
    return { valida: false, anos: 0, mesesTotal: 0, mesesRestantes: 0 };
  }

  var hoje = new Date();
  hoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  var nasc = new Date(dn.getFullYear(), dn.getMonth(), dn.getDate());

  if (nasc > hoje) return { valida: false, anos: 0, mesesTotal: 0, mesesRestantes: 0 };

  var anos = hoje.getFullYear() - nasc.getFullYear();
  var mesAniv = nasc.getMonth();
  var diaAniv = nasc.getDate();

  if (
    hoje.getMonth() < mesAniv ||
    (hoje.getMonth() === mesAniv && hoje.getDate() < diaAniv)
  ) anos--;

  var mesesTotal =
    (hoje.getFullYear() - nasc.getFullYear()) * 12 +
    (hoje.getMonth() - nasc.getMonth());

  if (hoje.getDate() < nasc.getDate()) mesesTotal--;
  if (mesesTotal < 0) mesesTotal = 0;

  return {
    valida: true,
    anos: Math.max(0, anos),
    mesesTotal: mesesTotal,
    mesesRestantes: mesesTotal % 12
  };
}


function simveAV_idadeTexto_(idade) {
  if (!idade || !idade.valida) return 'Idade não calculada';
  if (idade.anos < 2) {
    return idade.mesesTotal + (idade.mesesTotal === 1 ? ' mês' : ' meses');
  }
  if (idade.mesesRestantes) {
    return idade.anos + ' anos e ' + idade.mesesRestantes + ' meses';
  }
  return idade.anos + (idade.anos === 1 ? ' ano' : ' anos');
}


/* ============================================================
 * CABEÇALHOS E STATUS
 * ============================================================ */

function simveAV_encontrarLinhaCabecalho_(sh) {
  var maxRow = Math.min(SIMVE_AV_V69.CABECALHO_MAX_LINHA, sh.getLastRow());
  var maxCol = Math.min(Math.max(1, sh.getLastColumn()), 40);
  if (!maxRow || !maxCol) return 0;

  var dados = sh.getRange(1, 1, maxRow, maxCol).getDisplayValues();

  for (var r = 0; r < dados.length; r++) {
    var linha = dados[r].map(simveAV_norm_);
    var temEscola = linha.indexOf('ESCOLA') >= 0;
    var temBase = linha.indexOf('TIPO BASE') >= 0;
    var temAluno = linha.indexOf('ALUNO') >= 0;
    var temMat = linha.indexOf('MAT') >= 0 || linha.indexOf('MATRICULA') >= 0;

    if (temEscola && temBase && temAluno && temMat) return r + 1;
  }

  return 0;
}


function simveAV_indicesPrincipais_(cabecalhos) {
  return {
    escola: simveAV_indiceCabecalho_(cabecalhos, 'ESCOLA'),
    base: simveAV_indiceCabecalho_(cabecalhos, 'TIPO_BASE'),
    turma: simveAV_indiceCabecalho_(cabecalhos, 'TURMA'),
    matricula: simveAV_indiceCabecalho_(cabecalhos, 'MAT.'),
    aluno: simveAV_indiceCabecalho_(cabecalhos, 'ALUNO'),
    cpf: simveAV_indiceCabecalho_(cabecalhos, 'CPF'),
    dn: simveAV_indiceCabecalho_(cabecalhos, 'DN')
  };
}


function simveAV_indiceCabecalho_(cabecalhos, procurado) {
  var alvo = simveAV_norm_(procurado);
  for (var i = 0; i < cabecalhos.length; i++) {
    if (simveAV_norm_(cabecalhos[i]) === alvo) return i;
  }
  return -1;
}


function simveAV_registroInativo_(linhaDisplay, cabecalhos) {
  var idx = simveAV_indiceCabecalho_(cabecalhos, 'STATUS_MATRICULA');
  if (idx < 0) return false;

  var status = simveAV_norm_(linhaDisplay[idx] || '');
  if (!status) return false;

  return (
    status.indexOf('TRANSFER') >= 0 ||
    status.indexOf('INATIV') >= 0 ||
    status.indexOf('SAIU') >= 0 ||
    status.indexOf('EVADI') >= 0
  );
}


function simveAV_normalizarSituacao_(valor, vazioComoNaoAvaliado) {
  var v = simveAV_norm_(valor);
  if (v === 'SIM') return 'SIM';
  if (v === 'NAO') return 'NAO';
  if (v === 'NAO TEM IDADE') return 'NAO_TEM_IDADE';
  return vazioComoNaoAvaliado ? 'NAO_AVALIADO' : '';
}


function simveAV_normalizarValorEdicao_(valor) {
  var v = simveAV_norm_(valor);
  if (v === 'SIM') return 'SIM';
  if (v === 'NAO') return 'NAO';
  if (v === 'NAO AVALIADO' || v === 'NAO_AVALIADO' || !v) return 'NAO_AVALIADO';
  throw new Error('Situação vacinal inválida.');
}


function simveAV_rotuloSituacao_(valor) {
  if (valor === 'SIM') return 'SIM';
  if (valor === 'NAO') return 'NÃO';
  if (valor === 'NAO_TEM_IDADE') return 'NÃO TEM IDADE';
  return 'NÃO AVALIADO';
}


/* ============================================================
 * FÓRMULAS DA PLANILHA AO VOLTAR PARA "NÃO AVALIADO"
 * ============================================================ */

function simveAV_formulaNaoAvaliado_(regra, row, idxDnZeroBased) {
  if (idxDnZeroBased < 0) return '';
  var dnCol = simveAV_colunaA1_(idxDnZeroBased + 1);
  var ref = dnCol + row;

  if (typeof regra.minMeses === 'number') {
    return '=IF(' + ref + '="","",IF(DATEDIF(' + ref + ',TODAY(),"M")<' +
      regra.minMeses + ',"NÃO TEM IDADE",""))';
  }

  if (
    typeof regra.minAnos === 'number' &&
    typeof regra.maxAnos === 'number'
  ) {
    return '=IF(' + ref + '="","",IF(OR(DATEDIF(' + ref + ',TODAY(),"Y")<' +
      regra.minAnos + ',DATEDIF(' + ref + ',TODAY(),"Y")>' +
      regra.maxAnos + '),"NÃO TEM IDADE",""))';
  }

  if (typeof regra.minAnos === 'number') {
    return '=IF(' + ref + '="","",IF(DATEDIF(' + ref + ',TODAY(),"Y")<' +
      regra.minAnos + ',"NÃO TEM IDADE",""))';
  }

  if (typeof regra.maxAnosExclusivo === 'number') {
    return '=IF(' + ref + '="","",IF(DATEDIF(' + ref + ',TODAY(),"Y")>=' +
      regra.maxAnosExclusivo + ',"NÃO TEM IDADE",""))';
  }

  return '';
}


/* ============================================================
 * HISTÓRICO
 * ============================================================ */

function simveAV_linhaHistorico_(escola, base, registro, vacina, anterior, nova, contexto, payload) {
  var usuarioServidor = contexto && contexto.usuario ? contexto.usuario : '';
  var unidadeServidor = contexto && contexto.unidade ? contexto.unidade : '';

  return [
    new Date(),
    escola,
    base,
    registro.matricula,
    registro.nome,
    registro.turma,
    vacina,
    anterior,
    nova,
    usuarioServidor || String(payload.usuario || ''),
    unidadeServidor || String(payload.unidade || '')
  ];
}


function simveAV_registrarHistorico_(ss, linhas) {
  if (!linhas || !linhas.length) return;

  var sh = ss.getSheetByName(SIMVE_AV_V69.ABA_HISTORICO);
  if (!sh) sh = ss.insertSheet(SIMVE_AV_V69.ABA_HISTORICO);

  var headers = [
    'DATA_HORA', 'ESCOLA', 'BASE', 'MATRICULA', 'ALUNO', 'TURMA',
    'VACINA', 'SITUACAO_ANTERIOR', 'NOVA_SITUACAO', 'USUARIO', 'UNIDADE'
  ];

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }

  sh.getRange(sh.getLastRow() + 1, 1, linhas.length, headers.length).setValues(linhas);
}


/* ============================================================
 * UTILITÁRIOS
 * ============================================================ */

function simveAV_normalizarBase_(valor) {
  var v = simveAV_norm_(valor);
  if (v.indexOf('INFANTIL') >= 0) return 'INFANTIL';
  if (v.indexOf('ESCOLAR') >= 0) return 'ESCOLAR';
  return v;
}


function simveAV_norm_(valor) {
  return String(valor == null ? '' : valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\.?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}


function simveAV_parseDate_(valor, display) {
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
  }

  var s = String(display || valor || '').trim();
  var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    var d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (!isNaN(d.getTime())) return d;
  }

  var iso = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (iso) {
    var di = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!isNaN(di.getTime())) return di;
  }

  return null;
}


function simveAV_formatarData_(date) {
  return Utilities.formatDate(date, simveAV_timezone_(), 'dd/MM/yyyy');
}


function simveAV_formatarDataHora_(date) {
  return Utilities.formatDate(date, simveAV_timezone_(), 'dd/MM/yyyy HH:mm');
}


function simveAV_timezone_() {
  try {
    return Session.getScriptTimeZone() || 'America/Fortaleza';
  } catch (e) {
    return 'America/Fortaleza';
  }
}


function simveAV_colunaA1_(numero) {
  var n = Number(numero || 0);
  var s = '';
  while (n > 0) {
    var r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}


function simveAV_hashCurto_(texto) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(texto || ''),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '').slice(0, 28);
}
