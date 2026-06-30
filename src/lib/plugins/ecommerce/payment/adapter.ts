/**
 * 支付适配层
 *
 * 统一支付接口，方便以后接入微信支付、支付宝、Stripe 等多种支付渠道。
 * 当前微信支付为 stub 占位，待配置后接入真实 API。
 */

import { exec } from "../lib/db";

// ──── 类型定义 ────

export interface PaymentConfig {
  /** 支付渠道标识：wechat / alipay / stripe */
  provider: string;
  /** 是否启用支付 */
  enabled: boolean;
  [key: string]: unknown;
}

export interface CreateOrderParams {
  outTradeNo: string;
  amount: number;       // 元
  description: string;
  payType: PayType;
  notifyUrl: string;
  expireAt: string;     // ISO-8601
  /** 客户端 IP（微信 H5/JSAPI 需要） */
  clientIp?: string;
  /** 微信 openid（JSAPI 需要） */
  openid?: string;
}

export interface CreateOrderResult {
  prepayId: string;
  payType: PayType;
  /** Native 支付二维码链接 */
  qrCodeUrl?: string;
  /** H5 支付跳转链接 */
  h5PayUrl?: string;
  /** JSAPI 支付参数 */
  jsapiParams?: Record<string, string>;
}

export interface QueryOrderResult {
  outTradeNo: string;
  transactionId?: string;
  status: PaymentStatus;
  amount: number;
  paidAt?: string;
}

export interface NotifyResult {
  outTradeNo: string;
  transactionId: string;
  amount: number;       // 元
  /** 回调原始数据 */
  rawData: Record<string, unknown>;
}

export type PayType = "NATIVE" | "H5" | "JSAPI";
export type PaymentStatus = "PENDING" | "PAID" | "EXPIRED" | "CLOSED" | "REFUNDED";

// ──── 适配器接口 ────

export interface PaymentAdapter {
  /** 适配器名称 */
  readonly name: string;
  /** 统一下单 → 返回 prepay_id + 支付参数 */
  createOrder(config: Record<string, unknown>, params: CreateOrderParams): Promise<CreateOrderResult>;
  /** 查询支付状态 */
  queryOrder(config: Record<string, unknown>, outTradeNo: string): Promise<QueryOrderResult>;
  /** 验证回调签名 */
  verifyNotify(config: Record<string, unknown>, body: unknown, headers: Record<string, string>): Promise<NotifyResult>;
  /** 测试连接是否可用 */
  testConnection(config: Record<string, unknown>): Promise<{ ok: boolean; message: string }>;
}

// ──── 适配器注册表 ────

const adapters = new Map<string, PaymentAdapter>();

export function registerAdapter(name: string, adapter: PaymentAdapter) {
  adapters.set(name, adapter);
  console.log(`[payment] 注册支付适配器: ${name}`);
}

export function getAdapter(name: string): PaymentAdapter | undefined {
  return adapters.get(name);
}

export function listAdapters(): string[] {
  return Array.from(adapters.keys());
}

// ──── WeChat Pay Stub ────

const wechatAdapter: PaymentAdapter = {
  name: "wechat",

  async createOrder(config, params) {
    // TODO: 接入微信支付 APIv3
    // 1. 读取私钥：config.privateKeyPath
    // 2. 构建签名（RSA-SHA256 with 商户私钥）
    // 3. 构建请求体：{ appid, mchid, description, out_trade_no, notify_url, amount: { total, currency }, ... }
    // 4. POST https://api.mch.weixin.qq.com/v3/pay/transactions/{native|h5|jsapi}
    // 5. 解析响应获取 prepay_id

    const prepayId = `wx_prepay_${params.outTradeNo}_${Date.now()}`;
    console.log(`[payment:wechat] stub createOrder → ${prepayId} (amount=¥${params.amount.toFixed(2)}, type=${params.payType})`);

    // 更新 payType
    await exec("UPDATE PaymentRecord SET payType = ? WHERE outTradeNo = ?", params.payType, params.outTradeNo);

    return {
      prepayId,
      payType: params.payType,
      qrCodeUrl: params.payType === "NATIVE" ? `weixin://wxpay/bizpayurl?pr=${prepayId}` : undefined,
      h5PayUrl: params.payType === "H5" ? `https://wx.tenpay.com/h5/?prepay_id=${prepayId}` : undefined,
    };
  },

  async queryOrder(_config, outTradeNo) {
    // TODO: GET /v3/pay/transactions/out-trade-no/{out_trade_no}
    console.log(`[payment:wechat] stub queryOrder → ${outTradeNo}`);
    return { outTradeNo, status: "PENDING", amount: 0 };
  },

  async verifyNotify(config, body, headers) {
    // TODO: 验证微信回调签名
    // 1. 从 headers 获取 Wechatpay-Signature / Wechatpay-Timestamp / Wechatpay-Nonce / Wechatpay-Serial
    // 2. 构建验签串：timestamp\nnonce\nbody\n
    // 3. 用微信平台公钥验签
    // 4. 用 APIv3Key (AES-256-GCM) 解密 resource.ciphertext
    // 5. 返回明文数据

    const data = body as Record<string, unknown>;
    console.log(`[payment:wechat] stub verifyNotify → out_trade_no=${data.out_trade_no}`);

    if (!data.out_trade_no) {
      throw new Error("缺少 out_trade_no");
    }

    return {
      outTradeNo: data.out_trade_no as string,
      transactionId: (data.transaction_id as string) || `wx_txn_${Date.now()}`,
      amount: data.amount_total ? Number(data.amount_total) / 100 : 0,
      rawData: data,
    };
  },

  async testConnection(config) {
    // TODO: 调用微信支付查询接口验证配置正确性
    const missing: string[] = [];
    if (!config.appId) missing.push("AppID");
    if (!config.mchId) missing.push("商户号");
    if (!config.serialNo) missing.push("证书序列号");
    if (!config.privateKeyPath) missing.push("私钥路径");
    if (!config.apiV3Key) missing.push("APIv3密钥");

    if (missing.length > 0) {
      return { ok: false, message: `缺少配置: ${missing.join(", ")}` };
    }
    return { ok: true, message: "配置完整（stub 模式，未实际连接微信服务器）" };
  },
};

// ──── 初始化：注册默认适配器 ────

registerAdapter("wechat", wechatAdapter);
