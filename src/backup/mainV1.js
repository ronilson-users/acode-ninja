import plugin from "../plugin.json";
const toast = acode.require("toast");


class AcodeConsole {
 constructor() {
  this.editor = editorManager.editor;
  this.isRunning = false;
  this.currentCode = "";
  this.typingTimer = null;
  this.aceLines = [];
  this.observer = null;
  this.networkIntercepted = false;
  this.loggerVisible = false;
  this.filters = [];
  this.originalXHR = XMLHttpRequest.prototype.open;
  this.originalFetch = window.fetch.bind(window);
  this.originalWebSocket = window.WebSocket; 
  this.createLoggerView();
  this.enhanceAccessibility();
  this.interceptNetworkRequests();
 }

 /**
 * Cria a interface do logger
 */
 
 createLoggerView() {
  // Elemento principal
  this.loggerView = document.createElement("div");
  Object.assign(this.loggerView.style, {
   position: "fixed",
   bottom: "-360px",
   right: "20px",
   width: "70%",
   maxWidth: "600px",
   height: "350px",
   background: "var(--primary-color)",
   color: "#fff",
   fontFamily: "monospace",
   fontSize: "14px",
   borderRadius: "8px",
   boxShadow: "0 2px 10px rgba(0, 0, 0, 0.5)",
   resize: "both",
   overflow: "hidden",
   zIndex: "999",
   transition: "bottom 0.3s ease-in-out"
  });
  this.loggerView.className = "acode-console";

  // Header
  const header = document.createElement("div");
  Object.assign(header.style, {
   background: "#333",
   padding: "8px",
   display: "flex",
   justifyContent: "space-between",
   alignItems: "center",
   cursor: "grab",
   userSelect: "none"
  });
  header.innerHTML = `<span>Network Logs</span>`;

  // Botão de fechar
  const closeButton = document.createElement("button");
  closeButton.textContent = "×";
  Object.assign(closeButton.style, {
   background: "transparent",
   color: "#fff",
   border: "none",
   fontSize: "16px",
   cursor: "pointer",
   width: "24px",
   height: "24px",
   display: "flex",
   alignItems: "center",
   justifyContent: "center"
  });
  closeButton.addEventListener("click", () => this.closeLoggerView());

  // Botão de limpar
  const clearButton = document.createElement("button");
  clearButton.textContent = "Clear";
  Object.assign(clearButton.style, {
   background: "#ff5555",
   color: "#fff",
   border: "none",
   padding: "4px 8px",
   borderRadius: "4px",
   cursor: "pointer",
   marginLeft: "8px"
  });
  clearButton.addEventListener("click", () => this.clearLogs());

  const buttonGroup = document.createElement("div");
  buttonGroup.style.display = "flex";
  buttonGroup.appendChild(clearButton);
  buttonGroup.appendChild(closeButton);

  header.appendChild(buttonGroup);
  this.loggerView.appendChild(header);

  // Container de logs
  this.logContainer = document.createElement("div");
  Object.assign(this.logContainer.style, {
   padding: "8px",
   overflowY: "auto",
   height: "calc(100% - 40px)",
   backgroundColor: "#1a1a1a"
  });
  this.loggerView.appendChild(this.logContainer);

  document.body.appendChild(this.loggerView);
  this.makeDraggable(this.loggerView, header); // Chama a função implementada
 }

 async init(baseUrl) {
  try {
   const { commands } = editorManager.editor;

   commands.addCommand({
    name: "logger-view",
    bindKey: { win: "Alt-l", mac: "Command-Shift-l" },
    exec: () => this.toggleLoggerView(),
   });

   this.isRunning = true;
   toast("Acode Console iniciado!");
   
   this.editor.session.on("change", this.debounce(() => this.handleInput(), 300));
   this.initMutationObserver();
   this.interceptWebSockets();
   this.analyzeCode();
  } catch (error) {
   console.error("Erro na inicialização:", error);
   toast("Erro ao iniciar Acode Console");
  }
 }
 
 getAceLines() {
  const editorContainer = document.querySelector('.ace_editor');
  if (!editorContainer) return [];
  return editorContainer.querySelectorAll('.ace_scroller .ace_layer.ace_text-layer .ace_line');
 }

 clearLogs() {
  const outputs = document.querySelectorAll(".console-output");
  outputs.forEach((o) => o.remove());

  // Remove todos os markers do gutter
  const session = this.editor.session;
  for (let i = 0; i < session.getLength(); i++) {
   this.removeGutterMarker(i);
  }
 }



