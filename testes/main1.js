import plugin from '../plugin.json';
import style from "./style.scss";
const acorn = require('acorn');

// Importa o módulo fsOperation do Acode
const fs = acode.require("fsOperation");
const editor = editorManager.editor;

class AcodePlugin {
	constructor() {
		this.editor = editorManager.editor;
		this.logs = [];
		this.isEditorReady = false; // Flag para verificar se o editor está pronto
	}

	/**
	 * Inicializa o plugin.
	 * Sobrescreve o console, cria a UI de logs e configura listeners.
	 */
	async init() {
		console.log("[DEBUG] Plugin inicializado.");
		this.overrideConsole();
		this.createConsoleUI();

		// Aguarda o editor estar pronto antes de analisar o arquivo
		editorManager.on("ready", () => {
			this.isEditorReady = true;
			this.analyzeActiveFile();
		});

		// Configura o debounce para evitar chamadas excessivas
		const debouncedAnalyze = this.debounce(async () => {
			if (this.isEditorReady) {
				await this.analyzeActiveFile();
			}
		}, 300);

		editorManager.on("change", debouncedAnalyze);
		editor.on("blur", this.hideConsoleUI.bind(this));
		editor.on("focus", this.hideConsoleUI.bind(this));

		// Adiciona o comando para abrir a UI de logs
		editorManager.editor.commands.addCommand({
			name: "Acode Ninja",
			description: "Depurar Console",
			bindKey: {
				win: "Ctrl-Shift-9",
			},
			exec: () => this.showConsoleUI(),
		});
	}

	/**
	 * Sobrescreve os métodos do console para capturar logs.
	 */
	overrideConsole() {
		console.log("[DEBUG] Sobrescrevendo console.log...");
		const originalLog = console.log;
		const originalError = console.error;
		const originalWarn = console.warn;

		console.log = (...args) => {
			this.logs.push(`[LOG] ${args.join(" ")}`);
			originalLog.apply(console, args);
			this.updateConsoleUI();
		};

		console.error = (...args) => {
			this.logs.push(`[ERRO] ${args.join(" ")}`);
			originalError.apply(console, args);
			this.updateConsoleUI();
		};

		console.warn = (...args) => {
			this.logs.push(`[AVISO] ${args.join(" ")}`);
			originalWarn.apply(console, args);
			this.updateConsoleUI();
		};
	}

	/**
	 * Cria a interface de usuário para exibir os logs.
	 */
	createConsoleUI() {
		console.log("[DEBUG] Criando painel de logs...");
		this.consoleElement = document.createElement('div');
		this.consoleElement.classList.add('acode-ninja-console');

		this.clearButton = document.createElement('button');
		this.clearButton.textContent = 'Limpar Logs';
		this.clearButton.classList.add('acode-ninja-clear-button');
		this.clearButton.onclick = () => {
			console.log("[DEBUG] Limpando logs...");
			this.logs = [];
			this.updateConsoleUI();
		};

		this.toggleButton = document.createElement('button');
		this.toggleButton.textContent = 'Ocultar Logs';
		this.toggleButton.classList.add('acode-ninja-toggle-button');
		this.toggleButton.onclick = () => {
			const isHidden = this.consoleElement.style.display === 'none';
			this.consoleElement.style.display = isHidden ? 'block' : 'none';
			this.toggleButton.textContent = isHidden ? 'Ocultar Logs' : 'Mostrar Logs';
		};

		document.body.appendChild(this.consoleElement);
		this.consoleElement.appendChild(this.clearButton);
		this.consoleElement.appendChild(this.toggleButton);
	}

	/**
	 * Atualiza a interface de usuário com os logs capturados.
	 */
	updateConsoleUI() {
		if (this.consoleElement) {
			this.consoleElement.innerHTML = this.logs.map(log => `
				<div class="acode-ninja-log ${log.startsWith('[ERRO]') ? 'error' : log.startsWith('[AVISO]') ? 'warning' : 'log'}">
					${log}
				</div>
			`).join('');
			this.consoleElement.prepend(this.clearButton);
			this.consoleElement.prepend(this.toggleButton);
			this.consoleElement.scrollTop = this.consoleElement.scrollHeight;
		}
	}

	/**
	 * Exibe a interface de usuário de logs.
	 */
	showConsoleUI() {
		if (this.consoleElement) {
			this.consoleElement.style.display = 'block';
			this.toggleButton.textContent = 'Ocultar Logs';
		}
	}

	/**
	 * Oculta a interface de usuário de logs.
	 */
	hideConsoleUI() {
		if (this.consoleElement) {
			this.consoleElement.style.display = 'none';
		}
	}

	/**
	 * Analisa o arquivo ativo no editor.
	 */
	async analyzeActiveFile() {
		const { activeFile } = editorManager;
		if (!activeFile || !activeFile.uri) {
			console.error('Nenhum arquivo ativo encontrado.');
			return;
		}

		try {
			const fileContent = await fs(activeFile.uri).readFile('utf-8');
			this.analyzeContent(fileContent);
		} catch (err) {
			console.error('Erro ao ler o arquivo:', err);
			this.logs.push(`[ERRO] Erro ao ler o arquivo: ${err.message}`);
			this.updateConsoleUI();
		}
	}

	/**
	 * Analisa o conteúdo do arquivo usando a biblioteca Acorn.
	 * @param {string} content - Conteúdo do arquivo.
	 */
	async analyzeContent(content) {
		try {
			const ast = acorn.parse(content, { ecmaVersion: 2020 });
			console.log("AST gerada:", ast);
		} catch (err) {
			console.error('Erro ao analisar o código:', err);
			this.logs.push(`[ERRO] Erro ao analisar o código: ${err.message}`);
			this.updateConsoleUI();
		}
	}

	/**
	 * Debounce para evitar chamadas excessivas.
	 * @param {Function} func - Função a ser chamada.
	 * @param {number} wait - Tempo de espera em milissegundos.
	 * @returns {Function} Função debounced.
	 */
	debounce(func, wait) {
		let timeout;
		return (...args) => {
			clearTimeout(timeout);
			timeout = setTimeout(() => func.apply(this, args), wait);
		};
	}

	/**
	 * Destroi o plugin, removendo listeners e a UI.
	 */
	async destroy() {
		console.log("[DEBUG] Destruindo plugin...");
		editorManager.off("change", this.debouncedAnalyze);
		editor.off("blur", this.hideConsoleUI);
		editor.off("focus", this.hideConsoleUI);

		if (this.consoleElement) {
			this.consoleElement.remove();
		}
	}
}

// Inicializa o plugin se o Acode estiver disponível
if (window.acode) {
	const acodePlugin = new AcodePlugin();

	acode.setPluginInit(plugin.id, (baseUrl, { cacheFileUrl, cacheFile }) => {
		console.log("[DEBUG] Inicializando plugin via Acode...");
		if (!baseUrl.endsWith('/')) {
			baseUrl += '/';
		}
		acodePlugin.baseUrl = baseUrl;
		acodePlugin.init(cacheFile, cacheFileUrl);
	});

	acode.setPluginUnmount(plugin.id, () => {
		console.log("[DEBUG] Desmontando plugin...");
		acodePlugin.destroy();
	});
}