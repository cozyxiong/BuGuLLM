const path = require("path");
const fs = require("fs");
const LEGACY_MODEL_MAP = require("./legacy");

class ContextWindowFinder {
  static instance = null;
  static modelMap = LEGACY_MODEL_MAP;

  /**
   * Mapping for AnythingLLM provider <> LiteLLM provider
   * @type {Record<string, string>}
   */
  static trackedProviders = {
    anthropic: "anthropic",
    openai: "openai",
    cohere: "cohere_chat",
    gemini: "vertex_ai-language-models",
    groq: "groq",
    xai: "xai",
    deepseek: "deepseek",
    moonshot: "moonshot",
    zai: "vercel_ai_gateway", // Vercel has correct context windows for Z.AI models
    sambanova: "sambanova",
    minimax: "minimax",
    cerebras: "cerebras",
  };
  static remoteUrls = [
    "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json",
    "https://jsd.onmicrosoft.cn/gh/BerriAI/litellm@main/model_prices_and_context_window.json",
  ];
  static remoteUrl = ContextWindowFinder.remoteUrls[0];
  static fetchTimeoutMs = 12000;

  cacheLocation = path.resolve(
    process.env.STORAGE_DIR
      ? path.resolve(process.env.STORAGE_DIR, "models", "context-windows")
      : path.resolve(__dirname, `../../../storage/models/context-windows`)
  );
  cacheFilePath = path.resolve(this.cacheLocation, "context-windows.json");
  #refreshing = null;

  constructor() {
    if (ContextWindowFinder.instance) return ContextWindowFinder.instance;
    ContextWindowFinder.instance = this;
    if (!fs.existsSync(this.cacheLocation))
      fs.mkdirSync(this.cacheLocation, { recursive: true });
  }

  log(text, ...args) {
    if (process.env.NODE_ENV === "test") return;
    console.log(`\x1b[33m[ContextWindowFinder]\x1b[0m ${text}`, ...args);
  }

  /**
   * @returns {Record<string, Record<string, number>> | null}
   */
  get cachedModelMap() {
    if (!fs.existsSync(this.cacheFilePath)) return null;
    try {
      return JSON.parse(
        fs.readFileSync(this.cacheFilePath, { encoding: "utf8" })
      );
    } catch {
      return null;
    }
  }

  async #fetchRemoteJson() {
    let lastError = null;
    for (const url of ContextWindowFinder.remoteUrls) {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        ContextWindowFinder.fetchTimeoutMs
      );
      try {
        this.log(`Pulling remote model map from ${url}`);
        const response = await fetch(url, { signal: controller.signal });
        if (response.status !== 200) {
          throw new Error(`non 200 status code (${response.status})`);
        }
        const data = await response.json();
        if (!data || typeof data !== "object") {
          throw new Error("invalid JSON payload");
        }
        return data;
      } catch (error) {
        lastError = error;
        this.log(`Failed to pull model map (${url}):`, error.message);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError || new Error("Failed to fetch remote model map");
  }

  /**
   * Pulls the remote model map from GitHub, then a China-accessible jsDelivr mirror.
   * @returns {Record<string, Record<string, number>>} - The formatted model map
   */
  async #pullRemoteModelMap() {
    try {
      const data = await this.#fetchRemoteJson();
      const modelMap = this.#validateModelMap(this.#formatModelMap(data));
      await fs.promises.writeFile(
        this.cacheFilePath,
        JSON.stringify(modelMap, null, 2)
      );

      this.log("Remote model map synced and cached");
      return modelMap;
    } catch (error) {
      this.log("Error syncing remote model map", error);
      return null;
    }
  }

  #validateModelMap(modelMap = {}) {
    for (const [provider, models] of Object.entries(modelMap)) {
      // If the models is null/falsey or has no keys, throw an error
      if (typeof models !== "object")
        throw new Error(
          `Invalid model map for ${provider} - models is not an object`
        );
      if (!models || Object.keys(models).length === 0)
        throw new Error(`Invalid model map for ${provider} - no models found!`);

      for (const [model, value] of Object.entries(models)) {
        const input = this.#entryInput(value);
        if (!input) {
          this.log(
            `${provider}:${model} - context window is not a positive number. Got ${value}.`
          );
          delete models[model];
        }
      }
    }
    return modelMap;
  }

  /**
   * Formats the remote model map to a format that is compatible with how we store the model map
   * for all providers who use it.
   * @param {Record<string, any>} modelMap - The remote model map
   * @returns {Record<string, Record<string, number>>} - The formatted model map
   */
  #formatModelMap(modelMap = {}) {
    const formattedModelMap = {};

    for (const [provider, liteLLMProviderTag] of Object.entries(
      ContextWindowFinder.trackedProviders
    )) {
      formattedModelMap[provider] = {};
      const matches = Object.entries(modelMap).filter(
        ([_key, config]) => config.litellm_provider === liteLLMProviderTag
      );
      for (const [key, config] of matches) {
        const contextWindow = Number(config.max_input_tokens);
        if (isNaN(contextWindow) || contextWindow <= 0) continue;

        const output = Number(
          config.max_output_tokens || config.max_tokens
        );
        const modelName = key.split("/").pop();
        formattedModelMap[provider][modelName] = {
          input: contextWindow,
          output: Number.isFinite(output) && output > 0 ? output : null,
        };
      }
    }
    return formattedModelMap;
  }

  /**
   * Gets the context window for a given provider and model.
   *
   * If the provider is not found, null is returned.
   * If the model is not found, the provider's entire model map is returned.
   *
   * if both provider and model are provided, the context window for the given model is returned.
   * @param {string|null} provider - The provider to get the context window for
   * @param {string|null} model - The model to get the context window for
   * @returns {number|null} - The context window for the given provider and model
   */
  get(provider = null, model = null) {
    if (!provider || !this.cachedModelMap || !this.cachedModelMap[provider])
      return null;
    if (!model) return this.cachedModelMap[provider];

    const entry = this.#lookupEntry(provider, model);
    if (!entry) {
      this.log("Invalid access to model context window - not found in cache", {
        provider,
        model,
      });
      return null;
    }
    return this.#entryInput(entry);
  }

  #entryInput(value) {
    if (value && typeof value === "object") {
      const n = Number(value.input);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  #entryOutput(value) {
    if (value && typeof value === "object") {
      const n = Number(value.output);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return null;
  }

  #lookupEntry(provider, model) {
    const map = this.cachedModelMap;
    if (!map) return null;
    const want = String(model || "")
      .replace(/\\/g, "/")
      .split("/")
      .pop();
    if (provider && map[provider]) {
      if (map[provider][model]) return map[provider][model];
      if (want && map[provider][want]) return map[provider][want];
    }
    if (!want) return null;
    for (const models of Object.values(map)) {
      if (models?.[model]) return models[model];
      if (models?.[want]) return models[want];
    }
    return null;
  }

  /** 型号表中的 max_output_tokens；旧缓存没有则返回 null */
  getOutput(provider = null, model = null) {
    const entry = this.#lookupEntry(provider, model);
    return this.#entryOutput(entry);
  }

  /**
   * 强制重新拉取型号表（用户更换/保存模型时调用）。
   * 进行中的拉取会复用，避免连点保存打多次。
   */
  async refresh() {
    if (this.#refreshing) return this.#refreshing;
    this.#refreshing = this.#pullRemoteModelMap().finally(() => {
      this.#refreshing = null;
    });
    return this.#refreshing;
  }
}

module.exports = { MODEL_MAP: new ContextWindowFinder() };
