async function detectarDominios(texto) {
  if (!browser) return ['Safety Management', 'Risk Management'];
  
  try {
    const page = await browser.newPage();
    await page.goto('https://chat.openai.com', { waitUntil: 'networkidle', timeout: 30000 });
    
    const prompt = `Analiza este texto academico y IDENTIFICA TODOS LOS DOMINIOS Y CAMPOS DE ESTUDIO QUE ABORDA.

TEXTO:
${texto.substring(0, 2000)}

Responde SOLO EN JSON VALIDO:
{
  "dominios_detectados": [
    "dominio1",
    "dominio2"
  ],
  "areas_especializacion": [
    "area1",
    "area2"
  ],
  "conceptos_clave": ["concepto1", "concepto2"]
}

EJEMPLOS DE DOMINIOS: Safety Management, Risk Governance, System Dynamics, Human Factors, Organizational Behavior, Nuclear Engineering, Reactor Physics, Operations Research, Management Theory, Decision Making, Complex Systems, HRO, etc.`;

    const textarea = await page.waitForSelector('textarea', { timeout: 10000 });
    await textarea.click();
    await textarea.fill(prompt);
    await page.press('textarea', 'Enter');
    
    await page.waitForTimeout(10000);
    
    let respuesta = '';
    try {
      const msgs = await page.$$('[data-testid="conversation-turn"]');
      if (msgs.length > 0) {
        respuesta = await msgs[msgs.length - 1].textContent();
      }
    } catch {
      respuesta = await page.textContent('body');
    }
    
    await page.close();
    
    try {
      const jsonMatch = respuesta.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const datos = JSON.parse(jsonMatch[0]);
        return datos.dominios_detectados || ['Safety Management', 'Risk Management'];
      }
    } catch (e) {
      console.log('Error detectando dominios:', e.message);
    }
    
    return ['Safety Management', 'Risk Management'];
  } catch (e) {
    console.log('Error en detección de dominios:', e.message);
    return ['Safety Management', 'Risk Management'];
  }
}

