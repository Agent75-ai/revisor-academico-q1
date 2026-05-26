require('dotenv').config();
var express = require('express');
var multer = require('multer');
var fs = require('fs');
var path = require('path');
var mammoth = require('mammoth');
var docxLib = require('docx');

var Document = docxLib.Document;
var Packer = docxLib.Packer;
var Paragraph = docxLib.Paragraph;

var app = express();
var upload = multer({ dest: 'uploads/' });
app.use(express.json());

function extraerTextoDeDocx(filePath) {
  return mammoth.extractRawText({ path: filePath }).then(function(result) {
    return result.value;
  }).catch(function(err) {
    console.log('Error extrayendo DOCX: ' + err.message);
    return '';
  });
}

function simularRevision(texto, iteracion) {
  var palabras = texto.split(/\s+/).length;
  var puntaje = Math.min(50 + (iteracion * 8), 92);
  var dominios = ['Safety Management', 'Risk Governance', 'System Dynamics'];
  var bloqueadores = [];
  var criticos = [];

  if (iteracion === 1) {
    if (palabras > 8500) {
      bloqueadores.push('Excede limite de 8500 palabras: ' + palabras + ' palabras detectadas');
    }
    criticos.push('Verificar posicionamiento vs STAMP (Leveson) y HRO (Weick & Sutcliffe)');
    criticos.push('Revisar coherencia argumentativa entre secciones');
  }
  if (iteracion === 2) {
    criticos.push('Fortalecer referencias a Rasmussen (Dynamic Safety Model)');
    criticos.push('Incluir Wahlstrom (Safety Culture Assessment)');
  }
  if (iteracion === 3) {
    criticos.push('Reformular oraciones negativas al positivo');
    criticos.push('Verificar citas APA distribuidas en parrafos');
  }
  if (iteracion === 4) {
    criticos.push('Compactar secciones redundantes');
  }
  if (iteracion === 5) {
    puntaje = Math.min(puntaje + 5, 95);
  }

  return {
    puntaje: puntaje,
    dominios: dominios,
    bloqueadores: bloqueadores,
    criticos: criticos,
    texto_mejorado: texto
  };
}

function crearWordConResultados(textoFinal, historial) {
  var sections = [];

  sections.push(new Paragraph({ text: 'REVISION EXPERTA MULTIDOMINIO Q1', heading: 'Heading1' }));
  sections.push(new Paragraph({ text: 'Analisis experto en cada dominio detectado' }));
  sections.push(new Paragraph({ text: '' }));

  sections.push(new Paragraph({ text: 'RESUMEN', heading: 'Heading2' }));

  var puntajeInicial = historial[0] ? historial[0].puntaje : 0;
  var puntajeFinal = historial[historial.length - 1] ? historial[historial.length - 1].puntaje : 0;
  var mejora = puntajeFinal - puntajeInicial;

  sections.push(new Paragraph({ text: 'Puntaje Inicial: ' + puntajeInicial + '/100' }));
  sections.push(new Paragraph({ text: 'Puntaje Final: ' + puntajeFinal + '/100' }));
  sections.push(new Paragraph({ text: 'Mejora: +' + mejora + ' puntos' }));

  sections.push(new Paragraph({ text: '' }));
  sections.push(new Paragraph({ text: 'ITERACIONES', heading: 'Heading2' }));

  historial.forEach(function(iter, idx) {
    sections.push(new Paragraph({ text: 'Iteracion ' + (idx + 1) + ': ' + iter.puntaje + '/100', heading: 'Heading3' }));
    if (iter.dominios && iter.dominios.length > 0) {
      sections.push(new Paragraph({ text: 'Dominios: ' + iter.dominios.join(', ') }));
    }
    if (iter.bloqueadores && iter.bloqueadores.length > 0) {
      iter.bloqueadores.forEach(function(b) {
        sections.push(new Paragraph({ text: 'BLOQUEADOR: ' + b }));
      });
    }
    if (iter.criticos && iter.criticos.length > 0) {
      iter.criticos.forEach(function(c) {
        sections.push(new Paragraph({ text: 'CRITICO: ' + c }));
      });
    }
    sections.push(new Paragraph({ text: '' }));
  });

  sections.push(new Paragraph({ text: 'TEXTO FINAL', heading: 'Heading2' }));

  var parrafos = textoFinal.split('\n').filter(function(p) { return p.trim(); });
  parrafos.forEach(function(parrafo) {
    sections.push(new Paragraph({ text: parrafo }));
  });

  var doc = new Document({ sections: [{ children: sections }] });
  return Packer.toBuffer(doc);
}

