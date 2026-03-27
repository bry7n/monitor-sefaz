const express = require('express');
const cors = require('cors');
const path = require('path');
const statusRoutes = require('./src/routes/statusRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração de Middlewares
app.use(cors());
app.use(express.json());

// Servindo arquivos estáticos (Frontend) do diretório public
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Rotas da API
 */
// Rota GET /status - Consulta atual
app.get('/status', statusRoutes);

// Deixa o resto para o router lidar
app.use('/api', statusRoutes);

/**
 * Inicia o servidor na porta especificada, ou exporta para a Vercel
 */
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor SEFAZ Monitor rodando em http://localhost:${PORT}`);
    console.log(`📊 Consulte a API em http://localhost:${PORT}/api/status`);
  });
}

// Exportando app para suportar o Serverless Deployment da Vercel
module.exports = app;
