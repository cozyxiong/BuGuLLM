import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import App from "@/App.jsx";
import PrivateRoute, {
  AdminRoute,
  ManagerRoute,
} from "@/components/PrivateRoute";
import Login from "@/pages/Login";
import SimpleSSOPassthrough from "@/pages/Login/SSO/simple";
import OnboardingFlow from "@/pages/OnboardingFlow";
// 学习子页用静态导入，避免 Vite HMR 后 lazy chunk 失效
// （Failed to fetch dynamically imported module）
import LearningPage from "@/pages/Learning";
import StudioHome from "@/components/Learning/Studio/Home";
import MindmapStudio from "@/components/Learning/Studio/MindmapStudio";
import CardsStudio from "@/components/Learning/Studio/CardsStudio";
import QuizStudio from "@/components/Learning/Studio/QuizStudio";
import ReviewStudio from "@/components/Learning/Studio/ReviewStudio";
import TrashStudio from "@/components/Learning/Studio/TrashStudio";
import SettingsStudio from "@/components/Learning/Studio/SettingsStudio";
import GeneralLLMPreference from "@/pages/GeneralSettings/LLMPreference";
import GeneralTranscriptionPreference from "@/pages/GeneralSettings/TranscriptionPreference";
import GeneralAudioPreference from "@/pages/GeneralSettings/AudioPreference";
import GeneralEmbeddingPreference from "@/pages/GeneralSettings/EmbeddingPreference";
import EmbeddingTextSplitterPreference from "@/pages/GeneralSettings/EmbeddingTextSplitterPreference";
import GeneralVectorDatabase from "@/pages/GeneralSettings/VectorDatabase";
import AdminAgents from "@/pages/Admin/Agents";
import AgentBuilder from "@/pages/Admin/AgentBuilder";
import AdminLogs from "@/pages/Admin/Logging";
import ChatEmbedWidgets from "@/pages/GeneralSettings/ChatEmbedWidgets";
import GeneralSecurity from "@/pages/GeneralSettings/Security";
import PrivacyAndData from "@/pages/GeneralSettings/PrivacyAndData";
import InterfaceSettings from "@/pages/GeneralSettings/Settings/Interface";
import BrandingSettings from "@/pages/GeneralSettings/Settings/Branding";
import DefaultSystemPrompt from "@/pages/Admin/DefaultSystemPrompt";
import ChatSettings from "@/pages/GeneralSettings/Settings/Chat";
import GeneralApiKeys from "@/pages/GeneralSettings/ApiKeys";
import ModelRouters from "@/pages/GeneralSettings/ModelRouters";
import RouterRulesPage from "@/pages/GeneralSettings/ModelRouters/RouterRulesPage";
import SystemPromptVariables from "@/pages/Admin/SystemPromptVariables";
import GeneralBrowserExtension from "@/pages/GeneralSettings/BrowserExtensionApiKey";
import GeneralChats from "@/pages/GeneralSettings/Chats";
import AdminWorkspaces from "@/pages/Admin/Workspaces";
import TelegramBotSettings from "@/pages/GeneralSettings/Connections/TelegramBot";
import ScheduledJobs from "@/pages/GeneralSettings/ScheduledJobs";
import ScheduledJobRuns from "@/pages/GeneralSettings/ScheduledJobs/RunHistoryPage";
import ScheduledJobRunDetail from "@/pages/GeneralSettings/ScheduledJobs/RunDetailPage";
import SettingsLayout from "@/components/SettingsSidebar/SettingsLayout";
import "@/index.css";

