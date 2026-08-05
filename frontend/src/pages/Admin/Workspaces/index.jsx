import { useEffect, useState } from "react";
import * as Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { Plus } from "@phosphor-icons/react";
import Admin from "@/models/admin";
import System from "@/models/system";
import WorkspaceRow from "./WorkspaceRow";
import NewWorkspaceModal from "./NewWorkspaceModal";
import { useModal } from "@/hooks/useModal";
import ModalWrapper from "@/components/ModalWrapper";
import SettingsPage, {
  SettingsSaveBtn,
} from "@/components/SettingsSidebar/SettingsPage";

export default function AdminWorkspaces() {
  const { isOpen, openModal, closeModal } = useModal();

  return (
    <SettingsPage
      wide
      title="工作区"
      description="本机上的全部工作区。删除后，其中的对话和设置会一并清掉。"
      headerRight={
        <SettingsSaveBtn onClick={openModal}>
          <span className="inline-flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" weight="bold" />
            新建工作区
          </span>
        </SettingsSaveBtn>
      }
    >
      <div className="overflow-x-auto">
        <WorkspacesContainer />
      </div>
      <ModalWrapper isOpen={isOpen}>
        <NewWorkspaceModal closeModal={closeModal} />
      </ModalWrapper>
    </SettingsPage>
  );
}

function WorkspacesContainer() {
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState([]);
  const [deletionProtected, setDeletionProtected] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const [_workspaces, _settings] = await Promise.all([
        Admin.workspaces(),
        System.keys(),
      ]);
      setWorkspaces(_workspaces || []);
      setDeletionProtected(_settings?.WorkspaceDeletionProtection === true);
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <Skeleton.default
        height="80vh"
        width="100%"
        highlightColor="var(--theme-bg-primary)"
        baseColor="var(--theme-bg-secondary)"
        count={1}
        className="w-full p-4 rounded-b-2xl rounded-tr-2xl rounded-tl-sm mt-6"
        containerClassName="flex w-full"
      />
    );
  }

  return (
    <table className="w-full text-xs text-left rounded-lg mt-6 min-w-[640px] border-spacing-0">
      <thead className="text-theme-text-secondary text-xs leading-[18px] font-bold uppercase border-white/10 border-b">
        <tr>
          <th scope="col" className="px-6 py-3 rounded-tl-lg">
            名称
          </th>
          <th scope="col" className="px-6 py-3">
            链接
          </th>
          <th scope="col" className="px-6 py-3">
            创建时间
          </th>
          <th scope="col" className="px-6 py-3 rounded-tr-lg">
            {" "}
          </th>
        </tr>
      </thead>
      <tbody>
        {workspaces.map((workspace) => (
          <WorkspaceRow
            key={workspace.id}
            workspace={workspace}
            deletionProtected={deletionProtected}
          />
        ))}
      </tbody>
    </table>
  );
}
