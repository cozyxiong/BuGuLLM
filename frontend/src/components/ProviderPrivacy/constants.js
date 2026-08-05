import AnythingLLMIcon from "@/media/logo/anything-llm-icon.png";
import OpenAiLogo from "@/media/llmprovider/openai.png";
import GenericOpenAiLogo from "@/media/llmprovider/generic-openai.png";
import AzureOpenAiLogo from "@/media/llmprovider/azure.png";
import AnthropicLogo from "@/media/llmprovider/anthropic.png";
import GeminiLogo from "@/media/llmprovider/gemini.png";
import OllamaLogo from "@/media/llmprovider/ollama.png";
import TogetherAILogo from "@/media/llmprovider/togetherai.png";
import FireworksAILogo from "@/media/llmprovider/fireworksai.jpeg";
import NvidiaNimLogo from "@/media/llmprovider/nvidia-nim.png";
import LMStudioLogo from "@/media/llmprovider/lmstudio.png";
import LocalAiLogo from "@/media/llmprovider/localai.png";
import MistralLogo from "@/media/llmprovider/mistral.jpeg";
import PerplexityLogo from "@/media/llmprovider/perplexity.png";
import OpenRouterLogo from "@/media/llmprovider/openrouter.jpeg";
import NovitaLogo from "@/media/llmprovider/novita.png";
import GroqLogo from "@/media/llmprovider/groq.png";
import KoboldCPPLogo from "@/media/llmprovider/koboldcpp.png";
import TextGenWebUILogo from "@/media/llmprovider/text-generation-webui.png";
import LiteLLMLogo from "@/media/llmprovider/litellm.png";
import AWSBedrockLogo from "@/media/llmprovider/bedrock.png";
import DeepSeekLogo from "@/media/llmprovider/deepseek.png";
import APIPieLogo from "@/media/llmprovider/apipie.png";
import XAILogo from "@/media/llmprovider/xai.png";
import ZAiLogo from "@/media/llmprovider/zai.png";
import CohereLogo from "@/media/llmprovider/cohere.png";
import ZillizLogo from "@/media/vectordbs/zilliz.png";
import AstraDBLogo from "@/media/vectordbs/astraDB.png";
import ChromaLogo from "@/media/vectordbs/chroma.png";
import PineconeLogo from "@/media/vectordbs/pinecone.png";
import LanceDbLogo from "@/media/vectordbs/lancedb.png";
import WeaviateLogo from "@/media/vectordbs/weaviate.png";
import QDrantLogo from "@/media/vectordbs/qdrant.png";
import MilvusLogo from "@/media/vectordbs/milvus.png";
import VoyageAiLogo from "@/media/embeddingprovider/voyageai.png";
import PPIOLogo from "@/media/llmprovider/ppio.png";
import PGVectorLogo from "@/media/vectordbs/pgvector.png";
import MoonshotAiLogo from "@/media/llmprovider/moonshotai.png";
import CometApiLogo from "@/media/llmprovider/cometapi.png";
import FoundryLogo from "@/media/llmprovider/foundry-local.png";
import GiteeAILogo from "@/media/llmprovider/giteeai.png";
import DockerModelRunnerLogo from "@/media/llmprovider/docker-model-runner.png";
import PrivateModeLogo from "@/media/llmprovider/privatemode.png";
import SambaNovaLogo from "@/media/llmprovider/sambanova.png";
import LemonadeLogo from "@/media/llmprovider/lemonade.png";
import MinimaxLogo from "@/media/llmprovider/minimax.png";
import CerebrasLogo from "@/media/llmprovider/cerebras.png";