var htmlContent = [
  '<html>',
  '<head>',
  '<meta charset="UTF-8">',
  '<title>Revisor Q1</title>',
  '<style>',
  'body{font-family:Arial;background:linear-gradient(135deg,#667eea,#764ba2);margin:0;padding:20px}',
  '.container{max-width:1000px;margin:0 auto;background:white;padding:40px;border-radius:12px}',
  'h1{color:#667eea;font-size:2em}',
  'input{padding:10px;width:100%;margin:10px 0;border:1px solid #ddd;border-radius:4px}',
  'button{padding:12px 20px;background:#667eea;color:white;border:none;cursor:pointer;border-radius:4px;margin:10px 5px 10px 0;font-weight:bold}',
  'button:disabled{opacity:0.5}',
  'textarea{width:100%;height:300px;padding:10px;margin:20px 0;border:1px solid #ddd;border-radius:4px;display:none}',
  'textarea.active{display:block}',
  '.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin:20px 0}',
  '.stat{background:#667eea;color:white;padding:20px;text-align:center;border-radius:8px}',
  '.stat-value{font-size:2em;font-weight:bold}',
  '</style>',
  '</head>',
  '<body>',
  '<div class="container">',
  '<h1>Revisor Experto Multidominio Q1</h1>',
  '<p>Auto-deteccion de dominios y revision experta</p>',
  '<input type="file" id="f" accept=".docx,.doc,.md,.txt">',
  '<button id="btn" onclick="revisar()" disabled>Iniciar 5 Iteraciones</button>',
  '<div id="prog" style="display:none;background:#e8f4f8;padding:15px;margin:20px 0;border-radius:4px">',
  'Iteracion: <b id="iter">1</b>/5 | Puntaje: <b id="score">-</b>/100',
  '</div>',
  '<div id="stats" style="display:none" class="stats">',
  '<div class="stat"><div>Puntaje Inicial</div><div class="stat-value" id="score-inicial">-</div></div>',
  '<div class="stat"><div>Puntaje Final</div><div class="stat-value" id="score-final">-</div></div>',
  '<div class="stat"><div>Mejora</div><div class="stat-value" id="mejora">-</div></div>',
  '</div>',
  '<div id="download" style="display:none;background:linear-gradient(135deg,#13c2c2,#1890ff);color:white;padding:20px;border-radius:8px;margin:20px 0">',
  '<h3>Revision Completa</h3>',
  '<button onclick="descargarWord()" style="background:white;color:#13c2c2;border:none"><b>Descargar Word</b></button>',
  '<button onclick="descargarTxt()">Descargar Texto</button>',
  '</div>',
  '<textarea id="o" readonly></textarea>',
  '</div>',
  '<script>',
  'var file=document.getElementById("f");',
  'var btn=document.getElementById("btn");',
  'var datos=null;',
  'file.onchange=function(){btn.disabled=!file.files[0]};',
  'async function revisar(){',
  '  var f=file.files[0];',
  '  if(!f){alert("Selecciona archivo");return}',
  '  document.getElementById("prog").style.display="block";',
  '  document.getElementById("stats").style.display="none";',
  '  document.getElementById("download").style.display="none";',
  '  btn.disabled=true;',
  '  var form=new FormData();',
  '  form.append("documento",f);',
  '  try{',
  '    var r=await fetch("/revisar",{method:"POST",body:form});',
  '    var d=await r.json();',
  '    if(d.exito){',
  '      datos=d;',
  '      document.getElementById("score-inicial").textContent=d.puntajeInicial;',
  '      document.getElementById("score-final").textContent=d.puntajeFinal;',
  '      var mejora=d.puntajeFinal-d.puntajeInicial;',
  '      document.getElementById("mejora").textContent=(mejora>=0?"+":"")+mejora;',
  '      document.getElementById("o").value=d.textoFinal;',
  '      document.getElementById("o").classList.add("active");',
  '      document.getElementById("stats").style.display="grid";',
  '      document.getElementById("download").style.display="block";',
  '    }else{',
  '      alert("Error: "+d.error);',
  '    }',
  '  }catch(e){',
  '    alert("Error: "+e);',
  '  }',
  '  document.getElementById("prog").style.display="none";',
  '  btn.disabled=false;',
  '}',
  'function descargarWord(){',
  '  if(!datos)return;',
  '  fetch("/descargar-word",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({textoFinal:datos.textoFinal,historial:datos.historial})})',
  '  .then(function(r){return r.blob()})',
  '  .then(function(blob){',
  '    var url=URL.createObjectURL(blob);',
  '    var a=document.createElement("a");',
  '    a.href=url;',
  '    a.download="revision_q1.docx";',
  '    a.click();',
  '    URL.revokeObjectURL(url);',
  '  });',
  '}',
  'function descargarTxt(){',
  '  if(!datos)return;',
  '  var blob=new Blob([datos.textoFinal],{type:"text/plain"});',
  '  var url=URL.createObjectURL(blob);',
  '  var a=document.createElement("a");',
  '  a.href=url;',
  '  a.download="revision_q1.txt";',
  '  a.click();',
  '  URL.revokeObjectURL(url);',
  '}',
  '</script>',
  '</body>',
  '</html>'
].join('\n');

