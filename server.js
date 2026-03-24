const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Permite que o servidor leia JSON e sirva a pasta atual (HTML, CSS, JS)
app.use(express.json());
app.use(express.static(__dirname));

const DB_PATH = path.join(__dirname, 'vtt-db.json');

// Cria o arquivo de banco de dados vazio se ele não existir
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify([]));
}

// ==========================================
// API REST - Banco de Dados das Campanhas
// ==========================================

// Rota para LER o banco de dados
app.get('/api/campaigns', (req, res) => {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        console.error("Erro ao ler o banco:", err);
        res.status(500).json({ error: "Erro ao ler o banco de dados." });
    }
});

// Rota para SALVAR (sobrescrever) o banco de dados
app.post('/api/campaigns', (req, res) => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao salvar o banco:", err);
        res.status(500).json({ error: "Erro ao salvar no banco de dados." });
    }
});

app.listen(PORT, () => {
    console.log(`[Temperança OS] Servidor online em http://localhost:${PORT}`);
    console.log(`[Temperança OS] Banco de dados operando em vtt-db.json`);
});