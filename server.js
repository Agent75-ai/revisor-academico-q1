require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { Document, Packer, Paragraph } = require('docx');

const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(express.json());

let browser = null;

async function iniciarNavegador() {
  if (browser) return;
  try {
    console.log('Iniciando navegador...');
    browser = await chromium.launch({ headless: false });
  } catch (e) {
    console.log('Error navegador:', e.message);
  }
}

async function detectarDominios(texto) {
  if (!browser) return ['Safety Management', 'Risk Management'];
  try {
    const page = await browser.newPage();
    await page.goto('https://chat.openai.com', { waitUntil: 'networkidle', timeout: 30000 });
    
    const textoCorto = texto.substring(0, 1500);
    const prompt = 'Analiza este texto y lista SOLO los dominios academicos principales (Safety Management, Risk Governance, System Dynamics, etc). Responde SOLO en JSON: {"dominios_detectados": ["dominio1", "dominio2"]}. TEXTO: ' + textoCorto;

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
        return datos.dominios_detectados || ['Safety Management'];
      }
    } catch (e) {
      console.log('Error detectando dominios:', e.message);
    }
    
    return ['Safety Management', 'Risk Management'];
  } catch (e) {
    console.log('Error:', e.message);
    return ['Safety Management'];
  }
}

async function revisarConChatGPT(texto, iteracion) {
  if (!browser) return { puntaje: 50, dominios: [], bloqueadores: [], criticos: [], texto_completamente_mejorado: texto };
  
  try {
    console.log('[Iter ' + iteracion + '] Detectando dominios...');
    const dominios = await detectarDominios(texto);
    console.log('[Iter ' + iteracion + '] Dominios: ' + dominios.join(', '));
    
    const page = await browser.newPage();
    await page.goto('https://chat.openai.com', { waitUntil: 'networkidle', timeout: 30000 });
    
    const dominiosStr = dominios.join(', ');
    const textoParaRevision = texto.substring(0, 3500);
    
    const prompt = 'ERES REVISOR EXPERTO Q1 MULTIDOMINIO. DOMINIOS: ' + dominiosStr + '. RESTRICCION: MAX 8500 PALABRAS. ITERACION: ' + iteracion + '/5. DOCUMENTO: ' + textoParaRevision + '. Revisa y responde SOLO EN JSON: {"dominios_confirmados": ["d1"], "conteo_palabras": 5000, "excede_limite": false, "puntaje": 75, "nivel_aceptacion": "REVISION_MENOR", "bloqueadores": [], "criticos": [], "texto_completamente_mejorado": "texto mejorado"}';

    const textarea = await page.waitForSelector('textarea', { timeout: 15000 });
    await textarea.click();
    await textarea.fill(prompt);
    await page.press('textarea', 'Enter');
    
    console.log('[Iter ' + iteracion + '] Esperando respuesta...');
    await page.waitForTimeout(35000);
    
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
          bloqueadores: datos.bloqueadores || [],
          criticos: datos.criticos || [],
          texto_completamente_mejorado: datos.texto_completamente_mejorado || ''
        };
      }
    } catch (e) {
      console.log('[Iter ' + iteracion + '] Error parseando:', e.message);
    }
    
    return { puntaje: 50, dominios: dominios, bloqueadores: [], criticos: [], texto_completamente_mejorado: texto };
  } catch (e) {
    console.log('[Iter ' + iteracion + '] Error:', e.message);
    return { puntaje: 50, dominios: [], bloqueadores: [], criticos: [], texto_completamente_mejorado: texto };
  }
}

function aplicarMejora(texto, mejora) {
  if (!mejora || mejora.length < 50) return texto;
  if (mejora.length > texto.length * 0.95) return mejora;
  return mejora;
}

