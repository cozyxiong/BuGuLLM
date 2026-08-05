import React, { useState, useEffect } from "react";
import System from "@/models/system";
import showToast from "@/utils/toast";
import { Plus } from "@phosphor-icons/react";
import VariableRow from "./VariableRow";
import ModalWrapper from "@/components/ModalWrapper";
import AddVariableModal from "./AddVariableModal";
import { useModal } from "@/hooks/useModal";
import * as Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import SettingsPage, {
  SettingsSaveBtn,
} from "@/components/SettingsSidebar/SettingsPage";

export default function SystemPromptVariables() {
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isOpen, openModal, closeModal } = useModal();

  useEffect(() => {
    fetchVariables();
  }, []);

  const fetchVariables = async () => {
    setLoading(true);
    try {
      const { variables } = await System.promptVariables.getAll();
      setVariables(variables || []);
    } catch (error) {
      console.error("Error fetching variables:", error);
      showToast("加载变量失败", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsPage
      wide
      title="系统提示变量"
      description="在系统提示词里用 {变量名} 插入动态内容，例如当前时间、工作区名称。"
      headerRight={
        <SettingsSaveBtn onClick={openModal}>
          <span className="inline-flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" weight="bold" />
            添加变量
          </span>
        </SettingsSaveBtn>
      }
    >
      <div className="overflow-x-auto">
        {loading ? (
          <Skeleton.default
            height={220}
            width="100%"
            highlightColor="var(--theme-bg-primary)"
            baseColor="var(--theme-bg-secondary)"
            className="w-full rounded-lg"
          />
        ) : variables.length === 0 ? (
          <div className="text-center py-4 text-theme-text-secondary">
            No variables found
          </div>
        ) : (
          <table className="w-full text-sm text-left rounded-lg min-w-[640px] border-spacing-0">
            <thead className="text-theme-text-secondary text-xs leading-[18px] font-bold uppercase border-white/10 border-b">
              <tr>
                <th scope="col" className="px-4 py-2 rounded-tl-lg">
                  键名
                </th>
                <th scope="col" className="px-4 py-2">
                  说明
                </th>
                <th scope="col" className="px-4 py-2">
                  类型
                </th>
              </tr>
            </thead>
            <tbody>
              {variables.map((variable) => (
                <VariableRow
                  key={variable.id ?? variable.key}
                  variable={variable}
                  onRefresh={fetchVariables}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ModalWrapper isOpen={isOpen}>
        <AddVariableModal closeModal={closeModal} onRefresh={fetchVariables} />
      </ModalWrapper>
    </SettingsPage>
  );
}
