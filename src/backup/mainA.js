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
      width: 70%;
      max-width: 600px;
      height: 350px;
      background: var(--primary-color);
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

 async init(baseUrl) {
  const { commands } = editorManager.editor;

  commands.addCommand({
   name: "logger-view",
   bindKey: { win: "Alt-l", mac: "Command-Shift-l" },
   exec: () => this.toggleLoggerView(),
  });

  this.isRunning = true;
  toast("Acode Console iniciado!");
  // Garantir que o evento change esteja registrado corretamente
  this.editor.session.on("change", () => this.handleInput());
  this.initMutationObserver();
  this.analyzeCode();
 }

 getAceLines() {
  const editorContainer = document.querySelector('.ace_editor');
  if (!editorContainer) return [];
  return editorContainer.querySelectorAll('.ace_scroller .ace_layer.ace_text-layer .ace_line');
 }

 clearLogs() {
  const outputs = document.querySelectorAll(".ace_outupts-console");
  outputs.forEach((o) => o.remove());

  // Remove todos os markers do gutter
  const session = this.editor.session;
  for (let i = 0; i < session.getLength(); i++) {
   this.removeGutterMarker(i);
  }
 }

 analyzeCode() {
  this.clearLogs();
  const code = this.editor.getValue();
  //const lines = code.split("\n");
  let logLines = new Map();
  
 


  
  
  

  // Identificar linhas com console
  const logPattern = /console\.(log|warn|error|info)\s*\([^)]*\)/;
  lines.forEach((line, idx) => {
   if (logPattern.test(line)) {
    logLines.set(idx, []);
   }
  });

  // Interceptar métodos do console
  const consoleMethods = ['log', 'warn', 'error', 'info'];
  const originalConsole = {};

  consoleMethods.forEach(method => {
   originalConsole[method] = console[method];
   console[method] = (...args) => {
    
    const stack = new Error().stack;
    let lineNumber = this.extractLineNumber(stack);
    if (lineNumber !== null && logLines.has(lineNumber)) {
     logLines.get(lineNumber).push(this.formatLogOutput(args));
    }
    originalConsole[method](...args);
   };
  });

  try {
   // Executar o código passando o console modificado
   (async () => {
    const wrappedFunction = new Function(
     "console",
     `
          ${code}
          return Promise.resolve();
        `
    );
    await wrappedFunction(console); // Passa o console atual
   })();
  } catch (e) {
   console.error(`Erro ao executar código: ${e.message}`);
  } finally {
   // Restaurar console original
   consoleMethods.forEach(method => {
    console[method] = originalConsole[method];
   });
  }

  // Adicionar logs ao editor usando markers
  logLines.forEach((logs, lineIdx) => {
   logs.forEach(log => {
    this.addOutput(lineIdx, log);
   });
  });
 }

 extractLineNumber(stack) {
  const stackLines = stack.split('\n');
  for (const line of stackLines) {
   // Suporte a diferentes formatos de stack trace
   const match = line.match(/:(\d+):\d+$/) || line.match(/<anonymous>:(\d+):\d+/);
   if (match) {
    return parseInt(match[1]) - 1; // Ajusta para índice baseado em 0
   }
  }
  return null;
 }

 addOutput(aceLineIdx, code) {
  const session = this.editor.session;

  // Remover marcadores existentes na linha para evitar duplicação
  const existingMarkers = session.getMarkers();
  Object.keys(existingMarkers).forEach(markerId => {
   const marker = existingMarkers[markerId];
   if (marker.range.start.row === aceLineIdx && marker.clazz === "ace_output_marker") {
    session.removeMarker(markerId);
   }
  });

  // Adicionar novo marcador com o log
  const marker = session.addMarker(
   new ace.Range(aceLineIdx, 0, aceLineIdx, Infinity),
   "ace_output_marker",
   (html, range, left, top, config) => {
    const formattedCode = code.length > 30 ? `${code.substring(0, 27)}...` : code;
    html.push(
     `<span style="color: #93d1f4; margin-left: 15px; background: rgba(0, 0, 0, 0.3); padding: 2px 8px; border-radius: 4px;" title="${code}">${formattedCode}</span>`
    );
   },
   true // Renderizar no foreground
  );

  this.addGutterMarker(aceLineIdx);
 }

 handleInput() {
  if (!this.isRunning) return;
  const newCode = this.editor.getValue();
  
  if (newCode !== this.currentCode) {
   this.currentCode = newCode;
   clearTimeout(this.typingTimer);
   this.typingTimer = setTimeout(() => {
    this.analyzeCode();
   }, 500);
  }
 }

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

 removeGutterMarker(lineIdx) {
  const session = this.editor.session;
  session.removeGutterDecoration(lineIdx, "console-log-marker");
 }

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
.ace_output_marker {
position: absolute;
}
    `;
  document.head.appendChild(style);
 }

 truncateOutput(text, maxLength = 50) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
 }

 formatLogOutput(args) {
  const formattedArgs = args.map(arg => {
   if (Array.isArray(arg)) {
    return this.formatArray(arg);
   } else if (arg instanceof Map) {
    return this.formatMap(arg);
   } else if (arg instanceof Set) {
    return this.formatSet(arg);
   } else if (typeof arg === 'object' && arg !== null) {
    return this.formatObject(arg);
   }
   return this.formatValue(arg);
  });
  return formattedArgs.join(' ');
 }

 formatArray(arr) {
  if (arr.length > 3) {
   return `Array(${arr.length}) [${arr.slice(0, 3).map(item => this.formatValue(item)).join(', ')}, ...]`;
  }
  return `[${arr.map(item => this.formatValue(item)).join(', ')}]`;
 }

 formatMap(map) {
  const entries = [];
  for (const [key, value] of map.entries()) {
   entries.push(`${this.formatValue(key)} => ${this.formatValue(value)}`);
  }
  return `Map(${map.size}) {${entries.join(', ')}}`;
 }

 formatSet(set) {
  const values = [];
  for (const value of set.values()) {
   values.push(this.formatValue(value));
  }
  return `Set(${set.size}) {${values.join(', ')}}`;
 }

 formatObject(obj) {
  if (obj === null) return 'null';

  const constructorName = obj.constructor?.name || 'Object';
  if (constructorName !== 'Object') {
   return `${constructorName} ${JSON.stringify(obj, null, 2)}`;
  }

  const entries = Object.entries(obj);
  if (entries.length === 0) return '{}';

  const formatted = entries.map(([key, value]) => {
   return `${key}: ${this.formatValue(value)}`;
  });

  return `{ ${formatted.join(', ')} }`;
 }

 formatValue(value) {
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value;
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  return value;
 }

 refreshAceLines() {
  this.aceLines = this.getAceLines();
 }

 clearLoggerView() {
  while (this.logContainer.firstChild) {
   this.logContainer.firstChild.remove();
  }
 }
 
 initMutationObserver() {
  const editorElement = document.querySelector('.ace_editor');
  if (!editorElement) return;
  this.observer = new MutationObserver(() => {
   clearTimeout(this.typingTimer);
   this.typingTimer = setTimeout(() => this.analyzeCode(), 300);
  });
  this.observer.observe(editorElement, { childList: true, subtree: true });
 }

 debounce(func, wait) {
  let timeout;
  return (...args) => {
   clearTimeout(timeout);
   timeout = setTimeout(() => func.apply(this, args), wait);
  };
 }

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

   interceptNetworkRequests() {
  const acodePlugin = this;
  const MAX_LOGS = 10; // Limite de logs para evitar sobrecarga

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
 
   addToLogger(message) {
  const logEntry = document.createElement("div");
  logEntry.style.cssText = `
   padding: 8px;
   border-bottom: 1px solid #444;
   margin-bottom: 5px;
   background: #2a2a2a;
   border-radius: 2px;
   font-size: 10px;
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
   font-size: 10px;
   `;

   // Method (color-coded)
   const methodSpan = document.createElement("span");
   methodSpan.textContent = method;
   methodSpan.style.cssText = `
   font-weight: bold;
   margin-right: 8px;
   font-size: 10px;
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
   font-size: 10px;
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

    // Add basic syntax highlighting
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
 
   highlightJson(jsonString) {
  return jsonString
   .replace(/(".*?"):/g, '<span style="color: #55aaff">$1</span>:')
   .replace(/: (".*?")/g, ': <span style="color: #ffaa55">$1</span>')
   .replace(/: (\d+\.?\d*)/g, ': <span style="color: #55ff55">$1</span>')
   .replace(/: (true|false)/g, ': <span style="color: #ff5555">$1</span>')
   .replace(/: (null)/g, ': <span style="color: #aaa">$1</span>');
 }

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