 analyzeCode() {
  try {
   this.clearLogs();
   const code = this.editor.getValue();
   if (!code) return;

   const lines = code.split(/\r?\n/);
   let logs = [];
   let logLines = [];

   lines.forEach((line, idx) => {
    if (line.includes("console.log")) {
     logLines.push({
      lineIdx: idx,
      code: line.trim()
     });
    }
   });

   const originalConsoleLog = console.log;
   console.log = (...args) => {
    logs.push(this.formatLogOutput(args));
   };

   const wrappedFunction = new Function(code);
   wrappedFunction();
   console.log = originalConsoleLog;

   logLines.forEach((logLine, i) => {
    if (logs[i] !== undefined) {
     this.addOutput(logLine.lineIdx, logs[i]);
    }
   });
  } catch (e) {
   this.addOutput(0, `Erro: ${e.message}`);
  }
 }

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
 
 refreshAceLines() {
  this.aceLines = this.getAceLines();
 } 
 
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
 
 debounce(func, wait) {
  let timeout;
  return (...args) => {
   clearTimeout(timeout);
   timeout = setTimeout(() => func.apply(this, args), wait);
  };
 }
 
 /**
  *  Metodos do loggerView
  */
   
  highlightJson(jsonString) {
  if (!jsonString) return '';

  return jsonString
   .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, (match) => {
    let cls = 'color: #aaa;'; // default
    if (/^"/.test(match)) {
     if (/:$/.test(match)) {
      cls = 'color: #55aaff;'; // chaves
     } else {
      cls = 'color: #ffaa55;'; // valores string
     }
    } else if (/true|false/.test(match)) {
     cls = 'color: #ff5555;'; // booleanos
    } else if (/null/.test(match)) {
     cls = 'color: #aaa;'; // null
    } else {
     cls = 'color: #55ff55;'; // números
    }
    return `<span style="${cls}">${match}</span>`;
   });
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
   
  toggleLoggerView() {
  if (this.loggerView.style.bottom === "-360px" || !this.loggerVisible) {
   this.loggerView.style.bottom = "20px";
   this.loggerVisible = true;
   this.loggerView.setAttribute('aria-hidden', 'false');

   if (!this.networkIntercepted) {
    this.interceptNetworkRequests();
    this.networkIntercepted = true;
   }
  } else {
   this.closeLoggerView();
  }
 }
   
  closeLoggerView() {
  if (this.loggerView) {
   this.loggerView.style.bottom = "-360px"; // Esconde o logger
   this.loggerVisible = false;
   this.loggerView.setAttribute('aria-hidden', 'true');
  }
 }
    
  clearLoggerView() {
  if (this.logContainer) {
   while (this.logContainer.firstChild) {
    this.logContainer.firstChild.remove();
   }
  }
 }
   
  interceptNetworkRequests() {
  const acodePlugin = this;
  const MAX_LOG_LENGTH = 1000;
  const MAX_LOGS = 100;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
   const startTime = Date.now();
   this.addEventListener("load", () => {
    const duration = Date.now() - startTime;
    let payload = "";
    try {
     payload = this.responseType === "json" ?
      `Response: ${JSON.stringify(this.response, null, 2).slice(0, MAX_LOG_LENGTH)}` :
      `Response: ${(this.responseText || '').slice(0, MAX_LOG_LENGTH)}`;
    } catch (e) {
     payload = `Erro ao processar resposta: ${e.message}`;
    }

   const message = `XHR ${method} ${url} - Status: ${this.status} - Duration: ${duration}ms`;
   
    acodePlugin.addToLogger(`${message}\n${payload}`);
   }, { once: true });

   acodePlugin.originalXHR.apply(this, [method, url, ...rest]);
  };

