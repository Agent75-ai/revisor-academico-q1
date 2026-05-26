require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { Document, Packer, Paragraph } = require('docx');
const mammoth = require('mammoth');

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

async function extraerTextoDeDocx(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (err) {
    console.log('Error extrayendo DOCX:', err.message);
    return '';
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
