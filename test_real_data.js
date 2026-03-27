const sefazService = require('./src/services/sefazService');

async function testRealData() {
    try {
        console.log("Iniciando teste de dados reais SEFAZ...");
        const startTime = Date.now();
        const data = await sefazService.fetchSefazStatus();
        const endTime = Date.now();
        
        console.log(`Tempo total da requisição: ${endTime - startTime}ms`);
        console.log(`Total de registros capturados: ${data.length}`);
        
        // Mostrar alguns exemplos
        const examples = ['SP', 'MT', 'RJ', 'MG', 'RS'];
        examples.forEach(uf => {
            const ufData = data.filter(d => d.estado === uf);
            console.log(`\nStatus para ${uf}:`);
            ufData.forEach(d => {
                console.log(`- ${d.servico}: ${d.status} (${d.tempoResposta}ms)`);
            });
        });

        // Contagem global
        const counts = data.reduce((acc, curr) => {
            acc[curr.status] = (acc[curr.status] || 0) + 1;
            return acc;
        }, { online: 0, instavel: 0, offline: 0 });
        
        console.log("\nRESUMO GLOBAL:");
        console.log(`Online: ${counts.online}`);
        console.log(`Instável: ${counts.instavel}`);
        console.log(`Offline: ${counts.offline}`);

    } catch (err) {
        console.error("ERRO NO TESTE:", err.message);
    }
}

testRealData();
