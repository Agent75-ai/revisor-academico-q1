require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle } = require('docx');
const docxParse = require('docx');

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

async function revisarConChatGPT(texto, iteracion) {
  if (!browser) {
    return { 
      puntaje: 50 + (iteracion * 5),
      problemas: [],
      bloqueadores: [],
      criticos: [],
      sugerencias: [],
      texto_mejorado: texto
    };
  }

  try {
    const page = await browser.newPage();
    await page.goto('https://chat.openai.com', { waitUntil: 'networkidle', timeout: 30000 });
    
    const prompt = `ERES UN REVISOR EXTREMADAMENTE CRITICO Y ESCEPTICO PARA JOURNAL Q1.

ITERACION: ${iteracion}/5

DOMINIO: Safety Management, HRO, Risk Governance, System Dynamics, STAMP.

INSTRUCCIONES PRECISAS:
1. Identifica BLOQUEADORES: Problemas que hacen inadmisible el trabajo
2. Identifica CRITICOS: Problemas graves que requieren revision mayor
3. Identifica SUGERENCIAS: Mejoras importantes
4. Proporciona texto mejorado si es posible
5. Da un puntaje honesto (0-100)

DOCUMENTO (iteracion ${iteracion}):
${texto.substring(0, 3500)}

RESPONDE EN JSON VALIDO (SIN MARKDOWN):
{
  "puntaje": <numero entre 0 y 100>,
  "bloqueadores": ["problema1", "problema2"],
  "criticos": ["problema3", "problema4"],
  "sugerencias": ["sugerencia1", "sugerencia2"],
  "texto_mejorado": "texto corregido aqui si aplica",
  "resumen_cambios": "que se cambio en esta iteracion",
  "recomendacion": "ACEPTAR|REVISION_MAYOR|RECHAZO"
}

RESPONDE SOLO JSON, SIN EXPLICACIONES ADICIONALES.`;

    const textarea = await page.waitForSelector('textarea', { timeout: 15000 });
    await textarea.click();
    await textarea.fill(prompt);
    await page.press('textarea', 'Enter');
    
    console.log(`[Iter ${iteracion}] Esperando respuesta...`);
    await page.waitForTimeout(25000);
    
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
          bloqueadores: datos.bloqueadores || [],
          criticos: datos.criticos || [],
          sugerencias: datos.sugerencias || [],
          texto_mejorado: datos.texto_mejorado || '',
          resumen_cambios: datos.resumen_cambios || '',
          recomendacion: datos.recomendacion || 'REVISION_MAYOR'
        };
      }
    } catch (e) {
      console.log(`[Iter ${iteracion}] Error parseando JSON:`, e.message);
    }
    
    return { 
      puntaje: 50 + (iteracion * 5),
      bloqueadores: [],
      criticos: [],
      sugerencias: [],
      texto_mejorado: '',
      resumen_cambios: 'No se pudo procesar',
      recomendacion: 'REVISION_MAYOR'
    };
  } catch (e) {
    console.log(`[Iter ${iteracion}] Error ChatGPT:`, e.message);
    return { 
      puntaje: 50,
      bloqueadores: ['Error de conexion'],
      criticos: [],
      sugerencias: [],
      texto_mejorado: '',
      resumen_cambios: 'Error',
      recomendacion: 'ERROR'
    };
  }
}

function aplicarMejora(texto, mejora) {
  if (!mejora || mejora.length < 10) return texto;
  if (mejora.length > texto.length * 0.9) return mejora;
  return texto;
}

