import plugin from "../plugin.json";
const toast = acode.require("toast");

class AcodeConsole {
  constructor() {
    this.editor = editorManager.editor;
    this.isRunning = false;
    this.currentCode = "";
    this.typingTimer = null;
    this.aceLines = [];
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
    consoleOutput.textContent = ` ${code}`; // Sem o "//" extra, como no Console Ninja
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
    const lines = code.split("\n");
    let logs = [];
    let logLines = []; // Para rastrear quais linhas têm console.log com //?

    // Identificar linhas com console.log e //?
    lines.forEach((line, idx) => {
      if (line.includes("console.log") && line.includes("//?")) {
        logLines.push(idx);
      }
    });

    // Redirecionar console.log
    const originalConsoleLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));

    try {
      eval(code);
    } catch (e) {
      logs.push(`Erro: ${e.message}`);
    }
    console.log = originalConsoleLog;

    // Adicionar logs apenas às linhas marcadas com //?
    logLines.forEach((lineIdx) => {
      if (logs.length > 0) {
        const log = logs.shift(); // Pega o próximo log da fila
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
      }, 500); // Aguarda 500ms após parar de digitar
    }
  }

  async init(baseUrl) {
    this.isRunning = true;
    toast("Acode Console iniciado!");
    this.editor.session.on("change", () => this.handleInput());
    this.analyzeCode();
  }

  async destroy() {
    this.isRunning = false;
    this.clearLogs();
    toast("Acode Console desativado!");
  }
}

if (window.acode) {
  const consolePlugin = new AcodeConsole();
  acode.setPluginInit(plugin.id, (baseUrl) => consolePlugin.init(baseUrl));
  acode.setPluginUnmount(plugin.id, () => consolePlugin.destroy());
}