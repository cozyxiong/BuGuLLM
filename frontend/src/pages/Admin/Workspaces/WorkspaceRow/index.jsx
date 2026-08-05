import { useRef } from "react";
import Admin from "@/models/admin";
import Workspace from "@/models/workspace";
import paths from "@/utils/paths";
import { LinkSimple, Trash } from "@phosphor-icons/react";

function formatCreatedAt(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function WorkspaceRow({
  workspace,
  deletionProtected = false,
}) {
  const rowRef = useRef(null);
  const handleDelete = async () => {
    if (
      !window.confirm(
        `确定删除工作区「${workspace.name}」吗？\n对话和设置会一并删掉，此操作不可恢复。`
      )
    )
      return false;
    rowRef?.current?.remove();
    const result = await Admin.deleteWorkspace(workspace.id);
    if (result?.success === false && workspace.slug)
      await Workspace.delete(workspace.slug);
  };

  return (
    <>
      <tr
        ref={rowRef}
        className="bg-transparent text-white text-opacity-80 text-xs font-medium border-b border-white/10 h-10"
      >
        <th scope="row" className="px-6 whitespace-nowrap">
          {workspace.name}
        </th>
        <td className="px-6">
          <a
            href={paths.workspace.chat(workspace.slug)}
            target="_blank"
            rel="noreferrer"
            className="text-white flex items-center hover:underline"
          >
            <LinkSimple className="mr-2 w-4 h-4" /> {workspace.slug}
          </a>
        </td>
        <td className="px-6">{formatCreatedAt(workspace.createdAt)}</td>
        <td className="px-6">
          {!deletionProtected && (
            <button
              onClick={handleDelete}
              className="text-xs font-medium text-white/80 light:text-black/80 hover:light:text-red-500 hover:text-red-300 rounded-lg px-2 py-1 hover:bg-white hover:light:bg-red-50 hover:bg-opacity-10"
            >
              <Trash className="h-5 w-5" />
            </button>
          )}
        </td>
      </tr>
    </>
  );
}
