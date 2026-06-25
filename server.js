require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });

const express = require('express');
const path = require('path');

const regrasHandler = require('./api/regras');
const importarHandler = require('./api/importar');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname)));

app.all('/api/regras', (req, res) => regrasHandler(req, res));

app.post('/api/importar', (req, res) => importarHandler(req, res));

app.listen(PORT, () => {
  console.log(`Vieira Importação rodando em http://localhost:${PORT}`);
});
