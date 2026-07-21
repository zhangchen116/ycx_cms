"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAIEnabled } from "@/lib/useAIEnabled";

interface User {
  id: string;
  username: string;
  role: string;
}

function buildNav(aiEnabled: boolean) {
  const items = [
    { href: "/admin", label: "仪表盘" },
    { href: "/admin/homepage", label: "首页" },
    { href: "/admin/categories", label: "分类" },
    { href: "/admin/pages", label: "独立页" },
    { href: "/admin/posts", label: "帖子" },
    { href: "/admin/tags", label: "标签" },
  ];
  if (aiEnabled) items.push({ href: "/admin/skills", label: "技能管理" });
  items.push({ href: "/admin/settings", label: "设置" });
  return items;
}

interface PluginMenuItem {
  slug: string;
  label: string;
  icon?: string;
  subPages?: { slug: string; label: string }[];
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pluginMenus, setPluginMenus] = useState<PluginMenuItem[]>([]);
  const aiEnabled = useAIEnabled();
  const router = useRouter();
  const pathname = usePathname();
  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (isLogin) {
      setLoading(false);
      return;
    }
    fetch("/api/auth", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) {
          router.push("/admin/login");
        } else {
          setUser(data.user);
        }
      })
      .finally(() => setLoading(false));

    // 加载插件菜单
    fetch("/api/admin/menu")
      .then((r) => r.json())
      .then(setPluginMenus)
      .catch(() => {});
  }, [router, isLogin]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  // 登录页直接渲染
  if (isLogin) return <>{children}</>;

  if (loading) return <div className="flex h-screen items-center justify-center">加载中...</div>;
  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r p-4 flex flex-col">
        <div className="text-lg font-bold mb-6">AI CMS</div>
        <nav className="flex-1 space-y-1">
          {buildNav(aiEnabled).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded text-sm ${
                pathname === item.href ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {item.label}
            </Link>
          ))}
          {/* 插件菜单 */}
          {pluginMenus.length > 0 && (
            <>
              <div className="mx-3 my-2 border-t border-gray-100" />
              {pluginMenus.map((item) => {
                const hasSubPages = item.subPages && item.subPages.length > 0;
                const isActive = pathname === `/admin/plugin/${item.slug}` || pathname.startsWith(`/admin/plugin/${item.slug}/`);
                return (
                  <div key={item.slug}>
                    <Link
                      href={hasSubPages ? `#` : `/admin/plugin/${item.slug}`}
                      onClick={(e) => {
                        if (hasSubPages) {
                          e.preventDefault();
                          const sub = document.getElementById(`plugin-sub-${item.slug}`);
                          if (sub) sub.classList.toggle("hidden");
                        }
                      }}
                      className={`block px-3 py-2 rounded text-sm cursor-pointer ${
                        isActive ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {item.icon && <span className="mr-2">{item.icon}</span>}
                      {item.label}
                      {hasSubPages && (
                        <span className="float-right text-xs text-gray-400">▼</span>
                      )}
                    </Link>
                    {hasSubPages && (
                      <div id={`plugin-sub-${item.slug}`} className={`ml-4 space-y-0.5 ${isActive ? "" : "hidden"}`}>
                        {item.subPages!.map((sub) => (
                          <Link
                            key={sub.slug}
                            href={`/admin/plugin/${item.slug}/${sub.slug}`}
                            className={`block px-3 py-1.5 rounded text-sm ${
                              pathname === `/admin/plugin/${item.slug}/${sub.slug}`
                                ? "bg-blue-50 text-blue-700 font-medium"
                                : "text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {sub.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
          {user.role === "SUPER_ADMIN" && (
            <Link
              href="/admin/users"
              className={`block px-3 py-2 rounded text-sm ${
                pathname === "/admin/users" ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              用户管理
            </Link>
          )}
        </nav>
        <div className="border-t pt-3">
          <div className="text-sm text-gray-600 mb-1">{user.username}</div>
          <div className="text-xs text-gray-400 mb-2">{user.role}</div>
          <button onClick={handleLogout} className="text-sm text-red-600 hover:underline">
            退出登录
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
