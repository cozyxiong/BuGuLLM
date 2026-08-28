import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, WarningCircle, X } from "@phosphor-icons/react";
import {
  subscribeGenerateJobs,
  dismissGenerateJob,
  requestPlayGenerated,
} from "./generateJobs";

export default function LearningGenerateNotice() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);

  useEffect(() => subscribeGenerateJobs(setJobs), []);

  const visible = jobs.filter((j) => j.status === "done" || j.status === "error");
  if (!visible.length) return null;

  return (
    <div className="fixed top-4 right-4 z-[10060] flex flex-col gap-2 w-[min(22rem,calc(100vw-2rem))] pointer-events-none">
      {visible.map((job) => {
        const ok = job.status === "done";
        return (
          <div
            key={job.id}
            className="pointer-events-auto relative rounded-xl border border-theme-modal-border bg-theme-bg-primary shadow-lg overflow-hidden"
          >
            <button
              type="button"
              onClick={() => {
                if (ok) {
                  requestPlayGenerated(job);
                  if (job.href) navigate(job.href);
                }
                dismissGenerateJob(job.id);
              }}
              className="w-full text-left px-3.5 py-3 flex items-start gap-2.5 hover:bg-theme-file-picker-hover/50 transition-colors"
            >
              {ok ? (
                <CheckCircle
                  className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5"
                  weight="fill"
                />
              ) : (
                <WarningCircle
                  className="w-5 h-5 text-red-400 shrink-0 mt-0.5"
                  weight="fill"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-theme-text-primary">
                  {ok ? `${job.label}已生成` : `${job.label}生成失败`}
                </p>
                <p className="text-[11px] text-theme-text-secondary mt-0.5 leading-relaxed">
                  {ok
                    ? job.truncated
                      ? `已生成 ${job.count}/${job.requested} ${job.kind === "cards" ? "张" : job.kind === "quiz" ? "道" : "份"}，点击查看`
                      : `点击查看${job.label}`
                    : job.error || "请重试"}
                </p>
              </div>
            </button>
            <button
              type="button"
              aria-label="关闭"
              onClick={() => dismissGenerateJob(job.id)}
              className="absolute top-2 right-2 p-1 rounded-md text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-file-picker-hover"
            >
              <X className="w-3.5 h-3.5" weight="bold" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
