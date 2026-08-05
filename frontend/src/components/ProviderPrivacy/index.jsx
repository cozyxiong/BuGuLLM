import { useState, useEffect } from "react";
import System from "@/models/system";
import { PROVIDER_PRIVACY_MAP } from "./constants";
import { ArrowSquareOut } from "@phosphor-icons/react";
import AnythingLLMIcon from "@/media/logo/anything-llm-icon.png";
import { Link } from "react-router-dom";
import { titleCase, sentenceCase } from "text-case";

function defaultProvider(providerString) {
  return {
    name: providerString
      ? titleCase(sentenceCase(String(providerString)))
      : "未知",
    description: [
      `「${providerString}」在本系统中没有登记数据处理说明。`,
    ],
    logo: AnythingLLMIcon,
  };
}

export default function ProviderPrivacy() {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState({
    llmProvider: null,
    embeddingEngine: null,
    vectorDb: null,
  });

  useEffect(() => {
    async function fetchProviders() {
      const _settings = await System.keys();
      const providerDefinition =
        PROVIDER_PRIVACY_MAP.llm[_settings?.LLMProvider] ||
        defaultProvider(_settings?.LLMProvider);
      const embeddingEngineDefinition =
        PROVIDER_PRIVACY_MAP.embeddingEngine[_settings?.EmbeddingEngine] ||
        defaultProvider(_settings?.EmbeddingEngine);
      const vectorDbDefinition =
        PROVIDER_PRIVACY_MAP.vectorDb[_settings?.VectorDB] ||
        defaultProvider(_settings?.VectorDB);

      setProviders({
        llmProvider: providerDefinition,
        embeddingEngine: embeddingEngineDefinition,
        vectorDb: vectorDbDefinition,
      });
      setLoading(false);
    }
    fetchProviders();
  }, []);

  if (loading) return null;
  return (
    <div className="flex flex-col gap-8 w-full max-w-2xl">
      <ProviderPrivacyItem
        title="语言模型"
        provider={providers.llmProvider}
        altText="语言模型图标"
      />
      <ProviderPrivacyItem
        title="嵌入模型"
        provider={providers.embeddingEngine}
        altText="嵌入服务图标"
      />
      <ProviderPrivacyItem
        title="向量数据库"
        provider={providers.vectorDb}
        altText="向量数据库图标"
      />
    </div>
  );
}

function ProviderPrivacyItem({ title, provider, altText }) {
  return (
    <div className="flex flex-col items-start gap-y-3 pb-4 border-b border-theme-sidebar-border">
      <div className="text-theme-text-primary text-base font-bold">{title}</div>
      <div className="flex items-start gap-3">
        <img
          src={provider.logo}
          alt={altText}
          className="w-8 h-8 rounded flex-shrink-0 mt-0.5"
        />
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-theme-text-primary text-sm font-semibold">
              {provider.name}
            </span>
          </div>
          {provider.policyUrl ? (
            <div className="text-theme-text-secondary text-sm">
              使用过程中的对话和数据，会受该服务「
              <Link
                className="text-theme-text-secondary hover:text-theme-text-primary text-sm font-medium underline transition-colors inline-flex items-center gap-1"
                to={provider.policyUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                隐私政策
                <ArrowSquareOut size={12} />
              </Link>
              」约束。
            </div>
          ) : (
            provider.description && (
              <ul className="flex flex-col list-none gap-1">
                {provider.description.map((desc, idx) => (
                  <li key={idx} className="text-theme-text-secondary text-sm">
                    {desc}
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </div>
    </div>
  );
}