async function construirPromptExpertoPorDominio(texto, iteracion, dominios) {
  const dominiosStr = dominios.join(', ');
  
  const expertisaPorDominio = {
    'Safety Management': 'Weick, Roberts, Sutcliffe (HRO), Rasmussen (Dynamic Safety), Wahlström (Systemic Safety Culture)',
    'Risk Governance': 'Risk frameworks, governance structures, decision-making under uncertainty',
    'Risk Management': 'Risk assessment, risk control, risk communication',
    'System Dynamics': 'Feedback loops, stocks & flows, non-linear behavior, system modeling',
    'System Theory': 'von Bertalanffy, complexity, emergence, feedback loops, requisite variety',
    'High Reliability Organizations': 'HRO characteristics, mindfulness, resilience, error management',
    'Human Factors': 'Human error, cognitive psychology, situation awareness, workload management',
    'Organizational Behavior': 'Organizational learning, culture, communication, decision structures',
    'Management Theory': 'Management models, organizational structure, leadership, change management',
    'Nuclear Engineering': 'Reactor design, safety systems, neutronics, thermal-hydraulics',
    'Nuclear Operations': 'Operational procedures, operational experience, WANO, INPO standards',
    'Nuclear Safety': 'Defense in depth, safety culture, regulatory requirements, operational experience',
    'Complex Systems': 'Complexity science, emergence, non-linearity, adaptive systems',
    'Accident Investigation': 'STAMP, AcciMap, event tree analysis, causal factors',
    'Decision Making': 'Decision theory, group decision, under uncertainty, bounded rationality',
    'Operations Research': 'Optimization, modeling, simulation, quantitative methods',
    'Governance': 'Organizational governance, decision processes, accountability structures'
  };
  
  const expertisaRelevante = dominios
    .filter(d => expertisaPorDominio[d])
    .map(d => \`- \${d}: \${expertisaPorDominio[d]}\`)
    .join('\\n');

  const prompt = \`ERES UN REVISOR EXPERTO Q1 MULTIDOMINIO EXTREMADAMENTE RIGUROSO.

DOMINIOS DETECTADOS EN ESTE PAPER:
\${dominiosStr}

EXPERTISE REQUERIDA:
\${expertisaRelevante}

COMO EXPERTO EN ESTOS DOMINIOS:
1. Conoces profundamente cada campo
2. Entiendes las intersecciones entre ellos
3. Puedes identificar inconsistencias cross-domain
4. Validas rigurosamente en cada área
5. Detectas cuando falta expertise en algún dominio

ESPECIALISTAS CLAVE A CONSIDERAR (segun dominios):
- Safety Management: Weick, Roberts, Sutcliffe (HRO); Rasmussen (Dynamic Safety); Wahlström (Systemic Safety)
- Risk Governance: IRGC, Renn frameworks
- System Dynamics: Sterman, Forrester, Meadows
- System Theory: von Bertalanffy, Ashby (Requisite Variety), Laszlo
- Nuclear: IAEA, NRC, WANO, INPO standards and operational experience
- Accident Models: Leveson (STAMP), AcciMap, Reason (Swiss Cheese)
- Complexity: Kauffman, Arthur, Anderson
- Organizational: Schein (Culture), Argyris (Learning), Senge (Systems Thinking)

RESTRICCION CRITICA: MAXIMO 8500 PALABRAS
- Si supera 8500: BLOQUEADOR
- Compacta sin perder rigor en NINGUN dominio

ITERACION: \${iteracion}/5

CRITERIOS DE REVISION EXHAUSTIVOS:

1. LIMITE DE PALABRAS (BLOQUEADOR)
2. EXPERTISE EN CADA DOMINIO DETECTADO (CRITICO)
   - Por cada dominio: ¿Tiene profundidad suficiente?
   - ¿Cita autoridades en ese campo?
   - ¿Evita simplificaciones peligrosas?
3. COHERENCIA INTER-DOMINIOS (CRITICO)
   - ¿Los dominios se integran coherentemente?
   - ¿Hay contradicciones entre áreas?
   - ¿Reconoce tensiones legítimas (ej: safety vs production)?
4. POSICIONAMIENTO VS EXPERTOS (CRITICO)
   - ¿Se posiciona vs autoridades en cada dominio?
   - ¿Cita trabajos seminal?
   - ¿Evita reinventar la rueda?
5. ORIGINALIDAD WITHIN DOMAINS
   - ¿Qué es nuevo en cada dominio?
   - ¿Dónde hay contribution?
6. PLAUSIBILIDAD MULTI-DOMINIO
   - ¿Es viable opcionalmente considerando todos los dominios?
7. ORACIONES AL POSITIVO
8. ARGUMENTOS DÉBILES REFORMULADOS
9. COMPACTACION INTELIGENTE (mantén lo fundamental en cada dominio)

DOCUMENTO (iteracion \${iteracion}):
\${texto.substring(0, 4000)}

RESPONDE SOLO EN JSON VALIDO:
{
  "dominios_confirmados": \${JSON.stringify(dominios)},
  "conteo_palabras": <numero>,
  "excede_limite": <true|false>,
  "puntaje": <0-100>,
  "nivel_aceptacion": "ACEPTAR|REVISION_MENOR|REVISION_MAYOR|RECHAZO",
  
  "analisis_por_dominio": [
    {
      "dominio": "dominio1",
      "profundidad": <0-10>,
      "expertos_clave_no_citados": ["experto1", "experto2"],
      "problemas": "problemas específicos en este dominio",
      "fortalezas": "fortalezas en este dominio",
      "autoridades_deberia_citar": ["autor (year)", "autor (year)"]
    }
  ],
  
  "coherencia_inter_dominios": {
    "es_coherente": <true|false>,
    "tensiones_detectadas": ["tension1", "tension2"],
    "reconciliacion_sugerida": "cómo mejorar integración"
  },
  
  "bloqueadores": [
    {"dominio": "...", "tipo": "LIMITE_PALABRAS|EXPERTISE|POSICIONAMIENTO|INCOHERENCIA", 
     "problema": "...",
     "impacto": "..."}
  ],
  
  "criticos": [
    {"dominio": "...", "tipo": "...", "problema": "...", "solucion": "..."}
  ],
  
  "referencias_faltantes_por_dominio": [
    {"dominio": "...", "autoridad_faltante": "Autor (Year) - obra", "razon": "por que es crítica en este dominio"}
  ],
  
  "argumentos_debiles_por_dominio": [
    {"dominio": "...", "argumento": "...", "problema": "...", "reformulacion": "..."}
  ],
  
  "compactacion": [
    {"parrafo": 1, "dominio_afectado": "...", "palabras_original": 150, "palabras_compactada": 80}
  ],
  
  "texto_completamente_mejorado": "<texto < 8500 PALABRAS, con expertise completa en TODOS los dominios detectados>",
  
  "resumen_por_dominio": {
    "dominio1": "que cambio en este dominio",
    "dominio2": "que cambio en este dominio"
  },
  
  "veredicto_multidominio": "<es Q1 considerando TODOS los dominios? Análisis integrado>",
  "proximos_pasos": "<mejoras por dominio para alcanzar Q1>"
}

REQUISITOS IMPRESCINDIBLES:
- JSON VALIDO
- Analiza cada dominio con expertise profunda
- Valida integración entre dominios
- < 8500 palabras
- Se implacable en cada área de expertise`;

  return prompt;
}

async function revisarConChatGPT(texto, iteracion) {
  if (!browser) {
    return { 
      puntaje: 50,
      dominios: [],
      bloqueadores: [],
      criticos: [],
      sugerencias_reforma: [],
      referencias_faltantes: [],
      argumentos_debiles: [],
      texto_completamente_mejorado: texto
    };
  }

  try {
    console.log(`[Iter ${iteracion}] Detectando dominios...`);
    const dominios = await detectarDominios(texto);
    console.log(`[Iter ${iteracion}] Dominios detectados: ${dominios.join(', ')}`);
    
    const page = await browser.newPage();
    await page.goto('https://chat.openai.com', { waitUntil: 'networkidle', timeout: 30000 });
    
    const prompt = await construirPromptExpertoPorDominio(texto, iteracion, dominios);

    const textarea = await page.waitForSelector('textarea', { timeout: 15000 });
    await textarea.click();
    await textarea.fill(prompt);
    await page.press('textarea', 'Enter');
    
    console.log(`[Iter ${iteracion}] Esperando revision multi-dominio...`);
    await page.waitForTimeout(40000);
    
    let respuesta = '';
    try {
      const msgs = await page.$$('[data-testid="conversation-turn"]');
      if (msgs.length > 0) {
        respuesta = await msgs[msgs.length - 1].textContent();
      }
    } catch {
      respuesta = await page.textContent('body');
    }
    
    await page.close();
    
    try {
      const jsonMatch = respuesta.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const datos = JSON.parse(jsonMatch[0]);
        return {
          puntaje: datos.puntaje || 50,
          dominios: datos.dominios_confirmados || dominios,
          analisis_por_dominio: datos.analisis_por_dominio || [],
          coherencia_inter_dominios: datos.coherencia_inter_dominios || {},
          bloqueadores: datos.bloqueadores || [],
          criticos: datos.criticos || [],
          sugerencias_reforma: datos.sugerencias_reforma || [],
          referencias_faltantes_por_dominio: datos.referencias_faltantes_por_dominio || [],
          argumentos_debiles: datos.argumentos_debiles || [],
          texto_completamente_mejorado: datos.texto_completamente_mejorado || '',
          resumen_por_dominio: datos.resumen_por_dominio || {},
          veredicto_multidominio: datos.veredicto_multidominio || '',
          proximos_pasos: datos.proximos_pasos || ''
        };
      }
    } catch (e) {
      console.log(`[Iter ${iteracion}] Error parseando:`, e.message);
    }
    
    return { 
      puntaje: 50,
      dominios: dominios,
      bloqueadores: [],
      criticos: [],
      sugerencias_reforma: [],
      referencias_faltantes_por_dominio: [],
      argumentos_debiles: [],
      texto_completamente_mejorado: texto
    };
  } catch (e) {
    console.log(`[Iter ${iteracion}] Error:`, e.message);
    return { 
      puntaje: 50,
      dominios: [],
      bloqueadores: ['Error de conexion'],
      criticos: [],
      sugerencias_reforma: [],
      referencias_faltantes_por_dominio: [],
      argumentos_debiles: [],
      texto_completamente_mejorado: texto
    };
  }
}
