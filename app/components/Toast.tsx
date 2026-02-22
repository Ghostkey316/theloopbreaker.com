"use client";
import { useState, useEffect, useCallback } from "react";

interface ToastMessage {
  id: string;
  text: string;
  type: "info" | "success" | "warning";
}

let toastListeners: ((msg: ToastMessage) => void)[] = [];

export function showToast(text: string, type: "info" | "success" | "warning" = "info") {
  const msg: ToastMessage = { id: Date.now().toString(), text, type };
  toastListeners.forEach(fn => fn(msg));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((msg: ToastMessage) => {
    setToasts(prev => [...prev, msg]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== msg.id));
    }, 4000);
  }, []);

  useEffect(() => {
    toastListeners.push(addToast);
    return () => {
      toastListeners = toastListeners.filter(fn => fn !== addToast);
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  const colors = {
    info: { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.25)", text: "#93C5FD", icon: "#3B82F6" },
    success: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.25)", text: "#86EFAC", icon: "#22C55E" },
    warning: { bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.25)", text: "#FDBA74", icon: "#F97316" },
  };

  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, display: "flex", flexDirection: "column", gap: 8,
      maxWidth: 400, width: "calc(100% - 32px)",
    }}>
      {toasts.map(t => {
        const c = colors[t.type];
        return (
          <div key={t.id} style={{
            padding: "12px 16px", borderRadius: 12,
            background: c.bg, border: `1px solid ${c.border}`,
            backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            display: "flex", alignItems: "flex-start", gap: 10,
            animation: "fadeInUp 0.25s ease",
          }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c.icon} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              {t.type === "info" && <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></>}
              {t.type === "success" && <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>}
              {t.type === "warning" && <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>}
            </svg>
            <span style={{ fontSize: 13, color: c.text, lineHeight: 1.5 }}>{t.text}</span>
          </div>
        );
      })}
    </div>
  );
}
