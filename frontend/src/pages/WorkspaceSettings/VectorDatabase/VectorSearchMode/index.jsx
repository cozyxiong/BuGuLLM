import { useState } from "react";

// We dont support all vectorDBs yet for reranking due to complexities of how each provider
// returns information. We need to normalize the response data so Reranker can be used for each provider.
const supportedVectorDBs = ["lancedb"];

const hint = {
  default: {
    title: "\u901f\u5ea6\u4f18\u5148",
    description:
      "\u68c0\u7d22\u901f\u5ea6\u6700\u5feb\uff0c\u4f46\u76f8\u5173\u5ea6\u53ef\u80fd\u7565\u4f4e\uff0c\u5076\u5c14\u4f1a\u5f15\u5165\u4e0d\u51c6\u786e\u7684\u4e0a\u4e0b\u6587\u3002",
  },
  rerank: {
    title: "\u51c6\u786e\u5ea6\u4f18\u5148",
    description:
      "\u4f1a\u5148\u91cd\u6392\u68c0\u7d22\u7ed3\u679c\uff0c\u56de\u7b54\u66f4\u8d34\u5207\uff0c\u4f46\u751f\u6210\u65f6\u95f4\u53ef\u80fd\u7a0d\u957f\u3002",
  },
};

export default function VectorSearchMode({ workspace, setHasChanges }) {
  const [selection, setSelection] = useState(
    workspace?.vectorSearchMode ?? "default"
  );
  if (!workspace?.vectorDB || !supportedVectorDBs.includes(workspace?.vectorDB))
    return null;

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-y-[8px]">
        <label htmlFor="vectorSearchMode" className="block input-label">
          {"\u68c0\u7d22\u504f\u597d"}
        </label>
        <p className="text-white text-opacity-60 text-xs font-medium">
          {hint[selection]?.description}
        </p>
      </div>
      <select
        id="vectorSearchMode"
        name="vectorSearchMode"
        value={selection}
        className="border-none bg-theme-settings-input-bg text-white text-sm mt-2 rounded-lg focus:outline-none active:outline-none outline-none block w-full p-2.5"
        onChange={(e) => {
          setSelection(e.target.value);
          setHasChanges(true);
        }}
        required={true}
      >
        <option value="default">{hint.default.title}</option>
        <option value="rerank">{hint.rerank.title}</option>
      </select>
    </div>
  );
}
