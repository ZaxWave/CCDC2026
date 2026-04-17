/**
 * offlineDB.js
 * 轻量级 IndexedDB 封装，用于断网缓存巡检任务。
 *
 * Store schema (offline_records):
 *   id        — auto-increment PK
 *   files     — Array<{ name, type, data: ArrayBuffer }>
 *   queuedAt  — timestamp (ms)
 *   status    — 'pending' | 'syncing' | 'failed'
 */

const DB_NAME    = 'lightscan_offline';
const DB_VERSION = 1;
const STORE      = 'offline_records';

// ── 打开 / 初始化 DB ──────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('此浏览器不支持 IndexedDB'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        // 按 status 索引，方便批量读取 pending
        store.createIndex('status', 'status', { unique: false });
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

// ── 将 File[] 持久化到本地 ────────────────────────────────────
export async function saveOfflineTask(files) {
  // 将 File 对象转为可序列化的 ArrayBuffer，防止刷新后丢失
  const fileData = await Promise.all(
    Array.from(files).map(async (f) => ({
      name: f.name,
      type: f.type,
      data: await f.arrayBuffer(),
    }))
  );

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).add({
      files:     fileData,
      queuedAt:  Date.now(),
      status:    'pending',
    });
    req.onsuccess = () => resolve(req.result); // returns new id
    req.onerror   = () => reject(req.error);
  });
}

// ── 读取所有 pending 任务 ─────────────────────────────────────
export async function getPendingTasks() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).index('status').getAll('pending');
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── 计算 pending 数量 ─────────────────────────────────────────
export async function getPendingCount() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).index('status').count('pending');
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

// ── 更新单条任务的状态 ────────────────────────────────────────
export async function updateTaskStatus(id, status) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req   = store.get(id);
    req.onsuccess = () => {
      const record = req.result;
      if (record) {
        record.status = status;
        store.put(record);
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

// ── 删除单条任务（同步成功后调用）───────────────────────────────
export async function deleteTask(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ── 将所有 syncing 状态（异常中断的）重置为 pending ─────────────
export async function resetStuckTasks() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req   = store.index('status').getAll('syncing');
    req.onsuccess = () => {
      const stuck = req.result;
      stuck.forEach((r) => { r.status = 'pending'; store.put(r); });
      resolve(stuck.length);
    };
    req.onerror = () => reject(req.error);
  });
}
