import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** 稳定 API（register/unregister），不随 actions 变化 */
const SettingsSaveApiContext = createContext(null);
/** 当前已注册的保存动作，仅顶栏按钮订阅 */
const SettingsSaveStateContext = createContext({});

/**
 * 设置页保存状态：按钮固定在顶栏右侧，不进入内容流，避免改动时挤排版。
 * 支持多个子模块同时注册（例如名称表单 + 建议消息）。
 */
export function SettingsSaveProvider({ children }) {
  const [actions, setActions] = useState(() => ({}));

  const register = useCallback((ownerId, next) => {
    setActions((prev) => {
      const prevItem = prev[ownerId];
      const nextItem = {
        visible: !!next.visible,
        saving: !!next.saving,
        formId: next.formId || null,
        onClick: next.onClick || null,
        label: next.label || "保存更改",
        savingLabel: next.savingLabel || "保存中…",
        hint: next.hint || "有未保存的修改",
      };
      // 浅比较，避免无意义重渲染
      if (
        prevItem &&
        prevItem.visible === nextItem.visible &&
        prevItem.saving === nextItem.saving &&
        prevItem.formId === nextItem.formId &&
        prevItem.onClick === nextItem.onClick &&
        prevItem.label === nextItem.label &&
        prevItem.savingLabel === nextItem.savingLabel &&
        prevItem.hint === nextItem.hint
      ) {
        return prev;
      }
      return { ...prev, [ownerId]: nextItem };
    });
  }, []);

  const unregister = useCallback((ownerId) => {
    setActions((prev) => {
      if (!(ownerId in prev)) return prev;
      const copy = { ...prev };
      delete copy[ownerId];
      return copy;
    });
  }, []);

  const api = useMemo(
    () => ({ register, unregister }),
    [register, unregister]
  );

  return (
    <SettingsSaveApiContext.Provider value={api}>
      <SettingsSaveStateContext.Provider value={actions}>
        {children}
      </SettingsSaveStateContext.Provider>
    </SettingsSaveApiContext.Provider>
  );
}

/**
 * 子页注册当前保存状态；卸载或切换时自动清理。
 * 支持 formId（原生 form submit）或 onClick（自定义保存）。
 */
export function useSettingsSaveAction({
  visible = false,
  saving = false,
  formId = null,
  onClick = null,
  label = "保存更改",
  savingLabel = "保存中…",
  hint = "有未保存的修改",
}) {
  const api = useContext(SettingsSaveApiContext);
  const ownerId = useRef(
    `save-${Math.random().toString(36).slice(2, 10)}`
  ).current;

  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
  const hasOnClick = typeof onClick === "function";

  // 稳定包装，避免每次 register 都换 onClick 引用
  const stableOnClick = useMemo(
    () => (hasOnClick ? () => onClickRef.current?.() : null),
    [hasOnClick]
  );

  useEffect(() => {
    if (!api) return undefined;
    api.register(ownerId, {
      visible,
      saving,
      formId,
      onClick: stableOnClick,
      label,
      savingLabel,
      hint,
    });
  }, [
    api,
    ownerId,
    visible,
    saving,
    formId,
    stableOnClick,
    label,
    savingLabel,
    hint,
  ]);

  useEffect(() => {
    if (!api) return undefined;
    return () => api.unregister(ownerId);
  }, [api, ownerId]);
}

/**
 * 导航栏保存控件：紧跟在 tab（如「代理设置」）右侧，靠近内容区、鼠标路径短。
 * 固定占位，显隐不改变内容区布局。
 */
export function SettingsHeaderSave() {
  const actions = useContext(SettingsSaveStateContext);
  const list = Object.values(actions || {});
  const dirty = list.filter((a) => a.visible);
  const visible = dirty.length > 0;
  const saving = dirty.some((a) => a.saving);
  const label = dirty[0]?.label || "保存更改";
  const savingLabel = dirty[0]?.savingLabel || "保存中…";

  const handleSave = () => {
    for (const action of dirty) {
      if (typeof action.onClick === "function") {
        action.onClick();
        continue;
      }
      if (action.formId) {
        const form = document.getElementById(action.formId);
        if (form?.requestSubmit) form.requestSubmit();
        else
          form?.dispatchEvent(
            new Event("submit", { cancelable: true, bubbles: true })
          );
      }
    }
  };

  return (
    <div
      className="shrink-0 flex items-center self-center mb-1.5 pl-1"
      aria-live="polite"
    >
      {/* 固定宽度占位，避免显隐时 tab 行抖动 */}
      <div className="w-[4.75rem] flex justify-start">
        <button
          type="button"
          disabled={!visible || saving}
          onClick={handleSave}
          title={visible ? "有未保存的修改" : undefined}
          className={[
            "h-7 px-2.5 rounded-md text-[12px] font-semibold border-none transition-all duration-150 whitespace-nowrap",
            visible
              ? "bg-white text-zinc-900 light:bg-theme-text-primary light:text-white hover:bg-white/90 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              : "opacity-0 pointer-events-none bg-transparent text-transparent",
          ].join(" ")}
          tabIndex={visible ? 0 : -1}
          aria-hidden={!visible}
        >
          {saving ? savingLabel : label}
        </button>
      </div>
    </div>
  );
}

/**
 * 兼容旧用法：在子页写 <SettingsSaveBar visible ... /> 即可注册到顶栏。
 */
export default function SettingsSaveBar(props) {
  useSettingsSaveAction(props);
  return null;
}
