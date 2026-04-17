/**
 * NetworkContext.jsx
 *
 * 全局网络状态管理 + 断网任务自动同步引擎。
 * 必须挂载在 <ToastProvider> 内部，以便内部使用 useToast()。
 *
 * 用法：
 *   <ToastProvider>
 *     <NetworkProvider>
 *       ...
 *     </NetworkProvider>
 *   </ToastProvider>
 *
 * 消费：
 *   const { isOnline, pendingCount, isSyncing, refreshCount, triggerSync } = useNetwork();
 */

import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef,
} from 'react';
import {
  getPendingTasks, getPendingCount, deleteTask,
  updateTaskStatus, resetStuckTasks,
} from '../utils/offlineDB';
import { detectImages } from '../api/client';
import { useToast } from './ToastContext';

const NetworkCtx = createContext(null);

export function NetworkProvider({ children }) {
  const toast = useToast();

  const [isOnline,     setIsOnline]     = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing,    setIsSyncing]    = useState(false);

  // 防止并发同步
  const syncingRef = useRef(false);

  // ── 刷新本地待传数量 ─────────────────────────────────────────
  const refreshCount = useCallback(async () => {
    try {
      const n = await getPendingCount();
      setPendingCount(n);
    } catch { /* IndexedDB 不可用时静默忽略 */ }
  }, []);

  // ── 核心同步逻辑 ─────────────────────────────────────────────
  const triggerSync = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;

    const tasks = await getPendingTasks();
    if (tasks.length === 0) return;

    syncingRef.current = true;
    setIsSyncing(true);

    let successCount = 0;
    let failCount    = 0;

    for (const task of tasks) {
      try {
        // 标记为"同步中"（防止重复拾取）
        await updateTaskStatus(task.id, 'syncing');

        // 从 ArrayBuffer 还原 File 对象
        const files = task.files.map(
          (f) => new File([f.data], f.name, { type: f.type })
        );

        // 调用检测接口（后端会写入 GIS 记录）
        await detectImages(files);

        // 成功：移除本地记录
        await deleteTask(task.id);
        successCount++;
      } catch (err) {
        // 失败：重置为 pending，下次重试
        await updateTaskStatus(task.id, 'pending').catch(() => {});
        failCount++;
        console.warn('[LightScan] 离线任务同步失败:', err);
      }
    }

    setIsSyncing(false);
    syncingRef.current = false;
    refreshCount();

    if (successCount > 0) {
      toast(
        `离线任务已同步：${successCount} 批检测数据上传成功`,
        'success',
        6000,
      );
    }
    if (failCount > 0) {
      toast(
        `${failCount} 批任务上传失败，将在下次联网时自动重试`,
        'warn',
        6000,
      );
    }
  }, [refreshCount, toast]);

  // ── 监听 online / offline 事件 ───────────────────────────────
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      // 恢复时先重置上次异常中断的 syncing 任务
      await resetStuckTasks().catch(() => {});
      const count = await getPendingCount().catch(() => 0);
      if (count > 0) {
        toast(`网络已恢复，正在同步 ${count} 条离线巡检数据…`, 'info', 3500);
        triggerSync();
      } else {
        toast('网络已恢复', 'success', 2500);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast('网络已断开，检测任务将缓存至本地，恢复后自动上传', 'warn', 5000);
    };

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    // 启动时修复上次崩溃留下的 syncing 状态，并刷新计数
    resetStuckTasks().catch(() => {});
    refreshCount();

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshCount, triggerSync, toast]);

  return (
    <NetworkCtx.Provider value={{
      isOnline,
      pendingCount,
      isSyncing,
      refreshCount,
      triggerSync,
    }}>
      {children}
    </NetworkCtx.Provider>
  );
}

export function useNetwork() {
  const ctx = useContext(NetworkCtx);
  if (!ctx) throw new Error('useNetwork must be used inside NetworkProvider');
  return ctx;
}
