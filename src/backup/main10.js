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
      border-top: 2px solid #444;
      display: none;
      resize: both; /* Permitir redimensionamento */
      overflow: auto;
    `;

    // Adicionar loggerView ao corpo do documento
    document.body.appendChild(this.loggerView);

    // Intercept network requests
    this.interceptNetworkRequests() ;
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
   * Adiciona a saída do console a uma linha específica do editor.
   * @param {number} aceLineIdx - Índice da linha no editor Ace.
   * @param {string} code - Código a ser exibido como saída.
   */
  addOutput(aceLineIdx, code) {
    this.refreshAceLines();
    const line = this.aceLines[aceLineIdx];
    if (!line) return;

    const consoleOutput = document.createElement("pre");
    consoleOutput.className = "console-output";
    consoleOutput.textContent = `${code}`;
    consoleOutput.style.cssText = `color: #888; font-style: normal; opacity: 0.8; display: inline; margin-left: 5px;`;
    line.appendChild(consoleOutput);
  }

  /**
   * Limpa todos os logs do console.
   */
  clearLogs() {
    const outputs = document.querySelectorAll(".console-output");
    outputs.forEach((o) => o.remove());
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
        logLines.push(idx);
      }
    });

    // Redireciona o console.log para capturar a saída
    const originalConsoleLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));

    try {
      // Executa o código em um escopo isolado
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
   * Adiciona uma mensagem ao loggerView.
   * @param {string} message - Mensagem a ser adicionada.
   */
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

  /**
   * Inicializa o plugin.
   * @param {string} baseUrl - URL base do plugin.
   */
    /** Inicializa o plugin */
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

  /**
   * Intercepta as requisições de rede e loga os detalhes.
   */
  /**
 * Intercepta as requisições de rede e loga os detalhes.
 */
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

  /** Intercepta requisições de rede */
  interceptNetworkRequests() {
    const acodePlugin = this;

    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      this.addEventListener("load", () => {
        let payload = "";
        if (this.responseType === "" || this.responseType === "text") {
          payload = `Response: ${this.responseText}`;
        } else {
          payload = `ResponseType: ${this.responseType}`;
        }
        const message = `XHR ${method} ${url} - Status: ${this.status}`;
        acodePlugin.addToLogger(`${message}\n${payload}`);
      });
      acodePlugin.originalXHR.apply(this, [method, url, ...args]);
    };

    window.fetch = async (url, options = {}) => {
      const response = await acodePlugin.originalFetch(url, options);
      const clonedResponse = response.clone();
      const method = options.method || "GET";
      const message = `Fetch ${method} ${url} - Status: ${response.status}`;
      const payload = `Request: ${JSON.stringify(options)}, Response: ${await clonedResponse.text()}`;
      acodePlugin.addToLogger(`${message}\n${payload}`);
      return response;
    };
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