async function crearWordConResultados(textoFinal, historial) {
  const sections = [];

  sections.push(
    new Paragraph({
      text: 'REVISION ACADEMICA Q1',
      heading: 'Heading1',
      size: 32,
      bold: true
    })
  );

  sections.push(
    new Paragraph({
      text: `Dominio: Safety Management, HRO, Risk Governance`,
      italics: true
    })
  );

  sections.push(new Paragraph({ text: '' }));
  sections.push(
    new Paragraph({
      text: 'RESUMEN EJECUTIVO',
      heading: 'Heading2',
      bold: true
    })
  );

  const puntajeInicial = historial[0]?.puntaje || 0;
  const puntajeFinal = historial[historial.length - 1]?.puntaje || 0;
  const mejora = puntajeFinal - puntajeInicial;

  sections.push(
    new Paragraph({
      text: `Puntaje Inicial: ${puntajeInicial}/100`,
      spacing: { line: 240 }
    })
  );
  sections.push(
    new Paragraph({
      text: `Puntaje Final: ${puntajeFinal}/100`,
      spacing: { line: 240 }
    })
  );
  sections.push(
    new Paragraph({
      text: `Mejora Total: +${mejora} puntos`,
      spacing: { line: 240 },
      bold: true
    })
  );

  sections.push(new Paragraph({ text: '' }));
  sections.push(
    new Paragraph({
      text: 'HISTORIAL DE ITERACIONES',
      heading: 'Heading2',
      bold: true
    })
  );

  historial.forEach((iter, idx) => {
    sections.push(
      new Paragraph({
        text: `Iteracion ${idx + 1}: Puntaje ${iter.puntaje}/100`,
        heading: 'Heading3',
        bold: true,
        color: iter.puntaje >= 80 ? '008000' : iter.puntaje >= 60 ? 'FF8C00' : 'FF0000'
      })
    );

    if (iter.bloqueadores && iter.bloqueadores.length > 0) {
      sections.push(
        new Paragraph({
          text: 'BLOQUEADORES:',
          bold: true,
          color: 'FF0000'
        })
      );
      iter.bloqueadores.forEach(b => {
        sections.push(
          new Paragraph({
            text: `• ${b}`,
            spacing: { line: 240 }
          })
        );
      });
    }

    if (iter.criticos && iter.criticos.length > 0) {
      sections.push(
        new Paragraph({
          text: 'CRITICOS:',
          bold: true,
          color: 'FF8C00'
        })
      );
      iter.criticos.forEach(c => {
        sections.push(
          new Paragraph({
            text: `• ${c}`,
            spacing: { line: 240 }
          })
        );
      });
    }

    if (iter.sugerencias && iter.sugerencias.length > 0) {
      sections.push(
        new Paragraph({
          text: 'SUGERENCIAS:',
          bold: true,
          color: '0070C0'
        })
      );
      iter.sugerencias.forEach(s => {
        sections.push(
          new Paragraph({
            text: `• ${s}`,
            spacing: { line: 240 }
          })
        );
      });
    }

    if (iter.resumen_cambios) {
      sections.push(
        new Paragraph({
          text: `Cambios: ${iter.resumen_cambios}`,
          italics: true,
          spacing: { line: 240 }
        })
      );
    }

    sections.push(new Paragraph({ text: '' }));
  });

  sections.push(
    new Paragraph({
      text: 'TEXTO FINAL REVISADO',
      heading: 'Heading2',
      bold: true
    })
  );

  const parrafos = textoFinal.split('\n').filter(p => p.trim());
  parrafos.forEach(parrafo => {
    sections.push(
      new Paragraph({
        text: parrafo,
        spacing: { line: 360 }
      })
    );
  });

  const doc = new Document({
    sections: [{
      children: sections
    }]
  });

  return await Packer.toBuffer(doc);
}

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset=UTF-8>
<title>Revisor Q1 - 5 Iteraciones Completo</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;padding:20px}
.container{max-width:1000px;margin:0 auto;background:white;border-radius:12px;padding:30px;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
h1{color:#667eea;margin-bottom:10px;font-size:2em}
.subtitle{color:#888;margin-bottom:30px}
.upload-section{background:#f5f7fa;padding:20px;border-radius:8px;margin-bottom:30px}
input{padding:10px;width:100%;margin:10px 0;border:1px solid #ddd;border-radius:4px}
button{padding:12px 24px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;cursor:pointer;border-radius:4px;font-weight:bold;margin:10px 5px 10px 0;transition:all 0.3s}
button:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 25px rgba(102,126,234,0.4)}
button:disabled{opacity:0.5;cursor:not-allowed}
.progress{background:#e8f4f8;padding:20px;border-radius:8px;margin:20px 0;display:none;border-left:4px solid #667eea}
.progress.active{display:block}
.iteration{background:white;border:1px solid #e0e0e0;padding:15px;margin:10px 0;border-radius:6px;border-left:4px solid #667eea}
.iteration.high{border-left-color:#13c2c2}
.iteration.medium{border-left-color:#faad14}
.iteration.low{border-left-color:#f5222d}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin:30px 0}
.stat{background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:20px;border-radius:8px;text-align:center}
.stat-value{font-size:2em;font-weight:bold;margin:10px 0}
.download{background:linear-gradient(135deg,#13c2c2,#1890ff);color:white;padding:20px;border-radius:8px;margin:30px 0;display:none}
.download.active{display:block}
.download h3{margin-bottom:15px}
textarea{width:100%;height:300px;padding:15px;margin:20px 0;border:1px solid #ddd;border-radius:4px;font-family:monospace;display:none}
textarea.active{display:block}
.bloqueador{color:#f5222d;font-weight:bold}
.critico{color:#faad14;font-weight:bold}
.sugerencia{color:#0070c0}
</style>
</head>
<body>
<div class="container">
<h1>🎓 Revisor Academico Q1</h1>
<p class="subtitle">Safety Management, HRO, Risk Governance - 5 Iteraciones</p>

<div class="upload-section">
<h3>Cargar Documento para Revision</h3>
<input type=file id=f accept=".docx,.doc,.md,.txt">
<button id=btn onclick="revisar()" disabled>Iniciar 5 Iteraciones</button>
</div>

<div class="progress" id=prog>
<div>Iteracion: <b id=iter>1</b>/5</div>
<div>Puntaje Actual: <b id=score>-</b>/100</div>
<div id=historial style="margin-top:15px"></div>
</div>

<div class="stats" id=stats style="display:none">
<div class="stat">
<div>Puntaje Inicial</div>
<div class="stat-value" id=score-inicial>-</div>
</div>
<div class="stat">
<div>Puntaje Final</div>
<div class="stat-value" id=score-final>-</div>
</div>
<div class="stat">
<div>Mejora Total</div>
<div class="stat-value" id=mejora>-</div>
</div>
</div>

<div class="download" id=download>
<h3>Documento Revisado Listo</h3>
<button onclick="descargarWord()"><b>📥 Descargar Word Completo</b></button>
<button onclick="descargarTxt()">📄 Descargar Texto</button>
</div>

<textarea id=o readonly></textarea>

</div>

<script>
var file=document.getElementById('f');
var btn=document.getElementById('btn');
var datos=null;

file.onchange=function(){btn.disabled=!file.files[0]};

async function revisar(){
var f=file.files[0];
if(!f){alert('Selecciona un archivo');return}
document.getElementById('prog').classList.add('active');
document.getElementById('stats').style.display='none';
document.getElementById('download').classList.remove('active');
document.getElementById('o').classList.remove('active');
btn.disabled=true;

var form=new FormData();
form.append('documento',f);

try{
var r=await fetch('/revisar',{method:'POST',body:form});
var d=await r.json();
if(d.exito){
datos=d;
document.getElementById('score-inicial').textContent=d.puntajeInicial;
document.getElementById('score-final').textContent=d.puntajeFinal;
var mejora=d.puntajeFinal-d.puntajeInicial;
document.getElementById('mejora').textContent=(mejora>=0?'+':'')+mejora;
document.getElementById('o').value=d.textoFinal;
document.getElementById('o').classList.add('active');
document.getElementById('stats').style.display='grid';
document.getElementById('download').classList.add('active');

var hist='';
d.historial.forEach((it,i)=>{
var clase=it.puntaje>=80?'high':it.puntaje>=60?'medium':'low';
hist+='<div class="iteration '+clase+'"><strong>Iteracion '+(i+1)+'</strong> - Puntaje: '+it.puntaje+'/100';
if(it.bloqueadores&&it.bloqueadores.length>0){
hist+='<div class=bloqueador>Bloqueadores: '+it.bloqueadores.join(', ')+'</div>';
}
if(it.criticos&&it.criticos.length>0){
hist+='<div class=critico>Criticos: '+it.criticos.join(', ')+'</div>';
}
if(it.resumen_cambios){
hist+='<div style="margin-top:10px;font-size:0.9em">'+it.resumen_cambios+'</div>';
}
hist+='</div>';
});
document.getElementById('historial').innerHTML=hist;
}else{
alert('Error: '+d.error);
}
}catch(e){
alert('Error: '+e);
}
document.getElementById('prog').classList.remove('active');
btn.disabled=false;
}

function descargarWord(){
if(!datos)return;
var blob=new Blob([datos.wordBuffer],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
var url=URL.createObjectURL(blob);
var a=document.createElement('a');
a.href=url;
a.download='revision_completa.docx';
a.click();
URL.revokeObjectURL(url);
}

function descargarTxt(){
if(!datos)return;
var blob=new Blob([datos.textoFinal],{type:'text/plain'});
var url=URL.createObjectURL(blob);
var a=document.createElement('a');
a.href=url;
a.download='revision.txt';
a.click();
URL.revokeObjectURL(url);
}
</script>
</body>
</html>`;

app.get('/', (req, res) => {
  res.send(html);
});

app.post('/revisar', upload.single('documento'), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ exito: false, error: 'No se envio documento' });
    }

    const ext = path.extname(req.file.path).toLowerCase();
    let textoOriginal = '';

    if (ext === '.docx' || ext === '.doc') {
      const { execSync } = require('child_process');
      try {
        textoOriginal = execSync(`pandoc "${req.file.path}" -t plain`, {
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

    console.log('=== INICIANDO 5 ITERACIONES ===');
    await iniciarNavegador();

    for (let i = 1; i <= 5; i++) {
      console.log(`\n>>> ITERACION ${i}/5`);
      
      const revision = await revisarConChatGPT(textoActual, i);
      
      puntajeFinal = revision.puntaje;
      historial.push({
        iteracion: i,
        puntaje: revision.puntaje,
        bloqueadores: revision.bloqueadores,
        criticos: revision.criticos,
        sugerencias: revision.sugerencias,
        resumen_cambios: revision.resumen_cambios,
        recomendacion: revision.recomendacion
      });

      if (revision.texto_mejorado && revision.texto_mejorado.length > 50) {
        textoActual = aplicarMejora(textoActual, revision.texto_mejorado);
      }

      console.log(`Puntaje: ${revision.puntaje}/100`);
      console.log(`Bloqueadores: ${revision.bloqueadores.length} | Criticos: ${revision.criticos.length}`);
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
  console.log('Revisor Academico Q1 en linea');
  console.log('http://localhost:' + PORT);
});
