type HookCallback = (...args: any[]) => any | Promise<any>;

interface HookEntry {
  callback: HookCallback;
  priority: number;
}

const actions = new Map<string, HookEntry[]>();
const filters = new Map<string, HookEntry[]>();

function _register(map: Map<string, HookEntry[]>, hook: string, callback: HookCallback, priority = 10) {
  const list = map.get(hook) || [];
  list.push({ callback, priority });
  list.sort((a, b) => a.priority - b.priority);
  map.set(hook, list);
}

/** 注册 Action（无返回值） */
export function add_action(hook: string, callback: HookCallback, priority = 10) {
  _register(actions, hook, callback, priority);
}

/** 注册 Filter（链式传递返回值） */
export function add_filter(hook: string, callback: HookCallback, priority = 10) {
  _register(filters, hook, callback, priority);
}

/** 触发 Action */
export async function do_action(hook: string, ...args: any[]) {
  for (const entry of actions.get(hook) || []) {
    await entry.callback(...args);
  }
}

/** 触发 Filter，链式传递 */
export async function apply_filters(hook: string, value: any, ...args: any[]) {
  for (const entry of filters.get(hook) || []) {
    value = await entry.callback(value, ...args);
  }
  return value;
}

/** 是否有已注册的 action */
export function has_action(hook: string): boolean {
  return (actions.get(hook)?.length || 0) > 0;
}

/** 是否有已注册的 filter */
export function has_filter(hook: string): boolean {
  return (filters.get(hook)?.length || 0) > 0;
}
