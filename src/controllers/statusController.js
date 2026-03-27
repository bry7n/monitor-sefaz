const sefazService = require('../services/sefazService');

// Histórico em memória (array simples)
let history = [];
const HISTORY_LIMIT = 100;

/**
 * Controller para buscar o status atual e gerenciar o histórico.
 */
const getStatus = async (req, res) => {
  try {
    const currentStatus = await sefazService.fetchSefazStatus();

    // Adiciona ao início do histórico e remove o mais antigo se ultrapassar o limite
    history.unshift({
      timestamp: new Date().toISOString(),
      data: currentStatus
    });

    if (history.length > HISTORY_LIMIT) {
      history.pop();
    }

    // Retorna o status atual e o histórico compactado (apenas os últimos timestamps)
    res.json({
      success: true,
      version: "v2-debug",
      current: currentStatus,
      history: history.slice(0, 10).map(h => ({
        timestamp: h.timestamp,
        summary: h.data.reduce((acc, curr) => {
          acc[curr.status] = (acc[curr.status] || 0) + 1;
          return acc;
        }, {})
      }))
    });
  } catch (error) {
    console.error('Erro ao buscar status SEFAZ:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao consultar status da SEFAZ.'
    });
  }
};

/**
 * Retorna o histórico completo disponível.
 */
const getHistory = (req, res) => {
  res.json({
    success: true,
    history
  });
};

module.exports = {
  getStatus,
  getHistory
};