  window.fetch = async (url, options = {}) => {
   const startTime = Date.now();
   try {
    const response = await acodePlugin.originalFetch(url, options);
    const clonedResponse = response.clone();
    const method = options.method || "GET";
    const contentType = response.headers.get("Content-Type") || "unknown";
    let payload = "";

    try {
     if (contentType.includes("application/json")) {
      payload = `Response: ${JSON.stringify(await clonedResponse.json(), null, 2).slice(0, MAX_LOG_LENGTH)}`;
     } else {
      payload = `Response: ${(await clonedResponse.text()).slice(0, MAX_LOG_LENGTH)}`;
     }
    } catch (e) {
     payload = `Erro ao processar resposta: ${e.message}`;
    }

    const message = `Fetch ${method} ${url} - Status: ${response.status}`;
    acodePlugin.addToLogger(`${message}\n${payload}`);
    return response;
   } catch (e) {
    acodePlugin.addToLogger(`Fetch falhou: ${url} - ${e.message}`);
    throw e;
   }
  };
 }
   
  interceptWebSockets() {
  window.WebSocket = class extends this.originalWebSocket {
   constructor(url, protocols) {
    super(url, protocols);
    this.addEventListener('open', () => {
     acodePlugin.addToLogger({
      type: 'WEBSOCKET',
      event: 'OPEN',
      url,
      timestamp: new Date().toISOString()
     });
    });

    this.addEventListener('message', (event) => {
     acodePlugin.addToLogger({
      type: 'WEBSOCKET',
      direction: 'INCOMING',
      url,
      data: event.data,
      timestamp: new Date().toISOString()
     });
    });

    this.addEventListener('close', (event) => {
     acodePlugin.addToLogger({
      type: 'WEBSOCKET',
      event: 'CLOSE',
      url,
      code: event.code,
      reason: event.reason,
      timestamp: new Date().toISOString()
     });
    });

    this.addEventListener('error', () => {
     acodePlugin.addToLogger({
      type: 'WEBSOCKET',
      event: 'ERROR',
      url,
      error: 'WebSocket error',
      timestamp: new Date().toISOString()
     });
    });
   }

   send(data) {
    acodePlugin.addToLogger({
     type: 'WEBSOCKET',
     direction: 'OUTGOING',
     url: this.url,
     data,
     timestamp: new Date().toISOString()
    });
    super.send(data);
   }
  };
 }
   
  addToLogger(message) {
  if (!this.logContainer) {
   console.error("logContainer não está definido.");
   return;
  }

  const logEntry = document.createElement("div");
  logEntry.style.cssText = `
padding: 8px;
border-bottom: 1px solid #444;
margin-bottom: 5px;
background: #2a2a2a;
border-radius: 2px;
background: var(--primary-color);
    transition: background 0.2s;
`;

  const [header, ...responseLines] = message.split("\n");
  const responseText = responseLines.join("\n").replace("Response: ", "");

  const headerMatch = header.match(/(Fetch|XHR|WEBSOCKET)\s(\w+)\s(.+)\s-\sStatus:\s(\d+)/);
  if (headerMatch) {
   const [, type, method, url, status] = headerMatch;

   const headerDiv = document.createElement("div");
   headerDiv.style.cssText = `

 display: flex;
      align-items: center;
      cursor: pointer;
      padding: 4px 0;
      gap: 8px;
      flex-wrap: wrap;



`;

   const methodSpan = document.createElement("span");
   methodSpan.textContent = method;
   methodSpan.style.cssText = `
font-weight: bold;
margin-right: 8px;
color: ${method === "GET" ? "#55ff55" :
     method === "POST" ? "#55aaff" :
      method === "PUT" ? "#ffaa55" :
       method === "DELETE" ? "#ff5555" :
        method === "PATCH" ? "#aa55ff" :
         method === "WEBSOCKET" ? "#aa00ff" : "#fff"};
`;
   headerDiv.appendChild(methodSpan);

   const urlSpan = document.createElement("span");
   urlSpan.textContent = url;
   urlSpan.style.cssText = `
      flex: 1;
      color: var(--text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 100px;
`;
   headerDiv.appendChild(urlSpan);

   const statusSpan = document.createElement("span");
   statusSpan.textContent = status;
   statusSpan.style.cssText = `
margin-left: 8px;
font-weight: bold;
color: ${status.toString().startsWith("2") ? "#55ff55" :
     (status.toString().startsWith("4") || status.toString().startsWith("5")) ? "#ff5555" : "#fff"};
`;
   headerDiv.appendChild(statusSpan);

   logEntry.appendChild(headerDiv);

   const responseDiv = document.createElement("div");
   responseDiv.style.cssText = `
display: none;
      padding: 8px;
      background: var(--secondary-color);
      border-radius: 4px;
      margin-top: 8px;
      white-space: pre-wrap;
      font-size: 11px;
      color: var(--text-color);
      max-height: 200px;
      overflow: auto;
`;

   try {
    const json = JSON.parse(responseText);
    const prettyJson = JSON.stringify(json, null, 2);
    responseDiv.innerHTML = this.highlightJson ? this.highlightJson(prettyJson) : prettyJson;
   } catch (e) {
    responseDiv.textContent = responseText || "No response data";
   }

   logEntry.appendChild(responseDiv);

   headerDiv.addEventListener("click", () => {
    responseDiv.style.display = responseDiv.style.display === "none" ? "block" : "none";
   });
  } else {
   // Tratamento para mensagens WebSocket ou não formatadas
   logEntry.textContent = message;
   try {
    const json = JSON.parse(message);
    const prettyJson = JSON.stringify(json, null, 2);
    logEntry.innerHTML = this.highlightJson ? this.highlightJson(prettyJson) : prettyJson;
   } catch (e) {
    logEntry.textContent = message;
   }
  }

  this.logContainer.appendChild(logEntry);

  const logs = this.logContainer.children;
  if (logs.length > 100) {
   logs[0].remove();
  }

  this.logContainer.scrollTop = this.logContainer.scrollHeight;
 }
   
  applyFilters(logData) {
  if (!this.filters.length) return true;
  return this.filters.every(filter => filter(logData));
 }
   
  addFilter(filterFn) {
  this.filters.push(filterFn);
 }
   
  enhanceAccessibility() {
  this.loggerView.setAttribute('role', 'log');
  this.loggerView.setAttribute('aria-live', 'polite');
  this.loggerView.setAttribute('aria-label', 'Network logs console');
 }
   
  makeDraggable(element, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  let isDragging = false;

  // Função para iniciar o arraste
  const dragMouseDown = (e) => {
   e.preventDefault();
   // Pega a posição inicial do mouse
   pos3 = e.clientX;
   pos4 = e.clientY;
   isDragging = true;

   document.onmousemove = elementDrag;
   document.onmouseup = closeDragElement;
  };

  // Função para mover o elemento
  const elementDrag = (e) => {
   if (!isDragging) return;

   e.preventDefault();
   // Calcula a nova posição do cursor
   pos1 = pos3 - e.clientX;
   pos2 = pos4 - e.clientY;
   pos3 = e.clientX;
   pos4 = e.clientY;

   // Define a nova posição do elemento
   element.style.top = (element.offsetTop - pos2) + "px";
   element.style.left = (element.offsetLeft - pos1) + "px";
   element.style.bottom = "auto"; // Remove a ancoragem inferior enquanto arrasta
   element.style.right = "auto"; // Remove a ancoragem à direita enquanto arrasta
  };

  // Função para finalizar o arraste
  const closeDragElement = () => {
   if (!isDragging) return;
   isDragging = false;
   document.onmousemove = null;
   document.onmouseup = null;
  };

  // Adiciona o evento de mousedown ao handle
  handle.onmousedown = dragMouseDown;

  // Adiciona suporte para toque (opcional, para dispositivos móveis)
  handle.ontouchstart = (e) => {
   const touch = e.touches[0];
   pos3 = touch.clientX;
   pos4 = touch.clientY;
   isDragging = true;

   document.ontouchmove = (e) => {
    const touchMove = e.touches[0];
    pos1 = pos3 - touchMove.clientX;
    pos2 = pos4 - touchMove.clientY;
    pos3 = touchMove.clientX;
    pos4 = touchMove.clientY;

    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
    element.style.bottom = "auto";
    element.style.right = "auto";
   };

   document.ontouchend = () => {
    isDragging = false;
    document.ontouchmove = null;
    document.ontouchend = null;
   };
  };

  // Armazena a função de limpeza para uso no destroy
  this.dragCleanup = () => {
   handle.onmousedown = null;
   handle.ontouchstart = null;
   document.onmousemove = null;
   document.onmouseup = null;
   document.ontouchmove = null;
   document.ontouchend = null;
  };
 }

 async destroy() {
  try {
   // Restaurar métodos originais
   if (this.originalXHR) {
    XMLHttpRequest.prototype.open = this.originalXHR;
   }

   if (this.originalFetch) {
    window.fetch = this.originalFetch;
   }

   if (this.originalWebSocket) {
    window.WebSocket = this.originalWebSocket;
   }

   // Remover UI
   if (this.loggerView && this.loggerView.parentNode) {
    this.loggerView.parentNode.removeChild(this.loggerView);
   }

   // Limpar listeners de arraste
   if (this.dragCleanup) {
    this.dragCleanup();
   }

   // Limpar estado
   this.isRunning = false;
   this.networkIntercepted = false;

   // Remover comando do editor
   if (this.editor && this.editor.commands) {
    this.editor.commands.removeCommand('logger-view');
   }

   toast("Acode Console desativado!");
  } catch (error) {
   console.error("Erro ao destruir plugin:", error);
   toast("Erro ao desativar Acode Console!");
  }
 }
}

if (window.acode) {
 const acodePlugin = new AcodeConsole();
 acode.setPluginInit(plugin.id, async (baseUrl, $page, { cacheFileUrl, cacheFile }) => {
  try {
   if (!baseUrl.endsWith('/')) {
    baseUrl += '/';
   }
   acodePlugin.baseUrl = baseUrl;
   await acodePlugin.init(baseUrl);
  } catch (error) {
   console.error('Erro na inicialização do plugin:', error);
   toast("Erro ao iniciar plugin");
  }
 });

 acode.setPluginUnmount(plugin.id, () => {
  acodePlugin.destroy();
 });
}