// contact-form 插件 — 注册占位符 + 短代码过滤器
import { add_action, add_filter } from "@/lib/hooks";
import { register_placeholder } from "@/lib/placeholder-registry";

function renderContactForm(
  _attrs: Record<string, string>,
  config: Record<string, unknown>,
): string {
  const title = config.title || "联系我们";
  return `
<div class="cms-plugin contact-form bg-gray-50 rounded-lg p-6 my-8">
  <h3 class="text-lg font-bold mb-4">${title}</h3>
  <form class="space-y-3" action="/api/plugins/contact-form/submit" method="POST">
    <div>
      <input name="name" placeholder="姓名" class="w-full border rounded px-3 py-2 text-sm" required />
    </div>
    <div>
      <input name="email" type="email" placeholder="邮箱" class="w-full border rounded px-3 py-2 text-sm" required />
    </div>
    <div>
      <textarea name="message" placeholder="留言内容" rows="4" class="w-full border rounded px-3 py-2 text-sm" required></textarea>
    </div>
    <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded text-sm hover:bg-blue-700">发送留言</button>
  </form>
</div>`;
}

export default function register(config: Record<string, unknown>) {
  // ① 注册占位符
  add_action("register_placeholders", () => {
    register_placeholder("contact-form", renderContactForm, "contact-form",
      '在页面 HTML 中插入联系表单。支持通过 `data-cms-config` 自定义标题：\n\n' +
      '```html\n' +
      '<div data-cms-plugin="contact-form"></div>\n\n' +
      '<!-- 自定义标题 -->\n' +
      '<div data-cms-plugin="contact-form" data-cms-config=\'{"title":"商务合作"}\'></div>\n' +
      '```\n\n' +
      '也可使用短代码 `[contact-form]` 直接插入表单。'
    );
  });

  // ② 注册短代码 — 页面中写 [contact-form] 也可渲染
  add_filter("filter_page_content", (html: string) => {
    return html.replace(/\[contact-form\]/g, renderContactForm({}, config));
  });
}
