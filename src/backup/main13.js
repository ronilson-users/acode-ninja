import plugin from "../plugin.json";
const toast = acode.require("toast");
import style from './style.scss'
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
  this.networkIntercepted = false;
  this.originalXHR = XMLHttpRequest.prototype.open;
  this.originalFetch = window.fetch.bind(window);

  // Criar o loggerView
  this.loggerView = document.createElement("div");
  this.loggerView.className = "logger-view";
  this.loggerView.style.cssText = `
    position: fixed;
    top: 45px;
    right: 20px;
    width: 50%;
    max-width: 600px;
    height: 300px;
    background: #1e1e1e;
    color: #fff;
    font-family: monospace;
    font-size: 14px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
    display: none;
    resize: both;
    overflow: hidden;
    z-index: 999;
  `;

  // Add a header with a clear button
  const header = document.createElement("div");
  header.style.cssText = `
    background: #333;
    padding: 8px;
    border-bottom: 1px solid #444;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 1;
  `;
  header.innerHTML = `<span>Network Logs</span>`;

  const clearButton = document.createElement("button");
  clearButton.textContent = "Clear";
  clearButton.style.cssText = `
    background: #ff5555;
    color: #fff;
    border: none;
    padding: 4px ;
    border-radius: 2px;
    cursor: pointer;
  `;
  clearButton.addEventListener("click", () => this.clearLoggerView());
  header.appendChild(clearButton);

  this.loggerView.appendChild(header);

  // Add a container for the logs
  this.logContainer = document.createElement("div");
  this.logContainer.style.cssText = `
    padding: 10px;
    overflow-y: auto;
    height: calc(100% - 40px);
  `;
  this.loggerView.appendChild(this.logContainer);

  // Adicionar loggerView ao corpo do documento
  document.body.appendChild(this.loggerView);

  // Intercept network requests
  this.interceptNetworkRequests();
 }

 /**
 * Inicializa o plugin.
 * @param {string} baseUrl - URL base do plugin.
 */
 async init(baseUrl) {
  const { commands } = editorManager.editor;

  commands.addCommand({
   name: "logger-view",
   bindKey: { win: "Alt-l", mac: "Command-Shift-l" },
   exec: () => this.toggleLoggerView(),
  });

  this.isRunning = true;
  toast("Acode Console iniciado!");
  this.editor.session.on("change", () => this.handleInput());
  this.initMutationObserver();
  this.analyzeCode();
 }

 /**
  * Obtém as linhas do editor Ace.
  * @returns {NodeList} Lista de linhas do editor Ace.
  */
 getAceLines() {
  const editorContainer = document.querySelector('.ace_editor');
  if (!editorContainer) return [];
  return editorContainer.querySelectorAll('.ace_scroller .ace_layer.ace_text-layer .ace_line');
 }

 /**
  * Limpa todos os logs do console.
  */
 clearLogs() {
  const outputs = document.querySelectorAll(".console-output");
  outputs.forEach((o) => o.remove());

  // Remove todos os markers do gutter
  const session = this.editor.session;
  for (let i = 0; i < session.getLength(); i++) {
   this.removeGutterMarker(i);
  }
 }

 clearLoggerView() {
  while (this.logContainer.firstChild) {
   this.logContainer.firstChild.remove();
  }
 }

 /**
  * Analisa o código do editor e captura a saída do console.
  */
 analyzeCode() {
    this.clearLogs();
    const code = this.editor.getValue();
    const lines = code.split(/\r?\n/);
    let logs = [];
    let logLines = [];

    // Identifica todas as linhas que contêm 'console.log'
    lines.forEach((line, idx) => {
        if (line.includes("console.log")) {
            logLines.push({
                lineIdx: idx,
                code: line.trim()
            });
        }
    });

    // Redireciona o console.log para capturar a saída
    const originalConsoleLog = console.log;
    console.log = (...args) => {
        logs.push(this.formatLogOutput(args));
    };

    try {
        // Executa o código em um escopo isolado
        const wrappedFunction = new Function(code);
        wrappedFunction();
    } catch (e) {
        logs.push(`Erro: ${e.message}`);
    } finally {
        console.log = originalConsoleLog;
    }

    // Associa os logs às linhas identificadas
    logLines.forEach((logLine, i) => {
        if (logs[i] !== undefined) {
            this.addOutput(logLine.lineIdx, logs[i]);
        }
    });
}

 /**
  * Adiciona a saída do console a uma linha específica do editor.
  * @param {number} aceLineIdx - Índice da linha no editor Ace.
  * @param {string} code - Código a ser exibido como saída.
  */

 addOutput(aceLineIdx, code) {
  this.refreshAceLines();
  const line = this.aceLines[aceLineIdx];
  if (!line) return;

  // Remove qualquer output existente para esta linha
  const existingOutput = line.querySelector(".console-output");
  if (existingOutput) {
   existingOutput.remove();
  }

 const consoleOutput = document.createElement("pre");
    consoleOutput.className = "console-output";
    consoleOutput.textContent = `${code}`;
    consoleOutput.style.cssText = `color: #888; font-style: normal; opacity: 0.8; display: inline; margin-left: 5px;`;
  line.appendChild(consoleOutput);

  // Adiciona marker no gutter
  this.addGutterMarker(aceLineIdx);
 }

 /**
  * Adiciona um marker no gutter (área dos números de linha)
  * @param {number} lineIdx - Índice da linha
  */
 addGutterMarker(lineIdx) {
  const editor = this.editor;
  const session = editor.session;

  // Remove qualquer marker existente
  this.removeGutterMarker(lineIdx);

  // Adiciona o novo marker
  session.addGutterDecoration(lineIdx, "console-log-marker");

  // Adiciona estilo para o marker
  this.addGutterMarkerStyle();
 }

 /**
  * Remove o marker do gutter
  * @param {number} lineIdx - Índice da linha
  */
 removeGutterMarker(lineIdx) {
  const session = this.editor.session;
  session.removeGutterDecoration(lineIdx, "console-log-marker");
 }

 /**
  * Adiciona estilo para os markers no gutter
  */
 addGutterMarkerStyle() {
  const styleId = "console-log-marker-style";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
.ace_gutter-cell.console-log-marker {
background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="%23ffcc00"/></svg>');
background-repeat: no-repeat;
background-position: center;
color: transparent !important;
        }
    `;
  document.head.appendChild(style);
 }

formatLogOutput(args) {
    const formattedArgs = args.map(arg => {
        if (Array.isArray(arg)) {
            return `[${arg.map(item => this.formatValue(item)).join(', ')}]`;
        } else if (typeof arg === 'object' && arg !== null) {
            return this.formatObject(arg);
        }
        return this.formatValue(arg);
    });
    return formattedArgs.join(' ');
}

formatValue(value) {
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value;
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    return value;
}

formatObject(obj) {
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';
    
    const formatted = entries.map(([key, value]) => {
        return `${key}: ${this.formatValue(value)}`;
    });
    
    return `{ ${formatted.join(', ')} }`;
}

 highlightJson(jsonString) {
  return jsonString
   .replace(/(".*?"):/g, '<span style="color: #55aaff">$1</span>:')
   .replace(/: (".*?")/g, ': <span style="color: #ffaa55">$1</span>')
   .replace(/: (\d+\.?\d*)/g, ': <span style="color: #55ff55">$1</span>')
   .replace(/: (true|false)/g, ': <span style="color: #ff5555">$1</span>')
   .replace(/: (null)/g, ': <span style="color: #aaa">$1</span>');
 }

 /**
  * Atualiza as linhas do editor Ace.
  */
 refreshAceLines() {
  this.aceLines = this.getAceLines();
 }

 /**
  * Manipula a entrada do editor e analisa o código após um período de inatividade.
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
  * Inicializa o observador de mutação para monitorar mudanças no editor.
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
  * Função de debounce para evitar execuções repetidas.
  * @param {function} func - Função a ser debounced.
  * @param {number} wait - Tempo de espera em milissegundos.
  * @returns {function} Função debounced.
  */
 debounce(func, wait) {
  let timeout;
  return (...args) => {
   clearTimeout(timeout);
   timeout = setTimeout(() => func.apply(this, args), wait);
  };
 }

 /** Alterna exibição do loggerView */
 toggleLoggerView() {
  if (this.loggerView.style.display === "none") {
   this.loggerView.style.display = "block";
   if (!this.networkIntercepted) {
    this.interceptNetworkRequests();
    this.networkIntercepted = true;
   }
  } else {
   this.loggerView.style.display = "none";
  }
 }

 /**
   * Intercepta requisições de rede e loga os detalhes.
   */
 interceptNetworkRequests() {
  const acodePlugin = this;
  const MAX_LOGS = 100; // Limite de logs para evitar sobrecarga

  // Interceptação de XMLHttpRequest (this part is fine)
  XMLHttpRequest.prototype.open = function (...args) {
   const [method, url, ...rest] = args;

   this.addEventListener("load", () => {
    let payload = "";
    try {
     switch (this.responseType) {
      case "":
      case "text":
       payload = `Response: ${this.responseText.slice(0, 500)}`; // Limitar tamanho
       break;
      case "json":
       payload = `Response: ${JSON.stringify(this.response, null, 2).slice(0, 500)}`;
       break;
      case "blob":
       payload = `Response: [Blob, size: ${this.response.size}]`;
       break;
      case "arraybuffer":
       payload = `Response: [ArrayBuffer, byteLength: ${this.response.byteLength}]`;
       break;
      default:
       payload = `ResponseType: ${this.responseType}`;
     }
    } catch (e) {
     payload = `Erro ao processar resposta: ${e.message}`;
    }

    const message = `XHR ${method} ${url} - Status: ${this.status}`;
    acodePlugin.addToLogger(`${message}\n${payload}`);
   });

   // Chamar o método original
   acodePlugin.originalXHR.apply(this, args);
  };

  // Interceptação de fetch - Fixed version
  const originalFetch = window.fetch.bind(window); // Bind fetch to window to preserve context
  window.fetch = async function (url, options = {}) {
   let response;
   try {
    // Call the original fetch with the correct `this` context
    response = await originalFetch(url, options);
   } catch (e) {
    acodePlugin.addToLogger(`Fetch falhou: ${e.message}`);
    throw e; // Propagar o erro para o chamador
   }

   const clonedResponse = response.clone();
   const method = options.method || "GET";
   const contentType = response.headers.get("Content-Type") || "unknown";
   let payload = "";

   try {
    if (contentType.includes("application/json")) {
     const json = await clonedResponse.json();
     payload = `Response: ${JSON.stringify(json, null, 2).slice(0, 500)}`;
    } else if (contentType.includes("text")) {
     payload = `Response: ${await clonedResponse.text().slice(0, 500)}`;
    } else if (contentType.includes("blob") || contentType.includes("octet-stream")) {
     const blob = await clonedResponse.blob();
     payload = `Response: [Blob, size: ${blob.size}]`;
    } else {
     payload = `Response: [Content-Type: ${contentType}]`;
    }
   } catch (e) {
    payload = `Erro ao processar resposta: ${e.message}`;
   }

   const message = `Fetch ${method} ${url} - Status: ${response.status}`;
   acodePlugin.addToLogger(`${message}\n${payload}`);

   return response; // Retornar resposta original
  };
 }

 /**
 * Adiciona uma mensagem ao loggerView.
 * @param {string} message - Mensagem a ser adicionada.
 */
 addToLogger(message) {
  const logEntry = document.createElement("div");
  logEntry.style.cssText = `
    padding: 8px;
    border-bottom: 1px solid #444;
    margin-bottom: 5px;
    background: #2a2a2a;
    border-radius: 2px;
  `;

  // Parse the message (assuming it’s in the format: "Fetch GET https://... - Status: 200\nResponse: {...}")
  const [header, ...responseLines] = message.split("\n");
  const responseText = responseLines.join("\n").replace("Response: ", "");

  // Parse the header (e.g., "Fetch GET https://... - Status: 200")
  const headerMatch = header.match(/(Fetch|XHR)\s(\w+)\s(.+)\s-\sStatus:\s(\d+)/);
  if (headerMatch) {
   const [, type, method, url, status] = headerMatch;

   // Create the header section
   const headerDiv = document.createElement("div");
   headerDiv.style.cssText = `
      display: flex;
      align-items: center;
      cursor: pointer;
      padding: 4px 0;
    `;

   // Method (color-coded)
   const methodSpan = document.createElement("span");
   methodSpan.textContent = method;
   methodSpan.style.cssText = `
      font-weight: bold;
      margin-right: 8px;
      color: ${method === "GET" ? "#55ff55" :
     method === "POST" ? "#55aaff" :
      method === "PUT" ? "#ffaa55" :
       method === "DELETE" ? "#ff5555" : "#fff"
    };
    `;
   headerDiv.appendChild(methodSpan);

   // URL
   const urlSpan = document.createElement("span");
   urlSpan.textContent = url;
   urlSpan.style.cssText = `
      flex: 1;
      color: #aaa;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
   headerDiv.appendChild(urlSpan);

   // Status (color-coded)
   const statusSpan = document.createElement("span");
   statusSpan.textContent = status;
   statusSpan.style.cssText = `
      margin-left: 8px;
      font-weight: bold;
      color: ${status.startsWith("2") ? "#55ff55" :
     status.startsWith("4") || status.startsWith("5") ? "#ff5555" : "#fff"
    };
    `;
   headerDiv.appendChild(statusSpan);

   logEntry.appendChild(headerDiv);

   // Create the response section (collapsible)
   const responseDiv = document.createElement("div");
   responseDiv.style.cssText = `
      display: none;
      padding: 8px;
      background: #333;
      border-radius: 2px;
      margin-top: 4px;
      white-space: pre-wrap;
      font-size: 10px;
    `;

   // Try to parse and pretty-print JSON
   try {
    const json = JSON.parse(responseText);
    const prettyJson = JSON.stringify(json, null, 2);
    responseDiv.textContent = prettyJson;

    // Add basic syntax highlighting for JSON
    responseDiv.innerHTML = this.highlightJson(prettyJson);
   } catch (e) {
    responseDiv.textContent = responseText; // Fallback to raw text if not JSON
   }

   logEntry.appendChild(responseDiv);

   // Add click event to toggle the response
   headerDiv.addEventListener("click", () => {
    responseDiv.style.display = responseDiv.style.display === "none" ? "block" : "none";
   });
  } else {
   // Fallback for non-standard messages
   logEntry.textContent = message;
  }

  this.logContainer.appendChild(logEntry);

  // Limit the number of logs
  const logs = this.logContainer.children;
  if (logs.length > 100) {
   logs[0].remove();
  }

  this.logContainer.scrollTop = this.logContainer.scrollHeight;
 }

 /** Destroi o plugin */
 async destroy() {
  this.isRunning = false;
  this.clearLogs();
  if (this.loggerView) {
   this.loggerView.remove();
  }
  XMLHttpRequest.prototype.open = this.originalXHR; // Restaurar original
  window.fetch = this.originalFetch; // Restaurar original
  toast("Acode Console desativado!");
 }

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