require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

const html = '<!DOCTYPE html><html><head><meta charset=UTF-8><title>Revisor Q1</title><style>body{font-family:Arial;margin:20px}h1{color:#667eea}input{padding:8px}button{padding:8px 16px;background:#667eea;color:white;border:none;cursor:pointer}textarea{width:100%;height:300px;margin-top:20px}</style></head><body><h1>Revisor Academico Q1</h1><p>Safety Management</p><input type=file id=f><button onclick=s()>Revisar</button><textarea id=o readonly></textarea><script>async function s(){var file=document.getElementById(\"f\").files[0];if(!file){alert(\"Selecciona un archivo\");return;}var form=new FormData();form.append(\"documento\",file);try{var r=await fetch(\"/revisar\",{method:\"POST\",body:form});var d=await r.json();if(d.exito){document.getElementById(\"o\").value=\"PUNTAJE: \"+d.puntaje+\"/100\\nITERACIONES: \"+d.iteraciones+\"\\n\\n\"+d.textoFinal;}else{alert(\"Error: \"+d.error);}}catch(e){alert(\"Error: \"+e);}}</script></body></html>';

app.get('/', (req, res) => {
  res.send(html);
});

app.post('/revisar', upload.single('documento'), (req, res) => {
  try {
    if (!req.file) {
      return res.json({ exito: false, error: 'No archivo' });
    }

    const ext = path.extname(req.file.path).toLowerCase();
    let texto = '';

    if (ext === '.md' || ext === '.txt') {
      texto = fs.readFileSync(req.file.path, 'utf-8');
    } else {
      return res.json({ exito: false, error: 'Solo .md o .txt' });
    }

    try { fs.unlinkSync(req.file.path); } catch {}

    res.json({
      exito: true,
      textoFinal: texto,
      iteraciones: 1,
      puntaje: 80
    });
  } catch (error) {
    res.json({ exito: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Revisor en linea: http://localhost:' + PORT);
});
