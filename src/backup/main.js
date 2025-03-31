import plugin from "../plugin.json";
const toast = acode.require("toast");

class GrokCopilot {
 constructor() {
  this.editor = editorManager.editor;
  this.currentCode = "";
  this.lastSuggestion = "";
  this.typingTimer = undefined;
  this.typingDelay = 1000;
  this.isRunning = false;
  this.isPremium = false; // Controle de versão premium
 }

 async start() {
  if (!this.editor) throw new Error("Editor não encontrado!");
  this.isRunning = true;
  this.editor.on("change", () => this.handleInput());
  this.addAcceptSuggestionCommand();
  toast(`✨ Grok Copilot iniciado (Grátis)`, 3000);
 }

 stop() {
  this.isRunning = false;
  this.editor.off("change", () => this.handleInput());
  this.clearSuggestion();
  clearTimeout(this.typingTimer);
 }

 getAceLines() {
  const editorContainer = document.querySelector('.ace_editor');
  if (!editorContainer) return [];
  return editorContainer.querySelectorAll('.ace_scroller .ace_layer.ace_text-layer .ace_line');
 }

 refreshAceLines() {
  this.aceLines = this.getAceLines();
 }

 // Sugestão básica offline (exemplo simples)
 getBasicSuggestion(code) {
  if (code.includes("function")) {
   return " // Adicione um return aqui";
  }
  return " // Continue digitando...";
 }

 addSuggestionToAceLine(aceLineIdx, code) {
  this.clearSuggestion();
  this.refreshAceLines();
  const line = this.aceLines[aceLineIdx];
  if (!line) return;

  const suggestionContainer = document.createElement("pre");
  suggestionContainer.className = "ace-suggestion";
  suggestionContainer.textContent = code;
  suggestionContainer.style.cssText = `
            color: gray; font-style: italic; opacity: 0.7; display: inline;`;
  line.appendChild(suggestionContainer);
 }

 clearSuggestion() {
  const suggestions = document.querySelectorAll(".ace-suggestion");
  suggestions.forEach((s) => s.remove());
 }

 handleInput() {
  if (!this.isRunning) return;
  this.refreshAceLines();
  const newCode = this.editor.getValue();
  if (newCode !== this.currentCode) {
   this.currentCode = newCode;
   clearTimeout(this.typingTimer);
   this.typingTimer = setTimeout(() => {
    const lastIdx = this.aceLines.length - 1;
    if (this.isPremium) {
     // Lógica da API aqui (desativada por enquanto)
     toast("API Premium em breve! Doe para ativar.", 3000);
    } else {
     const suggestion = this.getBasicSuggestion(newCode);
     this.lastSuggestion = suggestion;
     this.addSuggestionToAceLine(lastIdx, suggestion);
     toast("Versão grátis ativa. Doe em ko-fi.com/seuusuario!", 5000);
    }
   }, this.typingDelay);
  }
 }
 // Adicione um return aqui
 addAcceptSuggestionCommand() {
  const { commands } = this.editor;
  commands.addCommand({
   name: "acceptGrokSuggestion",
   bindKey: { win: "Ctrl-Shift-R", mac: "Command-Shift-." },
   exec: () => {
    if (!this.lastSuggestion) {
     toast("Nenhuma sugestão disponível", 2000);
     return;
    }
    const cursorPosition = this.editor.getCursorPosition();
    const currentLine = this.editor.session.getLine(cursorPosition.row);
    this.editor.session.insert(
     { row: cursorPosition.row, column: currentLine.length },
     this.lastSuggestion
    );
    this.clearSuggestion();
    this.lastSuggestion = "";
    toast("Sugestão aceita!", 2000);
   }
  });
 }
}

class AcodePlugin {
 constructor() {
  this.grokCopilot = null;
 }

 async init(baseUrl) {
  if (editorManager.editor) {
   await this.checkAndLoadGrok();
   this.setupCommands();
   return;
  }
  const observer = new MutationObserver(() => this.checkAndLoadGrok(observer));
  observer.observe(document.body, { childList: true, subtree: true });
 }

 async checkAndLoadGrok(observer) {
  if (editorManager.editor && !this.grokCopilot) {
   this.grokCopilot = new GrokCopilot();
   await this.grokCopilot.start();
   observer?.disconnect();
  }
 }

 setupCommands() {
  window.acode.registerCommand("toggleGrokCopilot", async () => {
   if (this.grokCopilot.isRunning) {
    this.grokCopilot.stop();
    toast("Grok Copilot desativado", 3000);
   } else {
    await this.grokCopilot.start();
    toast("Grok Copilot ativado", 3000);
   }
  });
 }

 async destroy() {
  if (this.grokCopilot) {
   this.grokCopilot.stop();
   this.grokCopilot = null;
  }
 }
}

if (window.acode) {
 const acodePlugin = new AcodePlugin();
 acode.setPluginInit(plugin.id, (baseUrl) => acodePlugin.init(baseUrl));
 acode.setPluginUnmount(plugin.id, () => acodePlugin.destroy());
}