const API_BASE = 'http://localhost:3001';
const DB_NAME = 'kajdogaja-pwa';
const DB_VERSION = 1;

let db;
let jwtToken = localStorage.getItem('jwt_token');
let currentUser = null;

const apiFetch = async (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  if (jwtToken) {
    headers['Authorization'] = `Bearer ${jwtToken}`;
  }
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers
  });
  if (response.status === 401) {
    logout();
    throw new Error('Nepravilna prijava. Prosim, prijavite se znova.');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.napaka || 'Napaka pri zahtevku.');
  }
  return data;
};

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains('events')) {
        database.createObjectStore('events', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('syncQueue')) {
        database.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }
      if (!database.objectStoreNames.contains('notifications')) {
        database.createObjectStore('notifications', { keyPath: 'id' });
      }
    };
  });
};

const dbPut = (storeName, data) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const dbGetAll = (storeName) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const dbDelete = (storeName, key) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const dbClear = (storeName) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const showNotification = (title, options = {}) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      ...options
    });
  } else if ('Notification' in window && Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification(title, {
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          ...options
        });
      }
    });
  }
};

const showToast = (message, type = 'info') => {
  showNotification(message, { body: type === 'error' ? 'Napaka' : 'Uspešno' });
};

const initApp = async () => {
  try {
    db = await openDB();
  } catch (err) {
    console.error('Napaka pri odpiranju IndexedDB:', err);
  }

  await setupServiceWorker();
  setupEventListeners();
  setupKeyboardShortcuts();
  setupLazyLoading();
  setupOnlineSync();

  if (jwtToken) {
    await checkAuth();
  }

  await loadEvents();
  updateConnectionStatus();
};

const setupServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('service-worker.js');
      console.log('Service Worker registered:', registration);
      
      await navigator.serviceWorker.ready;
      console.log('Service Worker ready');
    } catch (err) {
      console.error('Service Worker registration failed:', err);
    }
  }
};

const setupEventListeners = () => {
  document.getElementById('btnAddEvent').addEventListener('click', () => openEventModal());
  document.getElementById('btnCloseModal').addEventListener('click', closeModal);
  document.getElementById('modalContainer').addEventListener('click', (e) => {
    if (e.target.id === 'modalContainer') closeModal();
  });
  document.getElementById('btnNotifications').addEventListener('click', () => openNotificationsModal());
  document.getElementById('btnUser').addEventListener('click', () => openAuthModal());
  
  document.getElementById('searchInput').addEventListener('input', debounce(handleSearch, 300));
  document.getElementById('filterCategory').addEventListener('change', handleSearch);
};

const setupKeyboardShortcuts = () => {
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        openEventModal();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        const activeForm = document.querySelector('.modal form');
        if (activeForm) activeForm.dispatchEvent(new Event('submit'));
      }
    }
    if (e.key === 'Escape') {
      closeModal();
    }
  });
};

const setupLazyLoading = () => {
  const lazyImages = document.querySelectorAll('img[data-src]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.onload = () => img.classList.add('loaded');
        img.onerror = () => img.classList.add('error');
        observer.unobserve(img);
      }
    });
  }, { rootMargin: '50px' });
  
  lazyImages.forEach(img => observer.observe(img));
};

const setupOnlineSync = () => {
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
};

const updateConnectionStatus = () => {
  const statusEl = document.getElementById('connectionStatus');
  if (!navigator.onLine) {
    statusEl.classList.remove('hidden');
    statusEl.textContent = 'Ni povezave. Podatki so iz lokalne shrambe.';
    statusEl.classList.add('offline');
  } else {
    statusEl.classList.add('hidden');
  }
};

const handleOffline = () => {
  updateConnectionStatus();
  showToast('Izgubljena povezava. Podatki se shranijo lokalno.', 'info');
};

const handleOnline = async () => {
  updateConnectionStatus();
  showToast('Povezava vzpostavljena. Poteka sinhronizacija...', 'info');
  await syncPendingChanges();
};

