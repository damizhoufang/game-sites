// 手机版搬到了 mobile/。这个文件只用来清理旧地址留下的离线缓存：
// 已经把旧地址添加到主屏幕的手机，下次联网打开时会删掉旧缓存并注销自己。
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => /^xiaoyang-\d+$/.test(k)).map(k => caches.delete(k))))
      .then(() => self.registration.unregister())
  );
});
