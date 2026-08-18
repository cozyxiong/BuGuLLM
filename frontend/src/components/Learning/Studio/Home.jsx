import React from "react";
import { Link, useParams } from "react-router-dom";
import paths from "@/utils/paths";
import { useLearning, useActiveFilePaths } from "../LearningContext";
import {
  TreeStructure,
  Cards,
  Question,
  Brain,
  Trash,
  GearSix,
  GraduationCap,
  ArrowRight,
  FileText,
  Checks,
} from "@phosphor-icons/react";

const MODULES = [
  {
    key: "mindmap",
    title: "思维导图",
    desc: "把笔记结构整理成可浏览的知识树",
    icon: TreeStructure,
  },
  {
    key: "cards",
    title: "学习卡片",
    desc: "根据笔记生成问答卡，答案来自知识库",
    icon: Cards,
  },
  {
    key: "quiz",
    title: "测试",
    desc: "单选 / 多选自测，巩固笔记要点",
    icon: Question,
  },
  {
    key: "review",
    title: "复习",
    desc: "自由练习或开启间隔复习",
    icon: Brain,
  },
  {
    key: "trash",
    title: "回收站",
    desc: "已移除或待清理的学习项",
    icon: Trash,
  },
  {
    key: "settings",
    title: "设置",
    desc: "间隔复习等偏好",
    icon: GearSix,
  },
];

export default function StudioHome() {
  const { slug } = useParams();
  const { selectedFile, multiSelectMode, multiSelectPaths } = useLearning();
  const activePaths = useActiveFilePaths();

  return (
    <div className="h-full overflow-y-auto bg-theme-bg-secondary">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* 英雄区 — 对齐知识库空态 */}
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-theme-button-primary/10 flex items-center justify-center mb-4">
            <GraduationCap
              size={28}
              className="text-theme-button-primary"
              weight="duotone"
            />
          </div>
          <h1 className="text-lg sm:text-xl font-semibold text-theme-text-primary mb-1.5">
            学习
          </h1>
          <p className="text-sm text-theme-text-secondary leading-relaxed max-w-md mx-auto">
            在左侧选择笔记，生成导图、卡片与测试，结合知识库巩固理解，用于日常学习与复习。
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] text-theme-text-secondary bg-theme-settings-input-bg border border-theme-modal-border">
              <FileText size={12} weight="fill" className="text-theme-button-primary" />
              当前资料{" "}
              <strong className="text-theme-button-primary">{activePaths.length}</strong>
            </span>
            {multiSelectMode ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] text-theme-text-secondary bg-theme-settings-input-bg border border-theme-modal-border">
                <Checks size={12} className="text-theme-button-primary" />
                多选 · {multiSelectPaths.length} 项
              </span>
            ) : selectedFile ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] text-theme-text-secondary bg-theme-settings-input-bg border border-theme-modal-border max-w-[240px]">
                <span className="truncate">
                  {selectedFile.name || selectedFile.path}
                </span>
              </span>
            ) : (
              <span className="text-[11px] text-theme-text-secondary/70">
                未选择文档
              </span>
            )}
          </div>
        </div>

        {/* 模块卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {MODULES.map(({ key, title, desc, icon: Icon }) => (
            <Link
              key={key}
              to={paths.workspace.learning(slug, key)}
              className="group flex items-center gap-3 px-3.5 py-3 rounded-xl border border-theme-modal-border bg-theme-bg-primary hover:border-theme-button-primary/35 hover:bg-theme-file-picker-hover/40 transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-xl bg-theme-button-primary/10 flex items-center justify-center shrink-0 group-hover:bg-theme-button-primary/15 transition-colors">
                <Icon
                  className="w-[18px] h-[18px] text-theme-button-primary"
                  weight="duotone"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-theme-text-primary">
                  {title}
                </p>
                <p className="text-[11px] text-theme-text-secondary mt-0.5 truncate">
                  {desc}
                </p>
              </div>
              <ArrowRight
                className="w-4 h-4 text-theme-text-secondary opacity-40 group-hover:opacity-100 group-hover:text-theme-button-primary group-hover:translate-x-0.5 transition-all shrink-0"
                weight="bold"
              />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