const loadEvents = async (query = '') => {
  const loadingEl = document.getElementById('loadingSpinner');
  const emptyEl = document.getElementById('emptyState');
  const listEl = document.getElementById('eventsList');
  
  listEl.innerHTML = '';
  loadingEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');
  
  try {
    let events;
    if (navigator.onLine) {
      const params = new URLSearchParams();
      if (query) params.append('iskanje', query);
      const category = document.getElementById('filterCategory').value;
      if (category) params.append('kategorija', category);
      
      const url = `/api/events${params.toString() ? '?' + params.toString() : ''}`;
      const data = await apiFetch(url);
      events = data.dogodki || [];
      
      await dbClear('events');
      for (const event of events) {
        await dbPut('events', event);
      }
    } else {
      events = await dbGetAll('events');
    }
    
    loadingEl.classList.add('hidden');
    
    if (events.length === 0) {
      emptyEl.classList.remove('hidden');
      return;
    }
    
    renderEvents(events);
    setupLazyLoading();
  } catch (err) {
    loadingEl.classList.add('hidden');
    const cachedEvents = await dbGetAll('events');
    if (cachedEvents.length > 0) {
      renderEvents(cachedEvents);
      showToast('Nalaganje iz lokalne shrambe.', 'info');
    } else {
      emptyEl.classList.remove('hidden');
      showToast(err.message, 'error');
    }
  }
};

const renderEvents = (events) => {
  const listEl = document.getElementById('eventsList');
  const template = document.getElementById('eventCardTemplate');
  
  listEl.innerHTML = '';
  
  events.forEach(event => {
    const card = template.content.cloneNode(true);
    
    const img = card.querySelector('img');
    if (event.qr_koda_url) {
      img.dataset.src = event.qr_koda_url;
    }
    img.alt = event.naziv;
    
    card.querySelector('.event-category').textContent = event.kategorija || '';
    card.querySelector('.event-title').textContent = event.naziv;
    card.querySelector('.event-date').textContent = formatDate(event.datum) + ' ob ' + event.ura;
    card.querySelector('.event-location').textContent = event.lokacija || event.mesto || '';
    card.querySelector('.event-description').textContent = event.opis || '';
    card.querySelector('.event-organizer').textContent = 'Organizator: ' + event.organizator;
    card.querySelector('.event-spots').textContent = event.stevilo_prijav + '/' + event.kapaciteta + ' prijav';
    
    card.querySelector('.btn-edit').addEventListener('click', () => openEventModal(event));
    
    listEl.appendChild(card);
  });
};

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' });
};

const handleSearch = async () => {
  const query = document.getElementById('searchInput').value;
  await loadEvents(query);
};

const openEventModal = (event = null) => {
  if (!jwtToken) {
    showToast('Prosim, najprej se prijavite.', 'error');
    openAuthModal();
    return;
  }
  
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const template = document.getElementById('eventModalTemplate');
  
  modalTitle.textContent = event ? 'Uredi dogodek' : 'Nov dogodek';
  modalBody.innerHTML = '';
  modalBody.appendChild(template.content.cloneNode(true));
  
  const form = document.getElementById('eventForm');
  const btnDelete = document.getElementById('btnDeleteEvent');
  
  if (event) {
    form.dataset.eventId = event.id;
    document.getElementById('eventTitle').value = event.naziv || '';
    document.getElementById('eventDescription').value = event.opis || '';
    document.getElementById('eventDate').value = event.datum || '';
    document.getElementById('eventTime').value = event.ura || '';
    document.getElementById('eventLocation').value = event.lokacija || '';
    document.getElementById('eventCapacity').value = event.kapaciteta || 0;
    document.getElementById('eventCategory').value = event.kategorija_id || '';
    document.getElementById('eventCity').value = event.mesto_id || '';
    document.getElementById('eventLat').value = event.koordinate_lat || '';
    document.getElementById('eventLng').value = event.koordinate_lng || '';
    btnDelete.classList.remove('hidden');
    btnDelete.onclick = () => deleteEvent(event.id);
  } else {
    form.dataset.eventId = '';
    form.reset();
    btnDelete.classList.add('hidden');
  }
  
  form.addEventListener('submit', handleEventSubmit);
  document.getElementById('btnCancelEvent').addEventListener('click', closeModal);
  
  document.getElementById('modalContainer').classList.remove('hidden');
};

