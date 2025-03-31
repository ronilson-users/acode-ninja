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
  }

  getAceLines() {
    const editorContainer = document.querySelector('.ace_editor');
    if (!editorContainer) return [];
    return editorContainer.querySelectorAll('.ace_scroller .ace_layer.ace_text-layer .ace_line');
  }

 refreshAceLines() {
    this.aceLines = this.getAceLines();
  }


  addOutput(aceLineIdx, code) {
    this.refreshAceLines();
    const line = this.aceLines[aceLineIdx];
    if (!line) return;

    const consoleOutput = document.createElement("pre");
    consoleOutput.className = "console-output";
    consoleOutput.textContent = ` ${code}`;
    consoleOutput.style.cssText = `
      color: #888; font-style: normal; opacity: 0.8; display: inline; margin-left: 15px;`;
    line.appendChild(consoleOutput);
  }

  clearLogs() {
    const outputs = document.querySelectorAll(".console-output");
    outputs.forEach((o) => o.remove());
  }

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

  initMutationObserver() {
    const editorElement = document.querySelector('.ace_editor');
    if (!editorElement) return;
    this.observer = new MutationObserver(() => {
      clearTimeout(this.typingTimer);
      this.typingTimer = setTimeout(() => this.analyzeCode(), 300);
    });
    this.observer.observe(editorElement, { childList: true, subtree: true });
  }

  async init(baseUrl) {
    this.isRunning = true;
    toast("Acode Console iniciado!");
    this.editor.session.on("change", () => this.handleInput());
    this.initMutationObserver();
    this.analyzeCode();
  }

  async destroy() {
    this.isRunning = false;
    this.clearLogs();
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    toast("Acode Console desativado!");
  }
}

if (window.acode) {
  const consolePlugin = new AcodeConsole();
  acode.setPluginInit(plugin.id, (baseUrl) => consolePlugin.init(baseUrl));
  acode.setPluginUnmount(plugin.id, () => consolePlugin.destroy());
}