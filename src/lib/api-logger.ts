import { appendFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const LOG_DIR = join(tmpdir(), "cms-logs");
let dirInitialized = false;

async function ensureDir() {
  if (dirInitialized) return;
  await mkdir(LOG_DIR, { recursive: true });
  dirInitialized = true;
}

function writeLog(line: string) {
  // fire-and-forget: 不阻塞请求响应
  (async () => {
    try {
      await ensureDir();
      const dateStr = new Date().toISOString().slice(0, 10);
      await appendFile(join(LOG_DIR, `${dateStr}.log`), line + "\n", "utf-8");
    } catch {
      // 静默失败
    }
  })();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiHandler = (...args: any[]) => Promise<Response>;

/**
 * 包装 API Route handler，自动记录响应状态码和耗时
 *
 * 用法：
 *   export const GET = withLogging(async (req) => { ... });
 *   export const POST = withLogging(async (req) => { ... });
 */
export function withLogging(handler: ApiHandler): ApiHandler {
  return async (...args) => {
    const start = Date.now();
    // 第一个参数是 Request 对象
    const req = args[0] as Request;
    const method = req.method;
    const url = new URL(req.url);
    const path = url.pathname;
    const timestamp = new Date().toISOString();
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    let bodySize = "-";
    if (["POST", "PUT", "PATCH"].includes(method)) {
      const cl = req.headers.get("content-length");
      bodySize = cl ? `${(parseInt(cl) / 1024).toFixed(1)}KB` : "-";
    }

    try {
      const res = await handler(...args);
      const duration = Date.now() - start;
      const status = res.status;

      const logLine =
        status >= 400
          ? `[${timestamp}] ${method} ${path} → ${status} (${duration}ms) | IP: ${ip} | Size: ${bodySize} ⚠️`
          : `[${timestamp}] ${method} ${path} → ${status} (${duration}ms) | IP: ${ip} | Size: ${bodySize}`;

      console.log(logLine);
      writeLog(logLine);

      return res;
    } catch (error) {
      const duration = Date.now() - start;
      const timestamp = new Date().toISOString();
      const logLine = `[${timestamp}] ${method} ${path} → ERROR (${duration}ms) | IP: ${ip} | Size: ${bodySize}`;
      console.error(logLine, error);
      writeLog(`${logLine} | Error: ${error}`);

      throw error;
    }
  };
}