const LLM_PROVIDER_PRIVACY_MAP = {
  openai: {
    name: "OpenAI",
    policyUrl: "https://openai.com/policies/privacy-policy/",
    logo: OpenAiLogo,
  },
  azure: {
    name: "Azure OpenAI",
    policyUrl: "https://privacy.microsoft.com/privacystatement",
    logo: AzureOpenAiLogo,
  },
  anthropic: {
    name: "Anthropic",
    policyUrl: "https://www.anthropic.com/privacy",
    logo: AnthropicLogo,
  },
  gemini: {
    name: "Google Gemini",
    policyUrl: "https://policies.google.com/privacy",
    logo: GeminiLogo,
  },
  "nvidia-nim": {
    name: "NVIDIA NIM",
    description: [
      "模型和对话只存在运行 NVIDIA NIM 的这台机器上。",
    ],
    logo: NvidiaNimLogo,
  },
  lmstudio: {
    name: "LMStudio",
    description: [
      "模型和对话只存在运行 LMStudio 的这台机器上。",
    ],
    logo: LMStudioLogo,
  },
  localai: {
    name: "LocalAI",
    description: [
      "模型和对话只存在运行 LocalAI 的这台机器上。",
    ],
    logo: LocalAiLogo,
  },
  ollama: {
    name: "Ollama",
    description: [
      "模型和对话只存在运行 Ollama 的这台机器上。",
    ],
    logo: OllamaLogo,
  },
  togetherai: {
    name: "TogetherAI",
    policyUrl: "https://www.together.ai/privacy",
    logo: TogetherAILogo,
  },
  fireworksai: {
    name: "FireworksAI",
    policyUrl: "https://fireworks.ai/privacy-policy",
    logo: FireworksAILogo,
  },
  mistral: {
    name: "Mistral",
    policyUrl: "https://legal.mistral.ai/terms/privacy-policy",
    logo: MistralLogo,
  },
  perplexity: {
    name: "Perplexity AI",
    policyUrl: "https://www.perplexity.ai/privacy",
    logo: PerplexityLogo,
  },
  openrouter: {
    name: "OpenRouter",
    policyUrl: "https://openrouter.ai/privacy",
    logo: OpenRouterLogo,
  },
  novita: {
    name: "Novita AI",
    policyUrl: "https://novita.ai/legal/privacy-policy",
    logo: NovitaLogo,
  },
  groq: {
    name: "Groq",
    policyUrl: "https://groq.com/privacy-policy/",
    logo: GroqLogo,
  },
  koboldcpp: {
    name: "KoboldCPP",
    description: [
      "模型和对话只存在运行 KoboldCPP 的这台机器上。",
    ],
    logo: KoboldCPPLogo,
  },
  textgenwebui: {
    name: "Oobabooga Web UI",
    description: [
      "模型和对话只存在运行 Oobabooga Web UI 的这台机器上。",
    ],
    logo: TextGenWebUILogo,
  },
  "generic-openai": {
    name: "OpenAI 兼容接口",
    description: [
      "数据如何处理，以你接入的接口服务方条款为准。",
    ],
    logo: GenericOpenAiLogo,
  },
  cohere: {
    name: "Cohere",
    policyUrl: "https://cohere.com/privacy",
    logo: CohereLogo,
  },
  litellm: {
    name: "LiteLLM",
    description: [
      "模型和对话只存在运行 LiteLLM 的这台机器上。",
    ],
    logo: LiteLLMLogo,
  },
  bedrock: {
    name: "AWS Bedrock",
    policyUrl: "https://aws.amazon.com/bedrock/security-compliance/",
    logo: AWSBedrockLogo,
  },
  deepseek: {
    name: "DeepSeek",
    policyUrl:
      "https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html",
    logo: DeepSeekLogo,
  },
  apipie: {
    name: "APIpie.AI",
    policyUrl: "https://apipie.ai/docs/Terms/privacy",
    logo: APIPieLogo,
  },
  xai: {
    name: "xAI",
    policyUrl: "https://x.ai/legal/privacy-policy",
    logo: XAILogo,
  },
  zai: {
    name: "Z.AI",
    policyUrl: "https://docs.z.ai/legal-agreement/privacy-policy",
    logo: ZAiLogo,
  },
  ppio: {
    name: "PPIO",
    policyUrl: "https://www.pipio.ai/privacy-policy",
    logo: PPIOLogo,
  },
  moonshotai: {
    name: "Moonshot AI",
    policyUrl: "https://platform.moonshot.ai/docs/agreement/userprivacy",
    logo: MoonshotAiLogo,
  },
  cometapi: {
    name: "CometAPI",
    policyUrl: "https://apidoc.cometapi.com/privacy-policy-873819m0",
    logo: CometApiLogo,
  },
  foundry: {
    name: "Microsoft Foundry Local",
    description: [
      "模型和对话只存在运行 Foundry Local 的这台机器上。",
    ],
    logo: FoundryLogo,
  },
  giteeai: {
    name: "GiteeAI",
    policyUrl: "https://ai.gitee.com/docs/appendix/privacy",
    logo: GiteeAILogo,
  },
  "docker-model-runner": {
    name: "Docker Model Runner",
    description: [
      "模型和对话只存在运行 Docker Model Runner 的这台机器上。",
    ],
    logo: DockerModelRunnerLogo,
  },
  privatemode: {
    name: "Privatemode",
    policyUrl: "https://docs.privatemode.ai/getting-started/faq#q2",
    logo: PrivateModeLogo,
  },
  sambanova: {
    name: "SambaNova",
    policyUrl: "https://sambanova.ai/privacy-policy",
    logo: SambaNovaLogo,
  },
  lemonade: {
    name: "Lemonade",
    description: [
      "模型和对话只存在运行 Lemonade 的这台机器上。",
    ],
    logo: LemonadeLogo,
  },
  minimax: {
    name: "Minimax",
    policyUrl: "https://platform.minimax.io/protocol/privacy-policy",
    logo: MinimaxLogo,
  },
  cerebras: {
    name: "Cerebras",
    policyUrl: "https://www.cerebras.ai/privacy-policy",
    logo: CerebrasLogo,
  },
};