const handleEventSubmit = async (e) => {
  e.preventDefault();
  
  const form = e.target;
  const errorEl = document.getElementById('eventError');
  const eventId = form.dataset.eventId;
  
  const data = {
    naziv: form.naziv.value,
    opis: form.opis.value,
    datum: form.datum.value,
    ura: form.ura.value,
    lokacija: form.lokacija.value,
    kapaciteta: parseInt(form.kapaciteta.value) || 0,
    kategorija_id: form.kategorija_id.value ? parseInt(form.kategorija_id.value) : null,
    mesto_id: form.mesto_id.value ? parseInt(form.mesto_id.value) : null,
    koordinate_lat: form.koordinate_lat.value ? parseFloat(form.koordinate_lat.value) : null,
    koordinate_lng: form.koordinate_lng.value ? parseFloat(form.koordinate_lng.value) : null
  };
  
  errorEl.classList.add('hidden');
  
  try {
    if (eventId) {
      await apiFetch(`/api/events/${eventId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      showToast('Dogodek posodobljen.', 'success');
    } else {
      await apiFetch('/api/events', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      showToast('Dogodek ustvarjen.', 'success');
    }
    
    closeModal();
    await loadEvents();
    await subscribeToPush();
  } catch (err) {
    if (!navigator.onLine) {
      await saveToSyncQueue(eventId ? 'update' : 'create', eventId || null, data);
      showToast('Shranjeno lokalno. Sinhronizacija ob ponovni povezavi.', 'info');
      closeModal();
      await loadEvents();
    } else {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    }
  }
};

const deleteEvent = async (eventId) => {
  if (!confirm('Ali res želite izbrisati ta dogodek?')) return;
  
  try {
    await apiFetch(`/api/events/${eventId}`, { method: 'DELETE' });
    showToast('Dogodek izbrisan.', 'success');
    closeModal();
    await loadEvents();
  } catch (err) {
    if (!navigator.onLine) {
      await saveToSyncQueue('delete', eventId, null);
      showToast('Brisanje shranjeno lokalno. Sinhronizacija ob ponovni povezavi.', 'info');
      closeModal();
      await loadEvents();
    } else {
      showToast(err.message, 'error');
    }
  }
};

const saveToSyncQueue = async (action, eventId, data) => {
  await dbPut('syncQueue', {
    action,
    eventId,
    data,
    createdAt: new Date().toISOString()
  });
};

const syncPendingChanges = async () => {
  const syncStatus = document.getElementById('syncStatus');
  syncStatus.classList.remove('hidden');
  
  const pendingChanges = await dbGetAll('syncQueue');
  
  for (const change of pendingChanges) {
    try {
      if (change.action === 'create') {
        await apiFetch('/api/events', {
          method: 'POST',
          body: JSON.stringify(change.data)
        });
      } else if (change.action === 'update') {
        await apiFetch(`/api/events/${change.eventId}`, {
          method: 'PUT',
          body: JSON.stringify(change.data)
        });
      } else if (change.action === 'delete') {
        await apiFetch(`/api/events/${change.eventId}`, { method: 'DELETE' });
      }
      
      await dbDelete('syncQueue', change.id);
    } catch (err) {
      console.error('Napaka pri sinhronizaciji:', err);
    }
  }
  
  syncStatus.classList.add('hidden');
  await loadEvents();
};

const openAuthModal = () => {
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const template = document.getElementById('authModalTemplate');
  
  modalTitle.textContent = 'Prijava / Registracija';
  modalBody.innerHTML = '';
  modalBody.appendChild(template.content.cloneNode(true));
  
  const form = document.getElementById('authForm');
  const tabs = document.querySelectorAll('.auth-tab');
  const authFields = document.getElementById('authFields');
  const submitBtn = document.getElementById('authSubmit');
  
  let isRegister = false;
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      isRegister = tab.dataset.tab === 'register';
      authFields.classList.toggle('hidden', !isRegister);
      submitBtn.textContent = isRegister ? 'Registracija' : 'Prijava';
    });
  });
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('authError');
    errorEl.classList.add('hidden');
    
    const username = form.username.value;
    const password = form.password.value;
    const email = form.email.value;
    
    try {
      if (isRegister) {
        const data = await apiFetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ uporabnisko_ime: username, geslo: password, email })
        });
        showToast('Registracija uspešna. Zdaj se prijavite.', 'success');
        tabs[0].click();
      } else {
        const data = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ uporabnisko_ime: username, geslo: password })
        });
        jwtToken = data.access_token;
        localStorage.setItem('jwt_token', jwtToken);
        currentUser = username;
        showToast('Uspešna prijava!', 'success');
        closeModal();
        await loadEvents();
      }
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    }
  });
  
  document.getElementById('modalContainer').classList.remove('hidden');
};

const openNotificationsModal = async () => {
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const template = document.getElementById('notificationsModalTemplate');
  
  modalTitle.textContent = 'Obvestila';
  modalBody.innerHTML = '';
  modalBody.appendChild(template.content.cloneNode(true));
  
  const notificationsList = document.getElementById('notificationsList');
  
  try {
    if (!jwtToken) {
      notificationsList.innerHTML = '<div class="empty-state"><p>Prosim, najprej se prijavite.</p></div>';
    } else {
      const data = await apiFetch('/api/notifications');
      const notifications = data.obvestila || [];
      
      if (notifications.length === 0) {
        notificationsList.innerHTML = '<div class="empty-state"><p>Ni obvestil.</p></div>';
      } else {
        notificationsList.innerHTML = '';
        for (const notif of notifications) {
          const item = document.createElement('div');
          item.className = 'notification-item' + (notif.prebrano ? '' : ' unread');
          item.innerHTML = `
            <div class="notification-title">${notif.tip}</div>
            <div class="notification-body">${notif.vsebina}</div>
            <div class="notification-time">${new Date(notif.ustvarjeno).toLocaleString('sl-SI')}</div>
          `;
          item.addEventListener('click', async () => {
            if (!notif.prebrano) {
              try {
                await apiFetch(`/api/notifications/${notif.id}/read`, { method: 'PUT' });
                notif.prebrano = 1;
                item.classList.remove('unread');
              } catch (err) {
                console.error(err);
              }
            }
          });
          notificationsList.appendChild(item);
        }
      }
    }
  } catch (err) {
    notificationsList.innerHTML = '<div class="empty-state"><p>Napaka pri nalaganju obvestil.</p></div>';
  }
  
  document.getElementById('modalContainer').classList.remove('hidden');
};

const closeModal = () => {
  document.getElementById('modalContainer').classList.add('hidden');
};

const logout = () => {
  jwtToken = null;
  currentUser = null;
  localStorage.removeItem('jwt_token');
};

const checkAuth = async () => {
  try {
    const data = await apiFetch('/api/me');
    currentUser = data.uporabnisko_ime || data.uporabniško_ime;
  } catch (err) {
    logout();
  }
};

const subscribeToPush = async () => {
  if (!jwtToken || !('serviceWorker' in navigator)) return;
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array('BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U')
    });
    
    await apiFetch('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription })
    });
    
    console.log('Push subscription saved');
  } catch (err) {
    console.error('Push subscription failed:', err);
  }
};

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

document.addEventListener('DOMContentLoaded', initApp);