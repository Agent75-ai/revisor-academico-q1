require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));
app.use(express.json());

// ===== RUTAS =====

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/status', (req, res) => {
  res.json({ 
    status: '✓ Servidor activo',
    timestamp: new Date().toISOString()
  });
});

app.post('/revisar', upload.single('documento'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió documento' });
    }

    const ext = path.extname(req.file.path).toLowerCase();
    let texto = '';

    if (ext === '.docx') {
      try {
        texto = execSync(`pandoc "${req.file.path}" -t plain`, 
          { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
        );
      } catch {
        return res.status(400).json({ error: 'Error convertiendo DOCX. Pandoc no disponible.' });
      }
    } else if (ext === '.md' || ext === '.txt') {
      texto = fs.readFileSync(req.file.path, 'utf-8');
    } else {
      return res.status(400).json({ error: 'Formato no soportado' });
    }

    console.log(`📄 Revisando: ${req.file.originalname} (${texto.length} caracteres)`);

    const resultado = simularRevision(texto);

    res.json({
      exito: true,
      textoFinal: resultado.textoFinal,
      historial: resultado.historial,
