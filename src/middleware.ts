import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { appendFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

export const runtime = "nodejs";

const LOG_DIR = join(tmpdir(), "cms-logs");
let dirInitialized = false;

async function ensureDir() {
  if (dirInitialized) return;
  await mkdir(LOG_DIR, { recursive: true });
  dirInitialized = true;
}

function writeLog(line: string) {
  // fire-and-forget: 不阻塞中间件返回
  (async () => {
    try {
      await ensureDir();
      const dateStr = new Date().toISOString().slice(0, 10);
      await appendFile(join(LOG_DIR, `${dateStr}.log`), line + "\n", "utf-8");
    } catch {
      // 静默失败，不影响业务
    }
  })();
}

export async function middleware(req: NextRequest) {
  const method = req.method;
  const path = req.nextUrl.pathname;
  const timestamp = new Date().toISOString();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  let bodySize = "-";
  if (["POST", "PUT", "PATCH"].includes(method)) {
    const contentLength = req.headers.get("content-length");
    bodySize = contentLength ? `${(parseInt(contentLength) / 1024).toFixed(1)}KB` : "-";
  }

  // 记录入站请求
  const reqLog = `[${timestamp}] ${method} ${path} | IP: ${ip} | Size: ${bodySize}`;
  console.log(reqLog);
  writeLog(reqLog);

  // 放行请求并监听响应完成
  const res = NextResponse.next();

  // 尝试在响应头中标记开始时间，供下游使用
  // 注意：Edge/Middleware 中无法直接拦截响应体获取 status code
  // 完整的响应日志需在 API Route 层面实现

  return res;
}

// 配置中间件匹配的路径（排除静态资源）
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
