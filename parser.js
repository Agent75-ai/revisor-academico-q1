const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.docx') {
    try {
      const text = execSync(`pandoc "${filePath}" -t plain --wrap=none`, 
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
      );
      return cleanText(text);
    } catch (error) {
      console.error('Error extrayendo DOCX:', error.message);
      throw new Error('Pandoc no disponible. Instala: sudo apt-get install pandoc');
    }
  }
  
  if (ext === '.md' || ext === '.txt') {
    return fs.readFileSync(filePath, 'utf-8');
  }
  
  throw new Error(`Formato no soportado: ${ext}`);
}

function cleanText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n\n\n+/g, '\n\n')
    .trim();
}

function getMetadata(text) {
  const lineas = text.split('\n');
  const wordCount = text.split(/\s+/).length;
  const citationCount = (text.match(/\(\w+[,\s]\d{4}\)/g) || []).length;
  const headingCount = (text.match(/^#+\s/gm) || []).length;
  
  return {
    wordCo