async function crearWordConResultados(textoFinal, historial) {
  const sections = [];
  
  sections.push(new Paragraph({ text: 'REVISION EXPERTA MULTIDOMINIO Q1', heading: 'Heading1', size: 32, bold: true }));
  sections.push(new Paragraph({ text: 'Analisis experto en cada dominio detectado', italics: true }));
  sections.push(new Paragraph({ text: '' }));
  
  sections.push(new Paragraph({ text: 'RESUMEN', heading: 'Heading2', bold: true }));
  
  const puntajeInicial = historial[0]?.puntaje || 0;
  const puntajeFinal = historial[historial.length - 1]?.puntaje || 0;
  const mejora = puntajeFinal - puntajeInicial;
  
  sections.push(new Paragraph({ text: 'Puntaje Inicial: ' + puntajeInicial + '/100' }));
  sections.push(new Paragraph({ text: 'Puntaje Final: ' + puntajeFinal + '/100', bold: true }));
  sections.push(new Paragraph({ text: 'Mejora: +' + mejora + ' puntos' }));
  
  sections.push(new Paragraph({ text: '' }));
  sections.push(new Paragraph({ text: 'ITERACIONES', heading: 'Heading2', bold: true }));
  
  historial.forEach((iter, idx) => {
    sections.push(new Paragraph({ text: 'Iteracion ' + (idx + 1) + ': ' + iter.puntaje + '/100', heading: 'Heading3', bold: true }));
    if (iter.dominios && iter.dominios.length > 0) {
      sections.push(new Paragraph({ text: 'Dominios: ' + iter.dominios.join(', '), italics: true }));
    }
    if (iter.bloqueadores && iter.bloqueadores.length > 0) {
      sections.push(new Paragraph({ text: 'Bloqueadores: ' + iter.bloqueadores.length }));
    }
  });
  
  sections.push(new Paragraph({ text: '' }));
  sections.push(new Paragraph({ text: 'TEXTO FINAL', heading: 'Heading2', bold: true }));
  
  const parrafos = textoFinal.split('\n').filter(p => p.trim());
  parrafos.forEach(parrafo => {
    sections.push(new Paragraph({ text: parrafo }));
  });

  const doc = new Document({ sections: [{ children: sections }] });
  return await Packer.toBuffer(doc);
}

const html = '<html><head><meta charset=UTF-8><title>Revisor Q1</title><style>body{font-family:Arial;background:linear-gradient(135deg,#667eea,#764ba2);margin:0;padding:20px}.container{max-width:1000px;margin:0 auto;background:white;padding:40px;border-radius:12px}.h1{color:#667eea;font-size:2em}input{padding:10px;width:100%;margin:10px 0;border:1px solid #ddd;border-radius:4px}button{padding:12px 20px;background:#667eea;color:white;border:none;cursor:pointer;border-radius:4px;margin:10px 5px 10px 0;font-weight:bold}button:disabled{opacity:0.5}textarea{width:100%;height:300px;padding:10px;margin:20px 0;border:1px solid #ddd;border-radius:4px;display:none}textarea.active{display:block}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin:20px 0}.stat{background:#667eea;color:white;padding:20px;text-align:center;border-radius:8px}.stat-value{font-size:2em;font-weight:bold}</style></head><body><div class="container"><h1>Revisor Experto Multidominio Q1</h1><p>Auto-deteccion de dominios y revision experta</p><input type=file id=f accept=".docx,.doc,.md,.txt"><button id=btn onclick="revisar()" disabled>Iniciar 5 Iteraciones</button><div id=prog style="display:none;background:#e8f4f8;padding:15px;margin:20px 0;border-radius:4px">Iteracion: <b id=iter>1</b>/5 | Puntaje: <b id=score>-</b>/100</div><div id=stats style="display:none" class="stats"><div class="stat"><div>Puntaje Inicial</div><div class="stat-value" id=score-inicial>-</div></div><div class="stat"><div>Puntaje Final</div><div class="stat-value" id=score-final>-</div></div><div class="stat"><div>Mejora</div><div class="stat-value" id=mejora>-</div></div></div><div id=download style="display:none;background:linear-gradient(135deg,#13c2c2,#1890ff);color:white;padding:20px;border-radius:8px;margin:20px 0"><h3>Revision Completa</h3><button onclick="descargarWord()" style="background:white;color:#13c2c2;border:none"><b>Descargar Word</b></button><button onclick="descargarTxt()">Descargar Texto</button></div><textarea id=o readonly></textarea></div><script>var file=document.getElementById("f");var btn=document.getElementById("btn");var datos=null;file.onchange=function(){btn.disabled=!file.files[0]};async function revisar(){var f=file.files[0];if(!f){alert("Selecciona archivo");return}document.getElementById("prog").style.display="block";document.getElementById("stats").style.display="none";document.getElementById("download").style.display="none";btn.disabled=true;var form=new FormData();form.append("documento",f);try{var r=await fetch("/revisar",{method:"POST",body:form});var d=await r.json();if(d.exito){datos=d;document.getElementById("score-inicial").textContent=d.puntajeInicial;document.getElementById("score-final").textContent=d.puntajeFinal;var mejora=d.puntajeFinal-d.puntajeInicial;document.getElementById("mejora").textContent=(mejora>=0?"+":"")+mejora;document.getElementById("o").value=d.textoFinal;document.getElementById("o").classList.add("active");document.getElementById("stats").style.display="grid";document.getElementById("download").style.display="block"}else{alert("Error: "+d.error)}}catch(e){alert("Error: "+e)}document.getElementById("prog").style.display="none";btn.disabled=false}function descargarWord(){if(!datos)return;var blob=new Blob([datos.wordBuffer],{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download="revision_q1.docx";a.click();URL.revokeObjectURL(url)}function descargarTxt(){if(!datos)return;var blob=new Blob([datos.textoFinal],{type:"text/plain"});var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download="revision_q1.txt";a.click();URL.revokeObjectURL(url)}</script></body></html>';

