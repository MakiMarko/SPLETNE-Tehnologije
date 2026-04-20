const express = require('express');
const db = require('../db/database');
const { zahtevajAvtentikacijo } = require('../middleware/auth');
const webpush = require('web-push');

const router = express.Router();

const PUBLIC_VAPID_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const PRIVATE_VAPID_KEY = 'UUxI4O8-FbRouAf7-7OTt9GH4o-5VtMuYKFBNhBIdc0';

webpush.setVapidDetails(
  'mailto:kajdogaja@example.com',
  PUBLIC_VAPID_KEY,
  PRIVATE_VAPID_KEY
);

const pushSubscriptions = new Map();

router.post('/subscribe', zahtevajAvtentikacijo, (req, res) => {
  const { subscription } = req.body;
  
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ napaka: 'Neveljaven subscription.', koda: 400 });
  }

  const uporabnikId = req.uporabnik.id;
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO push_subscriptions (uporabnik_id, endpoint, keys, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `);
  
  stmt.run(
    uporabnikId,
    subscription.endpoint,
    JSON.stringify(subscription.keys || {})
  );

  return res.status(201).json({ sporocilo: 'Subscription shranjen.' });
});

router.post('/send', zahtevajAvtentikacijo, async (req, res) => {
  const { title, body, url } = req.body;

  if (!title || !body) {
    return res.status(400).json({ napaka: 'Naslov in vsebina sta obvezna.', koda: 400 });
  }

  const subscriptions = db.prepare('SELECT * FROM push_subscriptions').all();
  
  const notificationPayload = JSON.stringify({
    title: title,
    body: body,
    url: url || '/',
    icon: '/icon-192.png',
    badge: '/icon-192.png'
  });

  let sentCount = 0;
  let failedCount = 0;

  for (const sub of subscriptions) {
    const subscription = {
      endpoint: sub.endpoint,
      keys: JSON.parse(sub.keys || '{}')
    };

    try {
      await webpush.sendNotification(subscription, notificationPayload);
      sentCount++;
    } catch (err) {
      console.error('Push notification failed:', err.message);
      failedCount++;
      if (err.statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
      }
    }
  }

  return res.json({ 
    sporocilo: 'Notifikacije poslane.',
    uspešnih: sentCount,
    neuspešnih: failedCount
  });
});

module.exports = router;
