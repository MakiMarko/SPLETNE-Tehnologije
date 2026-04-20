const express = require('express');
const path = require('path');
const cors = require('cors');

const PORT = process.env.PORT || 3000;

const app = express();

app.use(cors());
app.use(express.static(path.join(__dirname, 'pwa')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'pwa', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PWA strežnik teče na http://localhost:${PORT}`);
  console.log(`API je na http://localhost:3001`);
  console.log(`\nOdprite http://localhost:${PORT} v brskalniku za PWA`);
});

module.exports = app;