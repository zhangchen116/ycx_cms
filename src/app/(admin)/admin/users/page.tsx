"use client";

import { useEffect, useState } from "react";

interface User {
  id: string;
  username: string;
  role: string;
  hasToken: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("EDITOR");
  const [loading, setLoading] = useState(false);
  const [pwdUser, setPwdUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [tokenUser, setTokenUser] = useState<User | null>(null);
  const [tokenValue, setTokenValue] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);

  const fetchUsers = () => fetch("/api/users").then((r) => r.json()).then(setUsers);
  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role }),
    });
    if (res.ok) {
      setUsername("");
      setPassword("");
      setRole("EDITOR");
      setShowForm(false);
      fetchUsers();
    } else {
      const data = await res.json();
      alert(data.error || "创建失败");
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该用户？")) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error);
    }
    fetchUsers();
  };

  const handleChangePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdUser || newPassword.length < 8) return;
    setPwdSaving(true);
    const res = await fetch(`/api/users/${pwdUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    if (res.ok) {
      setNewPassword("");
      setPwdUser(null);
    } else {
      const data = await res.json();
      alert(data.error || "修改失败");
    }
    setPwdSaving(false);
  };

  const handleGenerateToken = async () => {
    if (!tokenUser) return;
    setTokenLoading(true);
    const res = await fetch("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: tokenUser.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setTokenValue(data.token);
    } else {
      const data = await res.json();
      alert(data.error || "生成失败");
    }
    setTokenLoading(false);
  };

  const handleRevokeToken = async (userId: string) => {
    if (!confirm("确定吊销此用户的 API Token？吊销后使用该 Token 的 Agent 将无法访问。")) return;
    const res = await fetch("/api/auth/token", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      fetchUsers();
    } else {
      const data = await res.json();
      alert(data.error || "操作失败");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">用户管理</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          {showForm ? "取消" : "新建用户"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用户名"
              className="border rounded px-3 py-2 text-sm"
              required
              minLength={2}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码（≥8位）"
              className="border rounded px-3 py-2 text-sm"
              required
              minLength={8}
            />
            <select value={role} onChange={(e) => setRole(e.target.value)} className="border rounded px-3 py-2 text-sm">
              <option value="SUPER_ADMIN">超级管理员</option>
              <option value="ADMIN">管理员</option>
              <option value="EDITOR">编辑者</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-3 bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "创建中..." : "创建"}
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2">用户名</th>
              <th className="text-left px-4 py-2">角色</th>
              <th className="text-left px-4 py-2">API Token</th>
              <th className="text-left px-4 py-2">创建时间</th>
              <th className="text-right px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-2 font-medium">{u.username}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    u.role === "SUPER_ADMIN" ? "bg-red-100 text-red-700" :
                    u.role === "ADMIN" ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {u.role === "SUPER_ADMIN" ? "超级管理员" : u.role === "ADMIN" ? "管理员" : "编辑者"}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {u.hasToken ? (
                    <span className="text-green-600 text-xs">● 已启用</span>
                  ) : (
                    <span className="text-gray-400 text-xs">○ 未启用</span>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-500 text-xs">
                  {new Date(u.createdAt).toLocaleDateString("zh-CN")}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => { setTokenUser(u); setTokenValue(""); }}
                    className="text-green-600 hover:underline text-xs mr-3"
                  >
                    Token
                  </button>
                  {u.hasToken && (
                    <button
                      onClick={() => handleRevokeToken(u.id)}
                      className="text-orange-600 hover:underline text-xs mr-3"
                    >
                      吊销
                    </button>
                  )}
                  <button onClick={() => { setPwdUser(u); setNewPassword(""); }} className="text-blue-600 hover:underline text-xs mr-3">改密</button>
                  <button onClick={() => handleDelete(u.id)} className="text-red-600 hover:underline text-xs">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 修改密码弹窗 */}
      {pwdUser && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">
              修改密码 — {pwdUser.username}
            </h3>
            <form onSubmit={handleChangePwd}>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="新密码（≥8位）"
                className="w-full border rounded px-3 py-2 text-sm mb-4"
                required
                minLength={8}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setPwdUser(null); setNewPassword(""); }}
                  className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={pwdSaving || newPassword.length < 8}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {pwdSaving ? "保存中..." : "确认修改"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* API Token 弹窗 */}
      {tokenUser && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[500px] shadow-xl">
            <h3 className="text-lg font-semibold mb-3">
              API Token — {tokenUser.username}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              生成 Token 后请立即复制保存，关闭弹窗后将无法再次查看完整 Token。
              <br />
              使用方式：请求头加入 <code className="bg-gray-100 px-1 rounded">Authorization: Bearer &lt;token&gt;</code>
            </p>

            {tokenValue ? (
              <>
                <div className="bg-green-50 border border-green-200 rounded p-3 mb-4">
                  <code className="text-sm text-green-800 break-all select-all">{tokenValue}</code>
                </div>
                <p className="text-xs text-green-600 mb-4">✅ Token 已生成，请复制保存</p>
              </>
            ) : tokenUser.hasToken ? (
              <p className="text-xs text-amber-600 mb-4">⚠️ 当前已有 Token，重新生成将使旧 Token 失效</p>
            ) : null}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setTokenUser(null); setTokenValue(""); }}
                className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
              >
                关闭
              </button>
              {!tokenValue && (
                <button
                  onClick={handleGenerateToken}
                  disabled={tokenLoading}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {tokenLoading ? "生成中..." : tokenUser.hasToken ? "重新生成" : "生成 Token"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
