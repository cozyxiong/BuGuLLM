const OpenAI = require("openai");
const Provider = require("./ai-provider.js");
const InheritMultiple = require("./helpers/classes.js");
const UnTooled = require("./helpers/untooled.js");
const { tooledStream, tooledComplete } = require("./helpers/tooled.js");
const { RetryError } = require("../error.js");
const { toValidNumber } = require("../../../http/index.js");
const { getAnythingLLMUserAgent } = require("../../../../endpoints/utils");
const { GenericOpenAiLLM } = require("../../../AiProviders/genericOpenAi");

/** DeepSeek thinking-mode model ids that need reasoning_content on tool turns */
const DEEPSEEK_THINKING_MODELS = [
  "deepseek-reasoner",
  "deepseek-v4-flash",
  "deepseek-v4-pro",
];

/**
 * The agent provider for the Generic OpenAI provider.
 * Supports native tool calling when available; falls back to UnTooled otherwise.
 * When pointed at DeepSeek (base URL / model), applies thinking-model message fixes.
 */
class GenericOpenAiProvider extends InheritMultiple([Provider, UnTooled]) {
  model;

  constructor(config = {}) {
    super();
    this.providerTag = "generic-openai";
    const { model = "gpt-3.5-turbo" } = config;
    const client = new OpenAI({
      baseURL: process.env.GENERIC_OPEN_AI_BASE_PATH,
      apiKey: process.env.GENERIC_OPEN_AI_API_KEY ?? null,
      // Agent tool streams can sit idle during model "thinking"; avoid premature aborts.
      timeout: Number(process.env.GENERIC_OPEN_AI_TIMEOUT_MS) || 10 * 60 * 1000,
      maxRetries: 2,
      defaultHeaders: {
        "User-Agent": getAnythingLLMUserAgent(),
        ...GenericOpenAiLLM.parseCustomHeaders(),
      },
    });

    this._client = client;
    this.model = model;
    this.verbose = true;
    this._supportsToolCalling = null;
    this.maxTokens = process.env.GENERIC_OPEN_AI_MAX_TOKENS
      ? toValidNumber(process.env.GENERIC_OPEN_AI_MAX_TOKENS, 1024)
      : 1024;
  }

  get client() {
    return this._client;
  }

  get supportsAgentStreaming() {
    // Honor streaming being disabled via ENV via user preference.
    if (process.env.GENERIC_OPENAI_STREAMING_DISABLED === "true") return false;
    return true;
  }

  /**
   * Detect DeepSeek-compatible endpoints / thinking models so we can inject
   * reasoning_content required by multi-turn tool calling.
   */
  get #isDeepSeekEndpoint() {
    const base = String(process.env.GENERIC_OPEN_AI_BASE_PATH || "").toLowerCase();
    return base.includes("deepseek.com") || base.includes("deepseek");
  }

  get #isThinkingModel() {
    const m = String(this.model || "").toLowerCase();
    if (DEEPSEEK_THINKING_MODELS.includes(m)) return true;
    // Reasoner / v4 thinking family often used via generic OpenAI gateways
    if (this.#isDeepSeekEndpoint && /(reasoner|v4-flash|v4-pro|thinking)/i.test(m))
      return true;
    return false;
  }

  get #tooledOptions() {
    return {
      provider: this,
      maxTokens: this.maxTokens,
      ...(this.#isThinkingModel ? { injectReasoningContent: true } : {}),
    };
  }

  /**
   * DeepSeek (and many OpenAI-compat gateways) do not accept vision payloads.
   */
  #stripAttachmentsIfNeeded(messages = []) {
    if (!this.#isDeepSeekEndpoint && !this.#isThinkingModel) return messages;
    let stripped = false;
    const out = messages.map((msg) => {
      if (msg.attachments && msg.attachments.length > 0) {
        stripped = true;
        const { attachments: _, ...rest } = msg;
        return rest;
      }
      return msg;
    });
    if (stripped) {
      this.providerLog(
        "Stripped image attachments for DeepSeek-compatible endpoint (vision not supported)."
      );
    }
    return out;
  }

  #isRetryableProviderError(error) {
    if (!error) return false;
    if (error instanceof OpenAI.AuthenticationError) return false;
    if (
      error instanceof OpenAI.RateLimitError ||
      error instanceof OpenAI.InternalServerError ||
      error instanceof OpenAI.APIConnectionError ||
      error instanceof OpenAI.APIError
    )
      return true;
    const msg = String(error.message || error.code || "");
    return /ECONNRESET|ETIMEDOUT|ECONNREFUSED|socket hang up|Connection error|network/i.test(
      msg
    );
  }

  async #handleFunctionCallChat({ messages = [] }) {
    return await this.client.chat.completions
      .create({
        model: this.model,
        temperature: 0,
        messages,
        max_tokens: this.maxTokens,
      })
      .then((result) => {
        if (!result.hasOwnProperty("choices"))
          throw new Error("Generic OpenAI chat: No results!");
        if (result.choices.length === 0)
          throw new Error("Generic OpenAI chat: No results length!");
        return result.choices[0].message.content;
      })
      .catch((_) => {
        return null;
      });
  }

  async #handleFunctionCallStream({ messages = [] }) {
    return await this.client.chat.completions.create({
      model: this.model,
      stream: true,
      messages,
      max_tokens: this.maxTokens,
    });
  }

  /**
   * Stream a chat completion with tool calling support.
   * Uses native tool calling when supported, otherwise falls back to UnTooled.
   */
  async stream(messages, functions = [], eventHandler = null) {
    const cleaned = this.#stripAttachmentsIfNeeded(messages);
    const useNative =
      functions.length > 0 && (await this.supportsNativeToolCalling());

    if (!useNative) {
      return await UnTooled.prototype.stream.call(
        this,
        cleaned,
        functions,
        this.#handleFunctionCallStream.bind(this),
        eventHandler
      );
    }

    this.providerLog(
      "Provider.stream (tooled) - will process this chat completion."
    );

    try {
      return await tooledStream(
        this.client,
        this.model,
        cleaned,
        functions,
        eventHandler,
        this.#tooledOptions
      );
    } catch (error) {
      console.error(error.message, error);
      if (error instanceof OpenAI.AuthenticationError) throw error;
      if (this.#isRetryableProviderError(error)) {
        throw new RetryError(error.message);
      }
      throw error;
    }
  }

  /**
   * Create a non-streaming completion with tool calling support.
   * Uses native tool calling when supported, otherwise falls back to UnTooled.
   */
  async complete(messages, functions = []) {
    const cleaned = this.#stripAttachmentsIfNeeded(messages);
    const useNative =
      functions.length > 0 && (await this.supportsNativeToolCalling());

    if (!useNative) {
      return await UnTooled.prototype.complete.call(
        this,
        cleaned,
        functions,
        this.#handleFunctionCallChat.bind(this)
      );
    }

    try {
      const result = await tooledComplete(
        this.client,
        this.model,
        cleaned,
        functions,
        this.getCost.bind(this),
        this.#tooledOptions
      );

      if (result.retryWithError) {
        return this.complete([...messages, result.retryWithError], functions);
      }

      return result;
    } catch (error) {
      if (error instanceof OpenAI.AuthenticationError) throw error;
      if (this.#isRetryableProviderError(error)) {
        throw new RetryError(error.message);
      }
      throw error;
    }
  }

  /**
   * Get the cost of the completion.
   *
   * @param _usage The completion to get the cost for.
   * @returns The cost of the completion.
   */
  getCost(_usage) {
    return 0;
  }
}

module.exports = GenericOpenAiProvider;
