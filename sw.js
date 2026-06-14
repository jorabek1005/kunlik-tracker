const DB_NAME = 'tracker-db';

function openDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('data');
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject();
  });
}

async function getStoredTasks(){
  try {
    const db = await openDB();
    return new Promise(resolve => {
      const tx = db.transaction('data', 'readonly');
      const req = tx.objectStore('data').get('tasks');
      req.onsuccess = () => resolve(req.result || []);
      req.onerror  = () => resolve([]);
    });
  } catch(e){ return []; }
}

async function getFired(){
  try {
    const db = await openDB();
    const today = new Date().toISOString().split('T')[0];
    return new Promise(resolve => {
      const tx = db.transaction('data', 'readonly');
      const req = tx.objectStore('data').get('fired_' + today);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror  = () => resolve([]);
    });
  } catch(e){ return []; }
}

async function saveFired(list){
  try {
    const db = await openDB();
    const today = new Date().toISOString().split('T')[0];
    const tx = db.transaction('data', 'readwrite');
    tx.objectStore('data').put(list, 'fired_' + today);
  } catch(e){}
}

async function checkAndNotify(){
  const tasks  = await getStoredTasks();
  const fired  = await getFired();
  const today  = new Date().toISOString().split('T')[0];
  const newFired = [...fired];

  for(const t of tasks){
    if(t.done || fired.includes(t.id)) continue;

    if(t.due === today){
      await self.registration.showNotification('📅 Bugun bajarish kerak!', {
        body: t.name,
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📋</text></svg>",
        tag: 'task-' + t.id,
        renotify: false
      });
      newFired.push(t.id);
    } else if(t.due && t.due < today){
      await self.registration.showNotification('⚠️ Muddati o\'tgan vazifa!', {
        body: t.name + ' (' + t.due + ')',
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚠️</text></svg>",
        tag: 'overdue-' + t.id,
        renotify: false
      });
      newFired.push(t.id);
    }
  }

  await saveFired(newFired);
}

// Periodic Background Sync (Chrome Android)
self.addEventListener('periodicsync', event => {
  if(event.tag === 'check-tasks'){
    event.waitUntil(checkAndNotify());
  }
});

// Notification bosilganda appni och
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({type:'window'}).then(list => {
      if(list.length) return list[0].focus();
      return clients.openWindow('/tracker.html');
    })
  );
});

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(self.clients.claim()));
