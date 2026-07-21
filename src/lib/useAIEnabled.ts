import { useEffect, useState } from "react";

/** 读取 .env AI_ENABLED 配置，决定是否展示 AI 相关 UI */
export function useAIEnabled() {
  const [aiEnabled, setAiEnabled] = useState(true);

  useEffect(() => {
    fetch("/api/settings/site")
      .then((r) => r.json())
      .then((d) => setAiEnabled(d.aiEnabled ?? true));
  }, []);

  return aiEnabled;
}
