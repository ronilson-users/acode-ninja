import plugin from "../plugin.json";
const toast = acode.require("toast");

 /**
 * Plugin Semelhante ao Console Ninja
 */
class AcodeConsole {
 
 constructor() {
  this.editor = editorManager.editor;
  this.isRunning = false;
  this.currentCode = "";
  this.typingTimer = null;
  this.aceLines = [];
  this.observer = null;

  // Criar o loggerView
  this.loggerView = document.createElement("div");
  this.loggerView.className = "logger-view";
  this.loggerView.style.cssText = `
      position: fixed;
      top: 45px;
      right: 20px;
      width: 50%;
      height: 250px;
      background: #222;
      color: #fff;
      font-size: 14px;
      padding: 10px;
      overflow-y: auto;
      border-top: 2px solid #444;
    `;

  // Adicionar loggerView ao corpo do documento
  document.body.appendChild(this.loggerView);
 }

/**
 * 
 */
 
 getAceLines() {
  const editorContainer = document.querySelector('.ace_editor');
  if (!editorContainer) return [];
  return editorContainer.querySelectorAll('.ace_scroller .ace_layer.ace_text-layer .ace_line');
 }
 /**
 * 
 */

 addOutput(aceLineIdx, code) {
  this.refreshAceLines();
  const line = this.aceLines[aceLineIdx];
  if (!line) return;

  const consoleOutput = document.createElement("pre");
  consoleOutput.className = "console-output";
  consoleOutput.textContent = ` ${code}`;
  consoleOutput.style.cssText = `
      color: #888; font-style: normal; opacity: 0.8; display: inline;
      margin-left: 5px;`;
  line.appendChild(consoleOutput);
 }
 /**
 * 
 */

 clearLogs() {
  const outputs = document.querySelectorAll(".console-output");
  outputs.forEach((o) => o.remove());
 }
 /**
 * 
 */

 analyzeCode() {
  this.clearLogs();
  const code = this.editor.getValue();
  // Utiliza expressão regular para abranger diferentes quebras de linha
  const lines = code.split(/\r?\n/);
  let logs = [];
  let logLines = [];

  // Identifica as linhas que contém 'console.log' com o marcador '//?'
  lines.forEach((line, idx) => {
   if (line.includes("console.log") && line.includes("//?")) {
    logLines.push(idx);
   }
  });

  // Redireciona o console.log para capturar a saída
  const originalConsoleLog = console.log;
  console.log = (...args) => logs.push(args.join(" "));

  try {
   // Executa o código em um escopo isolado, eliminando os riscos do eval direto
   const wrappedFunction = new Function(code);
   wrappedFunction();
  } catch (e) {
   logs.push(`Erro: ${e.message}`);
  }
  console.log = originalConsoleLog;

  // Associa os logs às linhas identificadas
  logLines.forEach((lineIdx) => {
   if (logs.length > 0) {
    const log = logs.shift();
    this.addOutput(lineIdx, log);
   }
  });
 }
 /**
 * 
 */

 refreshAceLines() {
    this.aceLines = this.getAceLines();
  }
  /**
 * 
 */

 handleInput() {
  if (!this.isRunning) return;
  this.refreshAceLines();
  const newCode = this.editor.getValue();
  if (newCode !== this.currentCode) {
   this.currentCode = newCode;
   clearTimeout(this.typingTimer);
   this.typingTimer = setTimeout(() => {
    this.analyzeCode();
   }, 500);
  }
 }
 /**
 * 
 */

 initMutationObserver() {
  const editorElement = document.querySelector('.ace_editor');
  if (!editorElement) return;
  this.observer = new MutationObserver(() => {
   clearTimeout(this.typingTimer);
   this.typingTimer = setTimeout(() => this.analyzeCode(), 300);
  });
  this.observer.observe(editorElement, { childList: true, subtree: true });
 }
 /**
 * 
 */
 
 
 // Network Logging create
 

 addToLogger(message) {
  const logEntry = document.createElement("div");
  logEntry.textContent = message;
  logEntry.style.padding = "5px";
  logEntry.style.borderBottom = "1px solid #444";
  this.loggerView.appendChild(logEntry);

  // Rolagem automática para a última entrada
  this.loggerView.scrollTop = this.loggerView.scrollHeight;
 }
 /**
 * 
 */

 async init(baseUrl) {
   const { commands } = editorManager.editor;

  commands.addCommand({
   name: "logger-view",
   bindKey: { win: "Alt-l", mac: "Command-Shift-l" },
   exec: () => {
  /**
   * O logger-view deve funcionar 
   
   */
   }
  });
  
  
  
  
  
  
  this.isRunning = true;
  toast("Acode Console iniciado!");
  this.editor.session.on("change", () => this.handleInput());
  this.initMutationObserver();
  this.analyzeCode();
 }
 /**
 * 
 */
 
 async destroy() {
  this.isRunning = false;
  this.clearLogs();
  if (this.loggerView) {
   this.loggerView.remove(); // Remover o loggerView ao destruir
  }
  toast("Acode Console desativado!");
 }
 /**
 * 
 */
}

// Integração com o Acode
if (window.acode) {
 const acodePlugin = new AcodeConsole();
 acode.setPluginInit(plugin.id, (baseUrl, $page, { cacheFileUrl, cacheFile }) => {
  try {
   if (!baseUrl.endsWith('/')) {
    baseUrl += '/';
   }
   acodePlugin.baseUrl = baseUrl;
   acodePlugin.init($page, cacheFile, cacheFileUrl);
  } catch (error) {
   console.error('Erro na inicialização do plugin:', error);
  }
 });

 acode.setPluginUnmount(plugin.id, () => {
  acodePlugin.destroy();
 });
}