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
  this.logs = []; // Armazenar todos os logs
  this.originalXHR = XMLHttpRequest.prototype.open;
  this.originalFetch = window.fetch.bind(window);
  this.originalWebSocket = window.WebSocket;

  this.createLoggerViewer();
  this.enhanceAccessibility();
  this.interceptNetworkRequests();

  // Filtros iniciais
  this.setupFilter();


  // Adicione estas propriedades
  this.tooltip = null;
  this.currentTooltipLine = null;
  this.tooltipVisible = false;
  this.tooltipHideTimeout = null;

  // Crie o tooltip no construtor
  this.createTooltip();
 }

 // UI tooltip
 createTooltip() {
  this.tooltip = document.createElement('div');
  Object.assign(this.tooltip.style, {
   position: 'absolute',
   zIndex: '9999',
   backgroundColor: 'var(--secondary-color)',
   color: '#fff',
   padding: '8px',
   borderRadius: '4px',
   boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
   maxWidth: '400px',
   fontSize: '12px',
   fontFamily: 'monospace',
   pointerEvents: 'none',
   // display: 'none',
   whiteSpace: 'pre-wrap',
   border: '1px solid var(--border-color)'
  });
  this.tooltip.className = 'acode-console-tooltip';
  document.body.appendChild(this.tooltip);

  // Adicione eventos para fechar o tooltip

 }

 // UI Logger Viewer
 createLoggerViewer() {
  this.loggerView = document.createElement("div");
  Object.assign(this.loggerView.style, {
    position: "fixed",
    bottom: "-390px",
    right: "10px",
    width: "calc(100% - 20px)",
    maxWidth: "800px",
    height: "350px",
    background: "var(--primary-color)",
    color: "var(--text-color)",
    fontFamily: "monospace",
    fontSize: "12px",
    borderRadius: "8px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
    overflow: "hidden",
    zIndex: "1000",
    transition: "bottom 0.3s ease-in-out",
    border: "1px solid var(--border-color)",
    display: "flex",
    flexDirection: "column"
  });
  this.loggerView.className = "acode-console";

  const header = document.createElement("div");
  Object.assign(header.style, {
    background: "var(--secondary-color)",
    padding: "8px 12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "grab",
    userSelect: "none",
    fontSize: "12px",
    fontWeight: "bold",
    borderBottom: "1px solid var(--border-color)"
  });
  header.innerHTML = `<span>Network Logs</span>`;

  const closeButton = document.createElement("button");
  closeButton.textContent = "×";
  Object.assign(closeButton.style, {
    background: "transparent",
    color: "var(--text-color)",
    border: "none",
    fontSize: "18px",
    cursor: "pointer",
    width: "28px",
    height: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "4px",
    transition: "background 0.2s"
  });
  closeButton.addEventListener("mouseover", () => {
    closeButton.style.background = "rgba(255, 255, 255, 0.1)";
  });
  closeButton.addEventListener("mouseout", () => {
    closeButton.style.background = "transparent";
  });
  closeButton.addEventListener("click", () => this.closeLoggerViewer());

  const clearButton = document.createElement("button");
  clearButton.textContent = "Clear";
  Object.assign(clearButton.style, {
    background: "var(--accent-color)",
    color: "#fff",
    border: "none",
    padding: "6px 12px",
    borderRadius: "4px",
    cursor: "pointer",
    marginRight: "8px",
    fontSize: "12px",
    transition: "opacity 0.2s"
  });
  clearButton.addEventListener("mouseover", () => {
    clearButton.style.opacity = "0.8";
  });
  clearButton.addEventListener("mouseout", () => {
    clearButton.style.opacity = "1";
  });
  clearButton.addEventListener("click", () => this.clearLoggerViewer());

  const buttonGroup = document.createElement("div");
  buttonGroup.style.display = "flex";
  buttonGroup.style.alignItems = "center";
  buttonGroup.style.gap = "8px";
  buttonGroup.appendChild(clearButton);
  buttonGroup.appendChild(closeButton);

  header.appendChild(buttonGroup);
  this.loggerView.appendChild(header);

  // Criando o logContainer
  this.logContainer = document.createElement("div");
  Object.assign(this.logContainer.style, {
    padding: "0",
    overflowY: "auto",
    height: "100%",
    backgroundColor: "var(--primary-color)",
    flex: "1",
    scrollBehavior: "smooth"
  });
  
  // Adicionando scrollbar personalizada
  const scrollbarStyle = document.createElement("style");
  scrollbarStyle.textContent = `
    .acode-console::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    .acode-console::-webkit-scrollbar-thumb {
      background-color: var(--scrollbar-thumb);
      border-radius: 4px;
    }
    .acode-console::-webkit-scrollbar-track {
      background-color: var(--scrollbar-track);
    }
  `;
  document.head.appendChild(scrollbarStyle);

  this.loggerView.appendChild(this.logContainer);

  document.body.appendChild(this.loggerView);
  this.makeDraggable(this.loggerView, header);
}

 /**
  * description
  *
  */
 async init(baseUrl) {
  this.editor.renderer.on("scroll", () => {
   const scrollTop = this.editor.session.getScrollTop();
   const scrollLeft = this.editor.session.getScrollLeft();
   console.log(`Rolagem detectada - Vertical: ${scrollTop}, Horizontal: ${scrollLeft}`);
  });

  try {
   const { commands } = editorManager.editor;

   commands.addCommand({
    name: "logger-view",
    bindKey: { win: "Alt-l", mac: "Command-Shift-l" },
    exec: () => this.toggleLoggerViewer(),
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

 /**
 * description
 *
 */
 getAceLines() {
  const editorContainer = document.querySelector('.ace_editor');
  if (!editorContainer) return [];
  return editorContainer.querySelectorAll('.ace_scroller .ace_layer.ace_text-layer .ace_line');
 }

 /**
  * description
  *
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

 /**
  * description
  *
  */
 analyzeCode() {
  try {
   this.clearLogs();
   const code = this.editor.getValue();
   if (!code) return;

   const lines = code.split(/\r?\n/);
   let logs = [];
   let logLines = [];

   const logTypes = ['log', 'error', 'warn', 'info', 'debug'];
   lines.forEach((line, idx) => {
    logTypes.forEach(type => {
     if (line.includes(`console.${type}`)) {
      logLines.push({ lineIdx: idx, type, code: line.trim() });
     }
    });
   });

   if (logLines.length === 0) return;

   const originalConsole = {};
   logTypes.forEach(type => {
    originalConsole[type] = console[type];
    console[type] = (...args) => logs.push({ type, output: this.formatLogOutput(args), lineIdx: logLines[logs.length]?.lineIdx });
   });

   const wrappedFunction = new Function(code);
   wrappedFunction();

   logTypes.forEach(type => console[type] = originalConsole[type]);

   this.logs = logs; // Armazena os logs com lineIdx

   logLines.forEach((logLine, i) => {
    if (logs[i]) this.addOutput(logLine.lineIdx, logs[i].output, logs[i].type);
   });
  } catch (e) {
   this.addOutput(0, `Erro: ${e.message}`, 'error');
  }
 }

 /**
  * description
  *
  */
 // addOutput(aceLineIdx, code, type = 'log') {
 //  this.refreshAceLines();
 //  const line = this.aceLines[aceLineIdx];
 //  if (!line) return;

 //  const existingOutput = line.querySelector(".console-output");
 //  if (existingOutput) existingOutput.remove();

 //  const consoleOutput = document.createElement("pre");
 //  consoleOutput.className = `console-output console-${type}`;
 //  consoleOutput.textContent = `${code}`;
 //  consoleOutput.style.cssText = `font-style: normal; display: inline; margin-left: 5px;`;
 //  line.appendChild(consoleOutput);

 //  this.addGutterMarker(aceLineIdx);

 //  consoleOutput.addEventListener('click', () => {
 //   this.editor.gotoLine(aceLineIdx + 1);
 //   this.editor.focus();
 //  });
 // }
 
 addOutput(aceLineIdx, code, type = 'log') {
  const marker = this.session.addDynamicMarker({
    update: (html, markerLayer, session, config) => {
      const screenPos = markerLayer.$getTop(aceLineIdx, config);
      const leftPos = markerLayer.$padding + this.renderer.gutterWidth + 5;
      html.push(
        `<pre class="console-output console-${type}" style="position: absolute; top: ${screenPos}px; left: ${leftPos}px; font-style: normal; margin-left: 5px;">${code}</pre>`
      );
    },
    type: "text",
    inFront: true
  });

  this.addGutterMarker(aceLineIdx);
}

 /**
  * description
  *
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
  * description
  *
  */
 removeGutterMarker(lineIdx) {
  const session = this.editor.session;
  session.removeGutterDecoration(lineIdx, "console-log-marker");
 }

 /**
  * description
  *
  */
 showTooltipForLine(lineIdx) {
  const logOutput = this.getLogOutputForLine(lineIdx);
  if (logOutput) {
   this.tooltip.textContent = logOutput;
   this.positionTooltip(lineIdx);
   this.tooltip.style.display = 'block';
   this.currentTooltipLine = lineIdx;

   clearTimeout(this.tooltipHideTimeout);
   this.tooltipHideTimeout = setTimeout(() => {
    this.hideTooltip();
   }, 5000);
  }
 }

 /**
  * description
  *
  */
 getLogOutputForLine(lineIdx) {
  const log = this.logs.find(log => log.lineIdx === lineIdx);
  return log ? log.output : 'No log output available';
 }

 /**
  * description
  *
  */
 positionTooltip(lineIdx) {
  const renderer = this.editor.renderer;
  const config = renderer.layerConfig;
  const screenPos = renderer.$cursorLayer.getPixelPosition({ row: lineIdx, column: 0 }, true);

  const top = screenPos.top + config.offset;
  const left = screenPos.left + 20;

  this.tooltip.style.top = `${top}px`;
  this.tooltip.style.left = `${left}px`;
 }

 /**
  * description
  *
  */
 hideTooltip() {
  this.tooltip.style.display = 'none';
  this.currentTooltipLine = null;
 }

 /**
  * description
  *
  */
 addGutterMarkerStyle() {
  const styleId = "console-log-marker-style";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
.console-output.console-log { color: #aaa; }
.console-output.console-error { color: #ff5555; }
.console-output.console-warn { color: #ffaa55; }
.console-output.console-info { color: #55aaff; }
.console-output.console-debug { color: #aa55ff; }

.ace_gutter-cell.console-log-marker {
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="%23ffcc00"/></svg>');
  background-repeat: no-repeat;
  background-position: center;
  color: transparent !important;
}
  `;
  document.head.appendChild(style);

  this.editor.renderer.$gutter.addEventListener("click", (event) => {
   const target = event.target;
   if (target.classList.contains("ace_gutter-cell") && target.classList.contains("console-log-marker")) {
    const row = parseInt(target.getAttribute('aria-rowindex'), 10) - 1;
    this.showTooltipForLine(row);
   }
  });
 }

 /**
  * description
  *
  */
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

 /**
  * description
  *
  */
 formatValue(value) {
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value;
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  return value;
 }

 /**
  * description
  *
  */
 formatObject(obj) {
  const entries = Object.entries(obj);
  if (entries.length === 0) return '{}';

  const formatted = entries.map(([key, value]) => {
   return `${key}: ${this.formatValue(value)}`;
  });

  return `{ ${formatted.join(', ')} }`;
 }

 /**
  * description
  *
  */
 refreshAceLines() {
  this.aceLines = this.getAceLines();
 }

 /**
  * description
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
  * description
  *
  */
 debounce(func, wait) {
  let timeout;
  return (...args) => {
   clearTimeout(timeout);
   timeout = setTimeout(() => func.apply(this, args), wait);
  };
 }

 /**
  *  Metodos do loggerView
  * Network Logging
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

 /**
  * description
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
  * description
  *
  */
 toggleLoggerViewer() {
  if (!this.loggerView) {
   console.error("loggerView não está definido.");
   return;
  }
  if (this.loggerView.style.bottom === "-390px" || !this.loggerVisible) {
   this.loggerView.style.bottom = "0";
   this.loggerView.style.top = "auto";
   this.loggerVisible = true;
   this.loggerView.setAttribute('aria-hidden', 'false');
   if (!this.networkIntercepted) {
    this.interceptNetworkRequests();
    this.networkIntercepted = true;
   }
  } else {
   this.closeLoggerViewer();
  }
 }

 /**
  * description
  *
  */
 closeLoggerViewer() {
  if (!this.loggerView) {
   console.error("loggerView não está definido.");
   return;
  }
  this.loggerView.style.bottom = "-390px"; // Volta para a posição inicial
  this.loggerView.style.top = "auto";     // Remove a posição top
  this.loggerVisible = false;
  this.loggerView.setAttribute('aria-hidden', 'true');
 }

 /**
  * description
  *
  */
 clearLoggerViewer() {
  if (!this.logContainer) {
   console.error("logContainer não está definido.");
   return;
  }
  while (this.logContainer.firstChild) {
   this.logContainer.firstChild.remove();
  }
 }

 /**
  * description
  *
  */
 interceptNetworkRequests() {
  const acodePlugin = this;
  const MAX_LOG_LENGTH = 1000;
  const MAX_LOGS = 100;
  const startTime = Date.now();

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {

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

 /**
  * description
  *
  */
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

 /**
  * description
  *
  */
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

 /**
  * description
  *
  */
 applyFilters(logData) {
  if (!this.filters.length) return true;
  return this.filters.every(filter => filter(logData));
 }

 /**
  * description
  *
  */
 addFilter(filterFn) {
  this.filters.push(filterFn);
 }

 /**
  * description
  *
  */
 enhanceAccessibility() {
  this.loggerView.setAttribute('role', 'log');
  this.loggerView.setAttribute('aria-live', 'polite');
  this.loggerView.setAttribute('aria-label', 'Network logs console');
 }

 /**
  * description
  *
  */
 makeDraggable(element, handle) {
  let pos2 = 0, pos4 = 0;
  let isDragging = false;

  const dragMouseDown = (e) => {
   e.preventDefault();
   pos4 = e.clientY;
   isDragging = true;
   document.onmousemove = elementDrag;
   document.onmouseup = closeDragElement;
  };

  const elementDrag = (e) => {
   if (!isDragging) return;
   e.preventDefault();
   pos2 = pos4 - e.clientY;
   pos4 = e.clientY;

   // Calcula a nova posição vertical
   const newTop = element.offsetTop - pos2;
   // Limita o movimento ao eixo vertical
   element.style.top = newTop + "px";
   element.style.bottom = "auto";
   // Mantém a posição horizontal fixa
   element.style.left = "0px";
   element.style.right = "auto";
  };

  const closeDragElement = () => {
   if (!isDragging) return;
   isDragging = false;
   document.onmousemove = null;
   document.onmouseup = null;
  };

  handle.onmousedown = dragMouseDown;

  handle.ontouchstart = (e) => {
   const touch = e.touches[0];
   pos4 = touch.clientY;
   isDragging = true;

   document.ontouchmove = (e) => {
    const touchMove = e.touches[0];
    pos2 = pos4 - touchMove.clientY;
    pos4 = touchMove.clientY;

    const newTop = element.offsetTop - pos2;
    element.style.top = newTop + "px";
    element.style.bottom = "auto";
    element.style.left = "0px";
    element.style.right = "auto";
   };

   document.ontouchend = () => {
    isDragging = false;
    document.ontouchmove = null;
    document.ontouchend = null;
   };
  };

  this.dragCleanup = () => {
   handle.onmousedown = null;
   handle.ontouchstart = null;
   document.onmousemove = null;
   document.onmouseup = null;
   document.ontouchmove = null;
   document.ontouchend = null;
  };
 }

 /**
  * description
  *
  */
 setupFilter() {

  // Filtrar por URL (ex.: localhost/__cdvfile_temporary__) evitar que logs como este apareçam
  this.addFilter((logData) => {
   if (typeof logData === "string") {
    return !logData.includes("https://localhost/__cdvfile_temporary__");
   }
   return !(logData.url && logData.url.includes("https://localhost/__cdvfile_temporary__"));
  });


 }

 /**
  * description
  *
  */
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

/**
 * description
 *
 */
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