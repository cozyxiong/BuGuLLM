import { useEffect, useRef, useState } from "react";
import { isMobile } from "react-device-detect";
import * as Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import useQuery from "@/hooks/useQuery";
import ChatRow from "./ChatRow";
import showToast from "@/utils/toast";
import System from "@/models/system";
import { CaretDown, Download, Trash } from "@phosphor-icons/react";
import { saveAs } from "file-saver";
import { useTranslation } from "react-i18next";
import { CanViewChatHistory } from "@/components/CanViewChatHistory";
import SettingsPage, {
  SettingsSaveBtn,
} from "@/components/SettingsSidebar/SettingsPage";

const exportOptions = {
  csv: {
    name: "CSV",
    mimeType: "text/csv",
    fileExtension: "csv",
    filenameFunc: () => {
      return `anythingllm-chats-${new Date().toLocaleDateString()}`;
    },
  },
  json: {
    name: "JSON",
    mimeType: "application/json",
    fileExtension: "json",
    filenameFunc: () => {
      return `anythingllm-chats-${new Date().toLocaleDateString()}`;
    },
  },
  jsonl: {
    name: "JSONL",
    mimeType: "application/jsonl",
    fileExtension: "jsonl",
    filenameFunc: () => {
      return `anythingllm-chats-${new Date().toLocaleDateString()}-lines`;
    },
  },
  jsonAlpaca: {
    name: "JSON (Alpaca)",
    mimeType: "application/json",
    fileExtension: "json",
    filenameFunc: () => {
      return `anythingllm-chats-${new Date().toLocaleDateString()}-alpaca`;
    },
  },
};

