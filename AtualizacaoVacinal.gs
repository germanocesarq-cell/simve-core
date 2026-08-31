/**
 * ============================================================
 * SIMVE v71 - ATUALIZAÇÃO DA SITUAÇÃO VACINAL | PERFIL SAÚDE
 * ============================================================
 *
 * Arquivo adicional do projeto Apps Script.
 * Não substitui o Code.gs atual.
 *
 * Funções públicas usadas pelo App.html:
 *   - getEscolasAtualizacaoVacinal(token)
 *   - getAlunosAtualizacaoVacinal(token, escola)
 *   - getAlunoAtualizacaoVacinal(token, escola, base, matricula, linha)
 *   - salvarAtualizacaoVacinal(token, payload)
 *
 * Segurança:
 *   1) Reaproveita a sessão atual do SIMVE.
 *   2) Valida as escolas pela sessão + CONFIG_PLANILHAS_ESCOLAS, sem reler as bases completas.
 *   3) Exige contexto de gestão (SAÚDE/ADM) no servidor.
 *   4) Recalcula a elegibilidade por data de nascimento antes de salvar.
 *   5) Só permite alterar cabeçalhos vacinais conhecidos.
 *   6) Nunca altera dados cadastrais.
 */

var SIMVE_AV_V69 = {
  VERSAO: '71.0',
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

/**
 * Lista leve de escolas da Atualização Vacinal.
 *
 * Diferente de getEscolasPainelVacinal(), esta rotina NÃO lê BASE_INFANTIL e
 * BASE_ESCOLAR inteiras. Ela cruza apenas a sessão do usuário com a pequena
 * CONFIG_PLANILHAS_ESCOLAS, reduzindo bastante o tempo para abrir esta tela.
 */
function getEscolasAtualizacaoVacinal(token) {
  simveAV_validarAcessoEscrita_(token);
  var session = requireSession_(token) || {};
  return simveAV_resolverEscolasPermitidasConfig_(session).map(function(item) {
    return {
      nome: item.nome,
      infantil: !!item.infantil,
      escolar: !!item.escolar
    };
  });
}

function getAlunosAtualizacaoVacinal(token, escola) {
  var contexto = simveAV_validarAcessoEscrita_(token);
  var escolaPermitida = simveAV_validarEscolaPermitida_(token, escola);
  var nomeEscola = escolaPermitida.nome;
  var meta = escolaPermitida.meta || {};
  var alunos = [];
  var vistos = {};
  var fontesConsultadas = [];

  // Usa somente as bases que o próprio SIMVE informa que existem para a escola.
  // Isso evita procurar INFANTIL em escola apenas ESCOLAR e vice-versa.
  var bases = [];
  if (meta.infantil) bases.push('INFANTIL');
  if (meta.escolar) bases.push('ESCOLAR');
  if (!bases.length) bases = SIMVE_AV_V69.BASES.slice();

  bases.forEach(function(base) {
    var fontes = simveAV_resolverFontesEscolaBase_(nomeEscola, base, meta);

    fontes.forEach(function(fonte) {
      fontesConsultadas.push({
        base: base,
        arquivoId: fonte.id,
        aba: fonte.sheetName
      });

      var registros = simveAV_lerRegistrosArquivo_(
        fonte.id,
        nomeEscola,
        base,
        false,
        fonte.sheetName
      );

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
    total: alunos.length,
    atualizadoEm: simveAV_formatarDataHora_(new Date()),
    contexto: simveAV_contextoPublico_(contexto),
    diagnostico: {
      versao: SIMVE_AV_V69.VERSAO || '71.0',
      bases: bases,
      fontesConsultadas: fontesConsultadas.length
    }
  };
}

function getAlunoAtualizacaoVacinal(token, escola, base, matricula, linha) {
  simveAV_validarAcessoEscrita_(token);
  var escolaPermitida = simveAV_validarEscolaPermitida_(token, escola);
  var nomeEscola = escolaPermitida.nome;
  var baseNorm = simveAV_normalizarBase_(base);

  if (SIMVE_AV_V69.BASES.indexOf(baseNorm) < 0) {
    throw new Error('Base vacinal inválida.');
  }

  var fontes = simveAV_resolverFontesEscolaBase_(nomeEscola, baseNorm, escolaPermitida.meta);
  var encontrado = null;

  for (var i = 0; i < fontes.length && !encontrado; i++) {
    encontrado = simveAV_buscarAlunoNoArquivo_(
      fontes[i].id,
      nomeEscola,
      baseNorm,
      matricula,
      fontes[i].sheetName,
      linha
    );
  }

  if (!encontrado) {
    throw new Error('Aluno não encontrado na planilha configurada para esta escola/base.');
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
    var linha = Number(payload.linha || 0);
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

    var fontes = simveAV_resolverFontesEscolaBase_(escola, base, escolaPermitida.meta);
    var registro = null;
    var fonteUsada = null;

    for (var i = 0; i < fontes.length && !registro; i++) {
      registro = simveAV_buscarAlunoNoArquivo_(
        fontes[i].id,
        escola,
        base,
        matricula,
        fontes[i].sheetName,
        linha
      );
      if (registro) fonteUsada = fontes[i];
    }

    if (!registro || !fonteUsada) {
      throw new Error('Não foi possível localizar o aluno na planilha de origem configurada.');
    }

    var ss;
    try {
      ss = SpreadsheetApp.openById(fonteUsada.id);
    } catch (eAbrir) {
      throw new Error(
        'Sem acesso à planilha configurada para ' + escola + ' / ' + base +
        '. Verifique se a conta que executa o Web App possui permissão de Editor. Detalhe: ' +
        (eAbrir && eAbrir.message ? eAbrir.message : eAbrir)
      );
    }

    var sh = ss.getSheetByName(fonteUsada.sheetName || SIMVE_AV_V69.ABA_BASE);
    if (!sh) throw new Error('A aba configurada não foi encontrada: ' + (fonteUsada.sheetName || SIMVE_AV_V69.ABA_BASE));

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

  // Usa diretamente a sessão oficial do SIMVE. Isso é mais seguro do que
  // inferir o perfil pela tela inicial e impede que ADM/EDUCAÇÃO gravem vacinas.
  if (typeof requireSession_ !== 'function') {
    throw new Error('Função de sessão do SIMVE não encontrada.');
  }

  var session = requireSession_(token) || {};
  var perfil = simveAV_norm_(session.perfil || '');

  if (perfil !== 'SAUDE') {
    throw new Error('Acesso restrito ao perfil SAÚDE.');
  }

  var unidade = '';
  if (session.unidade) unidade = String(session.unidade || '').trim();

  if (!unidade && typeof getUnidadeDoUsuario_ === 'function') {
    try { unidade = String(getUnidadeDoUsuario_(session) || '').trim(); } catch (e) {}
  }

  return {
    perfilInicio: 'GESTAO',
    perfil: session.perfil || 'SAUDE',
    usuario: session.usuario || '',
    unidade: unidade,
    escolasPermitidas: Array.isArray(session.escolasPermitidas) ? session.escolasPermitidas.slice() : []
  };
}

function simveAV_validarEscolaPermitida_(token, escola) {
  var alvo = simveAV_norm_(escola);
  if (!alvo) throw new Error('Selecione uma escola.');

  // Os chamadores públicos já exigem perfil SAÚDE. Aqui recuperamos a sessão
  // do cache e fazemos apenas a validação leve de escola/configuração.
  var session = requireSession_(token) || {};
  var lista = simveAV_resolverEscolasPermitidasConfig_(session);

  for (var i = 0; i < lista.length; i++) {
    var item = lista[i];
    if (simveAV_norm_(item.nome) === alvo) {
      return {
        nome: String(item.nome || escola).trim(),
        meta: item
      };
    }
  }

  throw new Error('Esta escola não está vinculada ao usuário logado.');
}

function simveAV_escolasSessao_(session) {
  session = session || {};
  var lista = [];

  function adicionar(valor) {
    String(valor || '')
      .split(/[;,]/)
      .map(function(x) { return String(x || '').trim(); })
      .filter(Boolean)
      .forEach(function(x) { lista.push(x); });
  }

  if (Array.isArray(session.escolasPermitidas)) {
    session.escolasPermitidas.forEach(adicionar);
  }
  if (session.escola) adicionar(session.escola);

  var usadas = {};
  return lista.filter(function(nome) {
    var chave = simveAV_norm_(nome);
    if (!chave || usadas[chave]) return false;
    usadas[chave] = true;
    return true;
  });
}

function simveAV_resolverEscolasPermitidasConfig_(session) {
  var escolasUsuario = simveAV_escolasSessao_(session);
  if (!escolasUsuario.length) return [];

  var configuradas = simveAV_lerMapaConfigPlanilhas_();
  var nomesConfigurados = Object.keys(configuradas).map(function(chave) {
    return configuradas[chave].nome;
  });
  var saida = [];
  var usadas = {};

  escolasUsuario.forEach(function(escolaUsuario) {
    var item = configuradas[simveAV_norm_(escolaUsuario)] || null;

    if (!item && typeof encontrarMelhorEscolaNaBase_ === 'function') {
      var aproximada = encontrarMelhorEscolaNaBase_(escolaUsuario, nomesConfigurados);
      if (aproximada) item = configuradas[simveAV_norm_(aproximada)] || null;
    }

    if (!item) return;
    var chave = simveAV_norm_(item.nome);
    if (usadas[chave]) return;
    usadas[chave] = true;
    saida.push(item);
  });

  return saida.sort(function(a, b) {
    return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
  });
}


function simveAV_lerMapaConfigPlanilhas_() {
  if (typeof ID_PLANILHA === 'undefined' || !ID_PLANILHA) {
    throw new Error('ID da BASE MUNICIPAL não configurado no projeto.');
  }

  var ss = SpreadsheetApp.openById(ID_PLANILHA);
  var sh = ss.getSheetByName('CONFIG_PLANILHAS_ESCOLAS');
  if (!sh) throw new Error('Aba CONFIG_PLANILHAS_ESCOLAS não encontrada.');

  var data = sh.getDataRange().getValues();
  if (data.length < 2) return {};

  var headers = data[0].map(function(h) { return simveAV_norm_(h); });
  var idxEscola = headers.indexOf('ESCOLA');
  var idxBase = headers.indexOf('TIPO_BASE');
  var idxId = headers.indexOf('ID_PLANILHA');
  var idxAba = headers.indexOf('ABA_ORIGEM');
  var idxAtivo = headers.indexOf('ATIVO');
  var idxTipoPlanilha = headers.indexOf('TIPO_PLANILHA');
  var idxUnidade = headers.indexOf('UNIDADE');

  if (idxEscola < 0 || idxId < 0) {
    throw new Error('CONFIG_PLANILHAS_ESCOLAS precisa ter ESCOLA e ID_PLANILHA.');
  }

  var mapa = {};
  for (var i = 1; i < data.length; i++) {
    var escola = String(data[i][idxEscola] || '').trim();
    var id = String(data[i][idxId] || '').trim();
    if (!escola || !id) continue;

    if (idxAtivo >= 0) {
      var ativo = simveAV_norm_(data[i][idxAtivo]);
      if (ativo && ativo !== 'SIM' && ativo !== 'S' && ativo !== 'ATIVO') continue;
    }

    var base = idxBase >= 0 ? simveAV_normalizarBase_(data[i][idxBase]) : '';
    var chave = simveAV_norm_(escola);
    if (!mapa[chave]) {
      mapa[chave] = { nome: escola, infantil: false, escolar: false, fontes: {} };
    }

    if (base === 'INFANTIL' || base === 'ESCOLAR') {
      if (base === 'INFANTIL') mapa[chave].infantil = true;
      if (base === 'ESCOLAR') mapa[chave].escolar = true;
      mapa[chave].fontes[base] = {
        id: id,
        sheetName: idxAba >= 0 ? (String(data[i][idxAba] || '').trim() || SIMVE_AV_V69.ABA_BASE) : SIMVE_AV_V69.ABA_BASE,
        base: base,
        escola: escola,
        tipoPlanilha: idxTipoPlanilha >= 0 ? String(data[i][idxTipoPlanilha] || '').trim() : '',
        unidade: idxUnidade >= 0 ? String(data[i][idxUnidade] || '').trim() : ''
      };
    }
  }

  return mapa;
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

function simveAV_resolverFontesEscolaBase_(escola, base, meta) {
  base = simveAV_normalizarBase_(base);
  escola = String(escola || '').trim();

  if (!escola || SIMVE_AV_V69.BASES.indexOf(base) < 0) {
    throw new Error('Escola/base inválida para localizar a planilha de origem.');
  }

  // v71: quando a validação de acesso já leu CONFIG_PLANILHAS_ESCOLAS,
  // reaproveita a fonte resolvida e evita reler a configuração.
  var fonteMeta = meta && meta.fontes && meta.fontes[base] ? meta.fontes[base] : null;
  if (fonteMeta && fonteMeta.id) {
    return [{
      id: String(fonteMeta.id || '').trim(),
      sheetName: String(fonteMeta.sheetName || SIMVE_AV_V69.ABA_BASE).trim() || SIMVE_AV_V69.ABA_BASE,
      base: base,
      escola: fonteMeta.escola || escola,
      tipoPlanilha: fonteMeta.tipoPlanilha || '',
      unidade: fonteMeta.unidade || ''
    }];
  }

  // Fallback compatível com a arquitetura anterior.
  if (typeof getPlanilhaEscolaDestino_ !== 'function') {
    throw new Error('Função getPlanilhaEscolaDestino_ não encontrada no backend atual.');
  }

  var destino;
  try {
    destino = getPlanilhaEscolaDestino_(escola, base) || {};
  } catch (eDestino) {
    throw new Error(
      'Não foi encontrada configuração ativa em CONFIG_PLANILHAS_ESCOLAS para ' +
      escola + ' / ' + base + '. Detalhe: ' +
      (eDestino && eDestino.message ? eDestino.message : eDestino)
    );
  }

  var id = String(destino.spreadsheetId || destino.idPlanilha || destino.id || '').trim();
  var sheetName = String(destino.sheetName || destino.abaOrigem || SIMVE_AV_V69.ABA_BASE).trim() || SIMVE_AV_V69.ABA_BASE;

  if (!id) {
    throw new Error('ID_PLANILHA não informado em CONFIG_PLANILHAS_ESCOLAS para ' + escola + ' / ' + base + '.');
  }

  // A abertura efetiva acontece na rotina de leitura. Evitamos abrir o mesmo
  // arquivo duas vezes na mesma requisição; os erros de acesso/aba continuam
  // sendo retornados com contexto pela função de leitura.

  return [{
    id: id,
    sheetName: sheetName,
    base: base,
    escola: destino.escola || escola,
    tipoPlanilha: destino.tipoPlanilha || '',
    unidade: destino.unidade || ''
  }];
}

// Compatibilidade interna com eventuais referências antigas.
function simveAV_resolverArquivosEscolaBase_(escola, base, meta) {
  return simveAV_resolverFontesEscolaBase_(escola, base, meta).map(function(fonte) {
    return fonte.id;
  });
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

function simveAV_lerRegistrosArquivo_(arquivoId, escola, base, detalhado, sheetName) {
  var ss;
  try {
    ss = SpreadsheetApp.openById(arquivoId);
  } catch (eAbrir) {
    throw new Error('Não foi possível abrir a planilha configurada para ' + escola + ' / ' + base + '. Detalhe: ' + (eAbrir && eAbrir.message ? eAbrir.message : eAbrir));
  }
  var nomeAba = sheetName || SIMVE_AV_V69.ABA_BASE;
  var sh = ss.getSheetByName(nomeAba);
  if (!sh) throw new Error('A aba configurada "' + nomeAba + '" não existe na planilha de ' + escola + ' / ' + base + '.');

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


function simveAV_buscarAlunoNoArquivo_(arquivoId, escola, base, matricula, sheetName, linhaPreferida) {
  var ss;
  try {
    ss = SpreadsheetApp.openById(arquivoId);
  } catch (eAbrir) {
    throw new Error('Não foi possível abrir a planilha configurada para ' + escola + ' / ' + base + '. Detalhe: ' + (eAbrir && eAbrir.message ? eAbrir.message : eAbrir));
  }

  var nomeAba = sheetName || SIMVE_AV_V69.ABA_BASE;
  var sh = ss.getSheetByName(nomeAba);
  if (!sh) throw new Error('A aba configurada "' + nomeAba + '" não existe na planilha de ' + escola + ' / ' + base + '.');

  var headerRow = simveAV_encontrarLinhaCabecalho_(sh);
  if (!headerRow) return null;

  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow <= headerRow || !lastCol) return null;

  var cabecalhos = sh.getRange(headerRow, 1, 1, lastCol).getDisplayValues()[0];
  var indices = simveAV_indicesPrincipais_(cabecalhos);

  if (indices.escola < 0 || indices.base < 0 || indices.matricula < 0 || indices.aluno < 0) {
    return null;
  }

  var escolaNorm = simveAV_norm_(escola);
  var baseNorm = simveAV_normalizarBase_(base);
  var matNorm = String(matricula || '').trim();

  // Caminho rápido v71: a lista já informa a linha física do aluno.
  // A linha recebida do cliente NUNCA é confiada cegamente: escola, base,
  // matrícula e situação ativa são validadas antes de o registro ser usado.
  var linha = Number(linhaPreferida || 0);
  if (linha && Math.floor(linha) === linha && linha > headerRow && linha <= lastRow) {
    var rangeLinha = sh.getRange(linha, 1, 1, lastCol);
    var valueLinha = rangeLinha.getValues()[0];
    var displayLinha = rangeLinha.getDisplayValues()[0];

    if (
      simveAV_norm_(displayLinha[indices.escola]) === escolaNorm &&
      simveAV_normalizarBase_(displayLinha[indices.base]) === baseNorm &&
      String(displayLinha[indices.matricula] || '').trim() === matNorm &&
      !simveAV_registroInativo_(displayLinha, cabecalhos)
    ) {
      return simveAV_montarRegistro_(
        arquivoId, sh, linha, cabecalhos, indices, valueLinha, displayLinha
      );
    }
  }

  // Fallback seguro: se a planilha tiver sido ordenada/movida depois que a
  // lista foi carregada, procura pela matrícula no conjunto completo.
  var rows = lastRow - headerRow;
  var range = sh.getRange(headerRow + 1, 1, rows, lastCol);
  var values = range.getValues();
  var display = range.getDisplayValues();

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
    situacao: detalhe.situacao,
    linha: registro.row
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
    linha: registro.row,
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
