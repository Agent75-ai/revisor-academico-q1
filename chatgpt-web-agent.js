const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class ChatGPTWebAgent {
  constructor() {
    this.browser = null;
    this.page = null;
    this.context = null;
  }

  async iniciar() {
    console.log('🔄 Iniciando navegador...');
    this.browser = await chromium.launch({ 
      headless: false
    });
    
    this.context = await this.browser.newContext({
      storageState: 'auth.json'
    });
    this.page = await this.context.newPage();
    
    if (fs.existsSync('auth.json')) {
      console.log('✓ Sesión previa cargada');
    } else {
      await this.autenticarse();
    }
  }

  async autenticarse() {
    console.log('🔐 Autenticando en ChatGPT...');
    await this.page.goto('https://chat.openai.com', { waitUntil: 'networkidle' });
    
    console.log('⏳ Esperando login manual... (máx 60 segundos)');
    try {
      await this.page.waitForNavigation({ timeout: 60000 });
      await this.context.storageState({ path: 'auth.json' });
      console.log('✓ Autenticación completada');
    } catch {
      console.log('⚠️ Timeout en login. Continuar de todos modos...');
    }
  }

  async enviarMensaje(texto) {
    try {
      await this.page.goto('https://chat.openai.com');
      
      const textarea = await this.page.waitForSelector('textarea', { timeout: 10000 });
      
      await textarea.click();
      await textarea.fill(texto);
      
      await textarea.press('Enter');
      
      console.log('⏳ ChatGPT escribiendo...');
      await this.page.waitForTimeout(2000);
      
      try {
        await this.page.waitForSelector('[data-testid="stop-button"]', { 
          state: 'hidden', 
          timeout: 120000 
        });
      } catch {
        console.log('⚠️ Timeout esperando respuesta');
      }
      
      const respuesta = await this.extraerUltimaRespuesta();
      return respuesta;
    } catch (error) {
      console.error('Error enviando mensaje:', error.message);
      throw error;
    }
  }

  async extraerUltimaRespuesta() {
    try {
      const messages = await this.page.locator('[data-testid="conversation-turn"]').last().innerText();
      return messages;
    } catch {
      return 'Error extrayendo respuesta';
    }
  }

  async cerrar() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = ChatGPTWebAgent;