export default function WorkspaceChats() {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef();
  const openMenuButton = useRef();
  const query = useQuery();
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState([]);
  const [offset, setOffset] = useState(Number(query.get("offset") || 0));
  const [canNext, setCanNext] = useState(false);
  const { t } = useTranslation();

  const handleDumpChats = async (exportType) => {
    const chats = await System.exportChats(exportType, "workspace");
    if (!!chats) {
      const { name, mimeType, fileExtension, filenameFunc } =
        exportOptions[exportType];
      const blob = new Blob([chats], { type: mimeType });
      saveAs(blob, `${filenameFunc()}.${fileExtension}`);
      showToast(`已导出为 ${name}`, "success");
    } else {
      showToast("导出失败", "error");
    }
  };

  const handleClearAllChats = async () => {
    if (
      !window.confirm(
        "确定清空全部对话记录吗？\n此操作不可恢复。"
      )
    )
      return false;
    await System.deleteChat(-1);
    setChats([]);
    showToast("已清空", "success");
  };

  const toggleMenu = () => {
    setShowMenu(!showMenu);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        !openMenuButton.current.contains(event.target)
      ) {
        setShowMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    async function fetchChats() {
      const { chats: _chats = [], hasPages = false } =
        await System.chats(offset);
      setChats(_chats);
      setCanNext(hasPages);
      setLoading(false);
    }
    fetchChats();
  }, [offset]);

  return (
    <CanViewChatHistory>
      <SettingsPage
        wide
        title={t("recorded.title")}
        description={t("recorded.description")}
        headerRight={
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <button
                ref={openMenuButton}
                type="button"
                onClick={toggleMenu}
                className="h-7 px-2.5 rounded-md text-[12px] font-semibold border-none bg-white text-zinc-900 light:bg-theme-text-primary light:text-white inline-flex items-center gap-1"
              >
                <Download size={13} weight="bold" />
                {t("recorded.export")}
                <CaretDown size={13} weight="bold" />
              </button>
              <div
                ref={menuRef}
                className={`${
                  showMenu ? "slide-down" : "slide-up hidden"
                } z-20 w-fit rounded-lg absolute top-full right-0 bg-secondary light:bg-theme-bg-secondary mt-2 shadow-md`}
              >
                <div className="py-2">
                  {Object.entries(exportOptions).map(([key, data]) => (
                    <button
                      key={key}
                      onClick={() => {
                        handleDumpChats(key);
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-white text-sm hover:bg-[#3D4147] light:hover:bg-theme-sidebar-item-hover"
                    >
                      {data.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClearAllChats}
              disabled={chats.length === 0}
              className="h-7 px-2.5 rounded-md text-[12px] font-semibold border border-transparent bg-red-500/25 text-red-200 light:text-red-500 hover:text-white hover:bg-red-600 disabled:opacity-40 disabled:hover:bg-red-500/25 disabled:hover:text-red-200 light:disabled:hover:text-red-500"
            >
              {t("recorded.clear")}
            </button>
          </div>
        }
      >
            <div className="overflow-x-auto">
              <ChatsContainer
                loading={loading}
                chats={chats}
                setChats={setChats}
                offset={offset}
                setOffset={setOffset}
                canNext={canNext}
                t={t}
              />
            </div>
      </SettingsPage>
    </CanViewChatHistory>
  );
}

function ChatsContainer({
  loading,
  chats,
  setChats,
  offset,
  setOffset,
  canNext,
  t,
}) {
  const handlePrevious = () => {
    setOffset(Math.max(offset - 1, 0));
  };
  const handleNext = () => {
    setOffset(offset + 1);
  };

  const handleDeleteChat = async (chatId) => {
    await System.deleteChat(chatId);
    setChats((prevChats) => prevChats.filter((chat) => chat.id !== chatId));
  };

  if (loading) {
    return (
      <Skeleton.default
        height="80vh"
        width="100%"
        highlightColor="var(--theme-bg-primary)"
        baseColor="var(--theme-bg-secondary)"
        count={1}
        className="w-full p-4 rounded-b-2xl rounded-tr-2xl rounded-tl-sm"
        containerClassName="flex w-full"
      />
    );
  }

  return (
    <>
      <table className="w-full text-xs text-left rounded-lg min-w-[640px] border-spacing-0">
        <thead className="text-theme-text-secondary text-xs leading-[18px] font-bold uppercase border-white/10 border-b">
          <tr>
            <th scope="col" className="px-6 py-3 rounded-tl-lg">
              {t("recorded.table.id")}
            </th>
            <th scope="col" className="px-6 py-3">
              {t("recorded.table.by")}
            </th>
            <th scope="col" className="px-6 py-3">
              {t("recorded.table.workspace")}
            </th>
            <th scope="col" className="px-6 py-3">
              {t("recorded.table.prompt")}
            </th>
            <th scope="col" className="px-6 py-3">
              {t("recorded.table.response")}
            </th>
            <th scope="col" className="px-6 py-3">
              {t("recorded.table.at")}
            </th>
            <th scope="col" className="px-6 py-3 rounded-tr-lg">
              {" "}
            </th>
          </tr>
        </thead>
        <tbody>
          {!!chats &&
            chats.map((chat) => (
              <ChatRow key={chat.id} chat={chat} onDelete={handleDeleteChat} />
            ))}
        </tbody>
      </table>
      <div className="flex w-full justify-between items-center mt-6">
        <button
          onClick={handlePrevious}
          className="px-4 py-2 rounded-lg border border-theme-text-secondary text-theme-text-secondary text-sm items-center flex gap-x-2 hover:bg-theme-text-secondary hover:text-theme-bg-secondary disabled:invisible"
          disabled={offset === 0}
        >
          {" "}
          {t("recorded.previous")}
        </button>
        <button
          onClick={handleNext}
          className="px-4 py-2 rounded-lg border border-slate-200 text-slate-200 light:text-theme-text-secondary light:border-theme-sidebar-border text-sm items-center flex gap-x-2 hover:bg-slate-200 hover:text-slate-800 disabled:invisible"
          disabled={!canNext}
        >
          {t("recorded.next")}
        </button>
      </div>
    </>
  );
}
