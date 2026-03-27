const express = require('express');
const router = express.Router();
const statusController = require('../controllers/statusController');

// Rota GET /status - Retorna o status atual dos serviços por estado
router.get('/status', statusController.getStatus);

// Rota GET /history - Retorna o histórico de consultas em memória
router.get('/history', statusController.getHistory);

module.exports = router;