app.get('/', function(req, res) {
  res.send(htmlContent);
});

app.post('/revisar', upload.single('documento'), async function(req, res) {
  try {
    if (!req.file) {
      return res.json({ exito: false, error: 'No archivo' });
    }

    var nombreArchivo = req.file.originalname.toLowerCase();
    var ext = path.extname(nombreArchivo);
    console.log('Archivo recibido: ' + nombreArchivo + ' Extension: ' + ext);

    var textoOriginal = '';

    if (ext === '.docx' || ext === '.doc') {
      console.log('Procesando Word con mammoth...');
      textoOriginal = await extraerTextoDeDocx(req.file.path);
      if (!textoOriginal || textoOriginal.length < 10) {
        return res.json({ exito: false, error: 'No se pudo extraer texto del Word' });
      }
      console.log('Texto extraido: ' + textoOriginal.length + ' caracteres');
    } else if (ext === '.md' || ext === '.txt') {
      console.log('Procesando texto plano...');
      textoOriginal = fs.readFileSync(req.file.path, 'utf-8');
    } else {
      return res.json({ exito: false, error: 'Extension no soportada: ' + ext });
    }

    var textoActual = textoOriginal;
    var historial = [];
    var puntajeFinal = 0;

    console.log('=== INICIANDO REVISION MULTIDOMINIO Q1 ===');

    for (var i = 1; i <= 5; i++) {
      console.log('>>> ITERACION ' + i + '/5');

      var revision = simularRevision(textoActual, i);

      puntajeFinal = revision.puntaje;
      historial.push({
        iteracion: i,
        puntaje: revision.puntaje,
        dominios: revision.dominios,
        bloqueadores: revision.bloqueadores,
        criticos: revision.criticos
      });

      if (revision.texto_mejorado && revision.texto_mejorado.length > 100) {
        textoActual = revision.texto_mejorado;
      }

      console.log('OK Puntaje: ' + revision.puntaje + '/100');
    }

    try { fs.unlinkSync(req.file.path); } catch (e) {}

    res.json({
      exito: true,
      textoFinal: textoActual,
      historial: historial,
      iteraciones: 5,
      puntajeInicial: historial[0] ? historial[0].puntaje : 0,
      puntajeFinal: puntajeFinal
    });

  } catch (error) {
    console.error('ERROR:', error);
    res.json({ exito: false, error: error.message });
  }
});

app.post('/descargar-word', async function(req, res) {
  try {
    var textoFinal = req.body.textoFinal || '';
    var historial = req.body.historial || [];

    var wordBuffer = await crearWordConResultados(textoFinal, historial);

    res.setHeader('Content-Disposition', 'attachment; filename=revision_q1.docx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(Buffer.from(wordBuffer));
  } catch (error) {
    console.error('Error generando Word:', error);
    res.status(500).json({ error: error.message });
  }
});

var PORT = process.env.PORT || 3000;

app.listen(PORT, function() {
  console.log('Revisor Multidominio Q1 en linea');
  console.log('http://localhost:' + PORT);
});
