import plugin from "../plugin.json";
const toast = acode.require("toast");
const fs = acode.require("fs");
const diff_match_patch = require("./diff_match_patch").diff_match_patch;

class AcodeDiffPlugin {
  constructor() {
    this.editor = editorManager.editor;
    this.currentCode = "";
    this.diffFilePath = "changes.diff"; // Caminho para o arquivo .diff
  }

  async init(baseUrl) {
    // Obter conteúdo inicial do editor
    this.currentCode = this.editor.getValue();

    // Adicionar evento de salvamento
    this.editor.on("save", () => this.handleFileSave());
  }

  async handleFileSave() {
    const newCode = this.editor.getValue();
    const diff = this.computeDiff(this.currentCode, newCode);

    if (diff) {
      await this.saveDiff(diff);
    }

    // Atualizar o código atual
    this.currentCode = newCode;
  }

  computeDiff(oldCode, newCode) {
    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(oldCode, newCode);
    dmp.diff_cleanupSemantic(diffs);

    // Formatar o diff em um formato legível
    const diffText = dmp.patch_toText(dmp.patch_make(oldCode, diffs));
    return diffText;
  }

  async saveDiff(diff) {
    try {
      await fs.appendFile(this.diffFilePath, diff);
      toast("Diferenças salvas em " + this.diffFilePath);
    } catch (error) {
      console.error("Erro ao salvar diferenças:", error);
      toast("Erro ao salvar diferenças");
    }
  }

  async destroy() {
    // Limpar eventos
    this.editor.off("save", this.handleFileSave);
    toast("Plugin AcodeDiff desativado!");
  }
}

if (window.acode) {
  const acodePlugin = new AcodeDiffPlugin();
  acode.setPluginInit(plugin.id, (baseUrl) => acodePlugin.init(baseUrl));
  acode.setPluginUnmount(plugin.id, () => acodePlugin.destroy());
}