app.get('/', (req, res) => {
  res.send(html);
});

app.post('/revisar', upload.single('documento'), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ exito: false, error: 'No archivo' });
    }

    const ext = path.extname(req.file.path).toLowerCase();
    let textoOriginal = '';

    if (ext === '.docx' || ext === '.doc') {
      const { execSync } = require('child_process');
      try {
        textoOriginal = execSync('pandoc "' + req.file.path + '" -t plain', {
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024
        });
      } catch {
        textoOriginal = fs.readFileSync(req.file.path, 'utf-8');
      }
    } else if (ext === '.md' || ext === '.txt') {
      textoOriginal = fs.readFileSync(req.file.path, 'utf-8');
    } else {
      return res.json({ exito: false, error: 'Solo .docx, .doc, .md o .txt' });
    }

    let textoActual = textoOriginal;
    const historial = [];
    let puntajeFinal = 0;

    console.log('=== INICIANDO REVISION MULTIDOMINIO Q1 ===');
    await iniciarNavegador();

    for (let i = 1; i <= 5; i++) {
      console.log('\n>>> ITERACION ' + i + '/5');
      
      const revision = await revisarConChatGPT(textoActual, i);
      
      puntajeFinal = revision.puntaje;
      historial.push({
        iteracion: i,
        puntaje: revision.puntaje,
        dominios: revision.dominios,
        bloqueadores: revision.bloqueadores,
        criticos: revision.criticos
      });

      if (revision.texto_completamente_mejorado && revision.texto_completamente_mejorado.length > 100) {
        textoActual = aplicarMejora(textoActual, revision.texto_completamente_mejorado);
      }

      console.log('OK Puntaje: ' + revision.puntaje + '/100 | Dominios: ' + revision.dominios.join(', '));
    }

    const wordBuffer = await crearWordConResultados(textoActual, historial);

    try { fs.unlinkSync(req.file.path); } catch {}

    res.json({
      exito: true,
      textoFinal: textoActual,
      historial: historial,
      iteraciones: 5,
      puntajeInicial: historial[0]?.puntaje || 0,
      puntajeFinal: puntajeFinal,
      wordBuffer: Array.from(wordBuffer)
    });

  } catch (error) {
    console.error('ERROR:', error);
    res.json({ exito: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;

iniciarNavegador();

app.listen(PORT, () => {
  console.log('Revisor Multidominio Q1 en linea');
});