const VECTOR_DB_PROVIDER_PRIVACY_MAP = {
  pgvector: {
    name: "PGVector",
    description: [
      "向量和文档文本存在你自己的 PostgreSQL 里。",
      "谁能访问，由你自己控制。",
    ],
    logo: PGVectorLogo,
  },
  chroma: {
    name: "Chroma",
    description: [
      "向量和文档文本存在你自己的 Chroma 实例里。",
      "谁能访问，由你自己控制。",
    ],
    logo: ChromaLogo,
  },
  chromacloud: {
    name: "Chroma Cloud",
    policyUrl: "https://www.trychroma.com/privacy",
    logo: ChromaLogo,
  },
  pinecone: {
    name: "Pinecone",
    policyUrl: "https://www.pinecone.io/privacy/",
    logo: PineconeLogo,
  },
  qdrant: {
    name: "Qdrant",
    policyUrl: "https://qdrant.tech/legal/privacy-policy/",
    logo: QDrantLogo,
  },
  weaviate: {
    name: "Weaviate",
    policyUrl: "https://weaviate.io/privacy",
    logo: WeaviateLogo,
  },
  milvus: {
    name: "Milvus",
    description: [
      "向量和文档文本存在你的 Milvus 实例里（云端或自建均可）。",
    ],
    logo: MilvusLogo,
  },
  zilliz: {
    name: "Zilliz Cloud",
    policyUrl: "https://zilliz.com/privacy-policy",
    logo: ZillizLogo,
  },
  astra: {
    name: "AstraDB",
    policyUrl: "https://www.ibm.com/us-en/privacy",
    logo: AstraDBLogo,
  },
  lancedb: {
    name: "LanceDB",
    description: [
      "向量和文档文本只保存在本机 AnythingLLM 实例里。",
    ],
    logo: LanceDbLogo,
  },
};

const EMBEDDING_ENGINE_PROVIDER_PRIVACY_MAP = {
  native: {
    name: "AnythingLLM Embedder",
    description: [
      "文档会在本机 AnythingLLM 里完成向量化，不会外传。",
    ],
    logo: AnythingLLMIcon,
  },
  openai: {
    name: "OpenAI",
    policyUrl: "https://openai.com/policies/privacy-policy/",
    logo: OpenAiLogo,
  },
  azure: {
    name: "Azure OpenAI",
    policyUrl: "https://privacy.microsoft.com/privacystatement",
    logo: AzureOpenAiLogo,
  },
  localai: {
    name: "LocalAI",
    description: [
      "文档会在运行 LocalAI 的这台机器上完成向量化。",
    ],
    logo: LocalAiLogo,
  },
  ollama: {
    name: "Ollama",
    description: [
      "文档会在运行 Ollama 的这台机器上完成向量化。",
    ],
    logo: OllamaLogo,
  },
  lmstudio: {
    name: "LMStudio",
    description: [
      "文档会在运行 LMStudio 的这台机器上完成向量化。",
    ],
    logo: LMStudioLogo,
  },
  openrouter: {
    name: "OpenRouter",
    policyUrl: "https://openrouter.ai/privacy",
    logo: OpenRouterLogo,
  },
  cohere: {
    name: "Cohere",
    policyUrl: "https://cohere.com/privacy",
    logo: CohereLogo,
  },
  voyageai: {
    name: "Voyage AI",
    policyUrl: "https://www.voyageai.com/privacy",
    logo: VoyageAiLogo,
  },
  mistral: {
    name: "Mistral AI",
    policyUrl: "https://legal.mistral.ai/terms/privacy-policy",
    logo: MistralLogo,
  },
  litellm: {
    name: "LiteLLM",
    description: [
      "文档文本只会到达运行 LiteLLM 的机器，以及你在 LiteLLM 里配置的下游服务。",
    ],
    logo: LiteLLMLogo,
  },
  "generic-openai": {
    name: "OpenAI 兼容接口",
    description: [
      "数据如何处理，以你接入的接口服务方条款为准。",
    ],
    logo: GenericOpenAiLogo,
  },
  gemini: {
    name: "Google Gemini",
    policyUrl: "https://policies.google.com/privacy",
    logo: GeminiLogo,
  },
  lemonade: {
    name: "Lemonade",
    description: [
      "文档会在运行 Lemonade 的这台机器上完成向量化。",
    ],
    logo: LemonadeLogo,
  },
};

export const PROVIDER_PRIVACY_MAP = {
  llm: LLM_PROVIDER_PRIVACY_MAP,
  embeddingEngine: EMBEDDING_ENGINE_PROVIDER_PRIVACY_MAP,
  vectorDb: VECTOR_DB_PROVIDER_PRIVACY_MAP,
};
