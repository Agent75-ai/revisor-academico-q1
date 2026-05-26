require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Revisor Q1</title>
<style>
body { font-family: Arial; margin: 20px; }
h1 { color: #667eea; }
input { padding: 8px; }
button { padding: 8px 16px; background: #667eea; color: white; border: none; cursor: pointer; }
textarea { width: 100%; height: 300px; margin-top: 20px; }
</style>
</head>
<body>
<h1>Revisor Academico Q1</h1>
<p>Safety Management - HRO - Risk Governance</p>
<input type="file" id="f">
<button onclick="s()">Revisar</button>
<textarea id="o" readonly></textarea>
<script>
async function s(){
var file=document.getElementById('f').files[0];
if(!file){alert('Selecciona un archivo');return;}
var form=new FormData();
form.append('documento',file);
try{
var r=await fetch('/revisar',{method:'POST',body:form});
var d=await r.json();
if(d.exito){
document.getElementById('o').value='PUNTAJE: '+d.puntaje+'/100\\nITERACIONES: '+d.iteraciones+'\\n\\n'+d.textoFinal;
}else{
alert('Error: '+d.error);
}
}catch(e){
alert('Error: '+e);
}
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
      return res.status(400).json({ error: 'No se envio documento' });
    }

    const ext = path.extname(req.file.path).toLowerCase();
    let texto = '';

    if (ext === '.docx') {
      try {
        texto = execSync(`pandoc "${req.file.path}" -t plain`, 
          { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
        );
      } catch {
        return res.status(400).json({ error: 'Error convertiendo DOCX' });
      }
    } else if (ext === '.md' || ext === '.txt') {
      texto = fs.readFileSync(req.file.path, 'utf-8');
    } else {
      return res.status(400).json({ error: 'Formato no soportado' });
    }

    const resultado = simularRevision(texto);

    res.json({
      exito: true,
      textoFinal: resultado.textoFinal,
      iteraciones: resultado.iteraciones,
      puntaje: resultado.puntaje,
    });

    try { fs.unlinkSync(req.file.path); } catch {}
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function simularRevision(texto) {
  return {
    textoFinal: texto,
    iteraciones: 2,
    puntaje: 82
  };
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('Revisor Academico Q1 en linea');
  console.log('http://localhost:' + PORT);
});
