// analytics 插件 — 向 wp_head 注入统计代码
import { add_filter } from "@/lib/hooks";

function gaScript(id: string): string {
  return `
<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${id}');
</script>`;
}

function baiduScript(id: string): string {
  return `
<script>
var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?${id}";
  var s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(hm, s);
})();
</script>`;
}

export default function register(config: Record<string, unknown>) {
  const provider = config.provider || "ga";
  const id = config.id as string;

  if (!id) return; // 未配置 ID 则不注入

  add_filter("wp_head", (head: string) => {
    if (provider === "baidu") return head + baiduScript(id);
    return head + gaScript(id);
  });
}