const isDev = import.meta.env.DEV;
const REACTWRAP = isDev ? React.Fragment : React.StrictMode;

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "/",
        lazy: async () => {
          const { default: Main } = await import("@/pages/Main");
          return { element: <PrivateRoute Component={Main} /> };
        },
      },
      {
        path: "/login",
        element: <Login />,
      },
      {
        path: "/sso/simple",
        element: <SimpleSSOPassthrough />,
      },
      /**
       * 工作区布局：侧栏常驻，子路由只切换右侧（设置/学习/对话）
       * 避免齿轮、学习进出时重挂载知识库树。
       */
      {
        path: "/workspace/:slug",
        lazy: async () => {
          const { default: WorkspaceLayout } = await import(
            "@/pages/WorkspaceLayout"
          );
          return { element: <PrivateRoute Component={WorkspaceLayout} /> };
        },
        children: [
          // 主内容由 WorkspaceLayout 常驻挂载 WorkspaceChat，避免设置/学习往返卸载文档
          {
            index: true,
            element: null,
          },
          {
            path: "t/:threadSlug",
            element: null,
          },
          {
            path: "library",
            lazy: async () => {
              const { LibraryRedirect } = await import("@/pages/WorkspaceChat");
              return { element: <LibraryRedirect /> };
            },
          },
          {
            path: "settings/:tab",
            lazy: async () => {
              const { default: WorkspaceSettings } = await import(
                "@/pages/WorkspaceSettings"
              );
              // 布局已有 PrivateRoute；此处不再套 ManagerRoute，避免重复 UserMenu / 重挂载侧栏
              return { element: <WorkspaceSettings /> };
            },
          },
          {
            path: "learning",
            element: <LearningPage />,
            children: [
              { index: true, element: <StudioHome /> },
              { path: "mindmap", element: <MindmapStudio /> },
              { path: "cards", element: <CardsStudio /> },
              { path: "quiz", element: <QuizStudio /> },
              { path: "review", element: <ReviewStudio /> },
              { path: "trash", element: <TrashStudio /> },
              { path: "settings", element: <SettingsStudio /> },
            ],
          },
        ],
      },
      {
        path: "/accept-invite/:code",
        lazy: async () => {
          const { default: InvitePage } = await import("@/pages/Invite");
          return { element: <InvitePage /> };
        },
      },
      {
        path: "/settings/agents/builder",
        element: <AdminRoute Component={AgentBuilder} hideUserMenu={true} />,
      },
      {
        path: "/settings/agents/builder/:flowId",
        element: <AdminRoute Component={AgentBuilder} hideUserMenu={true} />,
      },
      {
        path: "/settings",
        element: <ManagerRoute Component={SettingsLayout} />,
        children: [
          { index: true, element: <Navigate to="llm-preference" replace /> },
          { path: "llm-preference", element: <GeneralLLMPreference /> },
          {
            path: "transcription-preference",
            element: <GeneralTranscriptionPreference />,
          },
          { path: "audio-preference", element: <GeneralAudioPreference /> },
          {
            path: "embedding-preference",
            element: <GeneralEmbeddingPreference />,
          },
          {
            path: "text-splitter-preference",
            element: <EmbeddingTextSplitterPreference />,
          },
          { path: "vector-database", element: <GeneralVectorDatabase /> },
          { path: "agents", element: <AdminAgents /> },
          { path: "event-logs", element: <AdminLogs /> },
          { path: "embed-chat-widgets", element: <ChatEmbedWidgets /> },
          { path: "security", element: <GeneralSecurity /> },
          { path: "privacy", element: <PrivacyAndData /> },
          { path: "interface", element: <InterfaceSettings /> },
          { path: "branding", element: <BrandingSettings /> },
          {
            path: "default-system-prompt",
            element: <DefaultSystemPrompt />,
          },
          { path: "chat", element: <ChatSettings /> },
          { path: "api-keys", element: <GeneralApiKeys /> },
          { path: "model-routers", element: <ModelRouters /> },
          { path: "model-routers/:id", element: <RouterRulesPage /> },
          {
            path: "system-prompt-variables",
            element: <SystemPromptVariables />,
          },
          {
            path: "browser-extension",
            element: <GeneralBrowserExtension />,
          },
          { path: "workspace-chats", element: <GeneralChats /> },
          { path: "workspaces", element: <AdminWorkspaces /> },
          {
            path: "external-connections/telegram",
            element: <TelegramBotSettings />,
          },
          { path: "scheduled-jobs", element: <ScheduledJobs /> },
          {
            path: "scheduled-jobs/:id/runs",
            element: <ScheduledJobRuns />,
          },
          {
            path: "scheduled-jobs/:id/runs/:runId",
            element: <ScheduledJobRunDetail />,
          },
        ],
      },
      // Onboarding Flow
      {
        path: "/onboarding",
        element: <OnboardingFlow />,
      },
      {
        path: "/onboarding/:step",
        element: <OnboardingFlow />,
      },
      // Catch-all route for 404s
      {
        path: "*",
        lazy: async () => {
          const { default: NotFound } = await import("@/pages/404");
          return { element: <NotFound /> };
        },
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <REACTWRAP>
    <RouterProvider router={router} />
  </REACTWRAP>
);
