// ==========================================
// 1. ESTADO DA APLICAÇÃO E VARIÁVEIS GERAIS
// ==========================================
let currentUser = null; 
let currentCampaign = null;

const views = {
    login: document.getElementById('view-login'),
    narratorDash: document.getElementById('view-narrator-dash'),
    narratorCamp: document.getElementById('view-narrator-camp'),
    playerDash: document.getElementById('view-player-dash')
};

const sheetModal = document.getElementById('sheet-modal');

// ==========================================
// 2. FUNÇÕES DE UTILIDADE E API (SERVIDOR)
// ==========================================
function showView(viewName) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[viewName].classList.add('active');
}

function generateInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) { code += chars.charAt(Math.floor(Math.random() * chars.length)); }
    return code;
}

async function getCampaignsDB() {
    const response = await fetch('/api/campaigns');
    return await response.json();
}

async function saveCampaignsDB(campaigns) {
    await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaigns)
    });
}

// ==========================================
// 3. LÓGICA DE LOGIN E LOGOUT
// ==========================================
document.getElementById('login-role').addEventListener('change', (e) => {
    const groupJuiz = document.getElementById('group-juiz');
    const groupJogador = document.getElementById('group-jogador');
    
    if (e.target.value === 'jogador') {
        groupJuiz.classList.add('hidden');
        groupJogador.classList.remove('hidden');
    } else {
        groupJuiz.classList.remove('hidden');
        groupJogador.classList.add('hidden');
    }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const role = document.getElementById('login-role').value;
    const errorMsg = document.getElementById('login-error');
    errorMsg.style.display = 'none';

    try {
        if (role === 'narrador') {
            const name = document.getElementById('login-name-juiz').value.trim();
            if (!name) return;
            
            currentUser = { name, role };
            document.getElementById('narrator-name-display').innerText = name.toUpperCase();
            showView('narratorDash');
            await loadCampaigns(); 
        } else {
            const code = document.getElementById('login-code').value.trim().toUpperCase();
            const username = document.getElementById('login-user-jogador').value.trim();
            const pass = document.getElementById('login-pass-jogador').value.trim();

            if (!code || !username || !pass) {
                errorMsg.innerText = "[ERRO] Preencha todos os campos da credencial.";
                errorMsg.style.display = 'block';
                return;
            }

            const campaigns = await getCampaignsDB();
            const targetCampaign = campaigns.find(c => c.inviteCode === code);

            if (!targetCampaign) {
                errorMsg.innerText = "[ACESSO NEGADO] Código de sala inexistente. Cuidado com 'O' e '0'.";
                errorMsg.style.display = 'block';
                return;
            }

            const usersList = targetCampaign.users || [];
            const validUser = usersList.find(u => 
                u && u.username && u.username.toLowerCase() === username.toLowerCase() && u.password === pass
            );

            if (!validUser) {
                errorMsg.innerText = "[ACESSO NEGADO] Usuário ou senha incorretos.";
                errorMsg.style.display = 'block';
                return;
            }

            currentUser = { name: validUser.username, role, assignedSheets: validUser.sheets || [] };
            currentCampaign = targetCampaign;

            document.getElementById('player-name-display').innerText = `${validUser.username.toUpperCase()} [SALA: ${targetCampaign.name}]`;
            
            renderPlayerSheets(); 
            showView('playerDash');
        }
    } catch (erro) {
        console.error("Erro Crítico no Login:", erro);
        errorMsg.innerText = "[ERRO DE SISTEMA] Falha ao ler banco de dados. Verifique o servidor.";
        errorMsg.style.display = 'block';
    }
});

document.querySelectorAll('.btn-logout').forEach(btn => {
    btn.addEventListener('click', () => {
        currentUser = null;
        currentCampaign = null;
        document.getElementById('login-form').reset();
        document.getElementById('login-error').style.display = 'none';
        showView('login');
    });
});

// ==========================================
// 4. PAINEL DO NARRADOR - GESTÃO DE CAMPANHAS
// ==========================================
async function loadCampaigns() {
    const campaigns = await getCampaignsDB();
    const list = document.getElementById('campaign-list');
    list.innerHTML = '';

    if (campaigns.length === 0) {
        list.innerHTML = '<li class="text-muted">Nenhuma campanha detectada no sistema.</li>';
        return;
    }

    campaigns.forEach((camp) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <strong>${camp.name}</strong><br>
                <span class="text-muted" style="font-size: 0.9em;">CÓDIGO DE SALA: <span style="color: var(--text-main);">${camp.inviteCode}</span></span>
            </div>
            <button class="btn-small btn-access-camp">GERENCIAR</button>
        `;
        li.querySelector('.btn-access-camp').addEventListener('click', () => openCampaign(camp));
        list.appendChild(li);
    });
}

document.getElementById('btn-create-campaign').addEventListener('click', async () => {
    const campName = document.getElementById('new-campaign-name').value.trim();
    if (!campName) return;

    const campaigns = await getCampaignsDB();
    campaigns.push({
        id: Date.now().toString(),
        inviteCode: generateInviteCode(),
        name: campName,
        users: [], 
        sheets: [] 
    });
    
    await saveCampaignsDB(campaigns);
    document.getElementById('new-campaign-name').value = '';
    await loadCampaigns();
});

// ==========================================
// 5. DENTRO DA CAMPANHA (NARRADOR) - USUÁRIOS
// ==========================================
async function openCampaign(campaign) {
    const campaigns = await getCampaignsDB();
    currentCampaign = campaigns.find(c => c.id === campaign.id) || campaign; 
    
    document.getElementById('current-campaign-name').innerText = currentCampaign.name.toUpperCase();
    showView('narratorCamp');
    renderCampaignUsers();
    renderCampaignSheets();
}

document.getElementById('btn-back-dash').addEventListener('click', async () => {
    currentCampaign = null;
    await loadCampaigns();
    showView('narratorDash');
});

document.getElementById('btn-create-user').addEventListener('click', async () => {
    const username = document.getElementById('new-user-name').value.trim();
    const password = document.getElementById('new-user-pass').value.trim();
    
    if (!username || !password || !currentCampaign) return;

    const campaigns = await getCampaignsDB();
    const campIndex = campaigns.findIndex(c => c.id === currentCampaign.id);
    
    if (campIndex > -1) {
        const userExists = campaigns[campIndex].users.some(u => u.username.toLowerCase() === username.toLowerCase());
        
        if (!userExists) {
            campaigns[campIndex].users.push({
                username: username,
                password: password,
                sheets: [] 
            });
            await saveCampaignsDB(campaigns);
            currentCampaign = campaigns[campIndex];
            renderCampaignUsers();
        } else {
            alert("Erro: Já existe uma credencial com este nome nesta sala.");
        }
    }
    
    document.getElementById('new-user-name').value = '';
    document.getElementById('new-user-pass').value = '';
});

function renderCampaignUsers() {
    const list = document.getElementById('campaign-users-list');
    list.innerHTML = '';
    
    if (!currentCampaign.users || currentCampaign.users.length === 0) {
        list.innerHTML = '<li class="text-muted">Nenhuma credencial emitida.</li>';
        return;
    }

    currentCampaign.users.forEach(user => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>> ${user.username} <span style="font-size: 0.7em; color: #555;">(Senha: ${user.password})</span></span>
            <button class="btn-small btn-revoke" style="border-color: var(--danger); color: var(--danger);">REVOGAR</button>
        `;
        
        li.querySelector('.btn-revoke').addEventListener('click', async () => {
            if(confirm(`Tem certeza que deseja revogar o acesso de ${user.username}?`)) {
                const campaigns = await getCampaignsDB();
                const campIndex = campaigns.findIndex(c => c.id === currentCampaign.id);
                campaigns[campIndex].users = campaigns[campIndex].users.filter(u => u.username !== user.username);
                await saveCampaignsDB(campaigns);
                currentCampaign = campaigns[campIndex];
                renderCampaignUsers();
            }
        });
        list.appendChild(li);
    });
}

// ==========================================
// 6. SISTEMA DE FICHAS DE PERSONAGEM
// ==========================================
function renderCampaignSheets() {
    const list = document.getElementById('sheets-list');
    list.innerHTML = '';
    
    if (!currentCampaign.sheets || currentCampaign.sheets.length === 0) {
        list.innerHTML = '<li class="text-muted">Nenhuma ficha criada.</li>';
        return;
    }

    currentCampaign.sheets.forEach(ficha => {
        const li = document.createElement('li');
        const donoTexto = ficha.dono ? `[Dono: ${ficha.dono}]` : `[NPC]`;
        li.innerHTML = `
            <span>> ${ficha.nome} <span style="font-size: 0.7em; color: var(--text-muted);">${donoTexto}</span></span>
            <button class="btn-small">ABRIR</button>
        `;
        li.querySelector('button').addEventListener('click', () => openSheet(ficha));
        list.appendChild(li);
    });
}

function renderPlayerSheets() {
    const list = document.getElementById('player-sheets-list');
    list.innerHTML = '';
    
    const sheets = currentCampaign.sheets || [];
    const minhasFichas = sheets.filter(f => (f.dono || "").toLowerCase() === currentUser.name.toLowerCase());
    
    if (minhasFichas.length === 0) {
        list.innerHTML = '<li class="text-muted">O Juiz ainda não atribuiu nenhum Condenado a você.</li>';
        return;
    }

    minhasFichas.forEach(ficha => {
        const li = document.createElement('li');
        li.innerHTML = `<span>> ${ficha.nome}</span> <button class="btn-small btn-access-sheet">ACESSAR</button>`;
        li.querySelector('.btn-access-sheet').addEventListener('click', () => openSheet(ficha));
        list.appendChild(li);
    });
}

document.getElementById('btn-create-sheet').addEventListener('click', async () => {
    if (!currentCampaign) return;

    const campaigns = await getCampaignsDB();
    const campIndex = campaigns.findIndex(c => c.id === currentCampaign.id);
    
    if (campIndex > -1) {
        if (!campaigns[campIndex].sheets) {
            campaigns[campIndex].sheets = [];
        }

        const novaFicha = {
            id: 'ficha_' + Date.now(),
            nome: "Novo Condenado",
            dono: "", 
            estresse: 0,
            ativos: { fisico: 1, motoras: 1, intelecto: 1, mente: 1 },
            passivos: { vontade: 0, fortitude: 0, reflexos: 0 },
            limites: { maior: 6, grave: 12 }, 
            habTecnicas: "", 
            habCombate: "",
            condicoes: "",
            equipamentos: "",
            inventario: "",
            talentos: "",
            feiticos: "",
            notasGerais: "",
            dano: { machucado: 0, ferimento: 0, trauma: 0, letal: 0 }
        };
        
        campaigns[campIndex].sheets.push(novaFicha);
        await saveCampaignsDB(campaigns);
        currentCampaign = campaigns[campIndex];
        renderCampaignSheets();
    }
});

// ==========================================
// 7. ABRIR, EDITAR E SALVAR A FICHA (MODAL)
// ==========================================
function openSheet(ficha) {
    try {
        const ativos = ficha.ativos || { fisico: 1, motoras: 1, intelecto: 1, mente: 1 };
        const passivos = ficha.passivos || { vontade: 0, fortitude: 0, reflexos: 0 };
        const dano = ficha.dano || { machucado: 0, ferimento: 0, trauma: 0, letal: 0 };
        const limites = ficha.limites || { maior: 6, grave: 12 };

        document.getElementById('sheet-id-active').value = ficha.id || '';
        document.getElementById('sheet-nome').value = ficha.nome || '';
        document.getElementById('sheet-dono').value = ficha.dono || '';
        document.getElementById('sheet-estresse').value = ficha.estresse || 0;
        
        document.getElementById('sheet-fisico').value = ativos.fisico || 1;
        document.getElementById('sheet-motoras').value = ativos.motoras || 1;
        document.getElementById('sheet-intelecto').value = ativos.intelecto || 1;
        document.getElementById('sheet-mente').value = ativos.mente || 1;
        
        document.getElementById('sheet-vontade').value = passivos.vontade || 0;
        document.getElementById('sheet-fortitude').value = passivos.fortitude || 0;
        document.getElementById('sheet-reflexos').value = passivos.reflexos || 0;
        
        // Limiares de Dano
        document.getElementById('sheet-limite-maior').value = limites.maior || 6;
        document.getElementById('sheet-limite-grave').value = limites.grave || 12;
        document.getElementById('sheet-limite-letal').innerText = (limites.grave || 12) * 2;
        
        // Habilidades separadas (fallback para campanhas antigas)
        document.getElementById('sheet-hab-tecnicas').value = ficha.habTecnicas || ficha.habilidades || '';
        document.getElementById('sheet-hab-combate').value = ficha.habCombate || '';
        
        document.getElementById('sheet-condicoes').value = ficha.condicoes || '';
        document.getElementById('sheet-equipamentos').value = ficha.equipamentos || '';
        document.getElementById('sheet-inventario').value = ficha.inventario || '';
        document.getElementById('sheet-talentos').value = ficha.talentos || '';
        document.getElementById('sheet-feiticos').value = ficha.feiticos || '';
        document.getElementById('sheet-notas-gerais').value = ficha.notasGerais || '';

        const campoDono = document.getElementById('sheet-dono');
        if (campoDono) {
            campoDono.disabled = (currentUser && currentUser.role === 'jogador');
        }

        atualizarAtributosDerivados();
        renderizarTrilhasDano(dano);

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.querySelector('[data-tab="tab-principal"]').classList.add('active');
        document.getElementById('tab-principal').classList.remove('hidden');

        sheetModal.classList.remove('hidden');

    } catch (erro) {
        console.error("[ERRO DO SISTEMA] Falha ao renderizar a ficha:", erro);
        alert("Ocorreu um erro ao tentar ler os dados desta ficha. Verifique o console (F12).");
    }
}

// Fechar Ficha (mantém igual)
document.getElementById('btn-close-sheet').addEventListener('click', () => {
    sheetModal.classList.add('hidden');
    if (currentUser.role === 'narrador') renderCampaignSheets();
    if (currentUser.role === 'jogador') renderPlayerSheets();
});

document.getElementById('btn-save-sheet').addEventListener('click', async () => {
    const idAtiva = document.getElementById('sheet-id-active').value;
    const campaigns = await getCampaignsDB();
    const campIndex = campaigns.findIndex(c => c.id === currentCampaign.id);
    
    if (campIndex > -1) {
        const sheetIndex = campaigns[campIndex].sheets.findIndex(s => s.id === idAtiva);
        
        if (sheetIndex > -1) {
            campaigns[campIndex].sheets[sheetIndex].nome = document.getElementById('sheet-nome').value || "Sem Nome";
            campaigns[campIndex].sheets[sheetIndex].dono = document.getElementById('sheet-dono').value.trim();
            campaigns[campIndex].sheets[sheetIndex].estresse = parseInt(document.getElementById('sheet-estresse').value) || 0;
            
            campaigns[campIndex].sheets[sheetIndex].ativos.fisico = parseInt(document.getElementById('sheet-fisico').value) || 0;
            campaigns[campIndex].sheets[sheetIndex].ativos.motoras = parseInt(document.getElementById('sheet-motoras').value) || 0;
            campaigns[campIndex].sheets[sheetIndex].ativos.intelecto = parseInt(document.getElementById('sheet-intelecto').value) || 0;
            campaigns[campIndex].sheets[sheetIndex].ativos.mente = parseInt(document.getElementById('sheet-mente').value) || 0;
            
            campaigns[campIndex].sheets[sheetIndex].passivos.vontade = parseInt(document.getElementById('sheet-vontade').value) || 0;
            campaigns[campIndex].sheets[sheetIndex].passivos.fortitude = parseInt(document.getElementById('sheet-fortitude').value) || 0;
            campaigns[campIndex].sheets[sheetIndex].passivos.reflexos = parseInt(document.getElementById('sheet-reflexos').value) || 0;
            
            // Salvar Limites e Habilidades novas
            if (!campaigns[campIndex].sheets[sheetIndex].limites) campaigns[campIndex].sheets[sheetIndex].limites = {};
            campaigns[campIndex].sheets[sheetIndex].limites.maior = parseInt(document.getElementById('sheet-limite-maior').value) || 6;
            campaigns[campIndex].sheets[sheetIndex].limites.grave = parseInt(document.getElementById('sheet-limite-grave').value) || 12;
            
            campaigns[campIndex].sheets[sheetIndex].habTecnicas = document.getElementById('sheet-hab-tecnicas').value;
            campaigns[campIndex].sheets[sheetIndex].habCombate = document.getElementById('sheet-hab-combate').value;
            
            campaigns[campIndex].sheets[sheetIndex].condicoes = document.getElementById('sheet-condicoes').value;
            campaigns[campIndex].sheets[sheetIndex].equipamentos = document.getElementById('sheet-equipamentos').value;
            campaigns[campIndex].sheets[sheetIndex].inventario = document.getElementById('sheet-inventario').value;
            campaigns[campIndex].sheets[sheetIndex].talentos = document.getElementById('sheet-talentos').value;
            campaigns[campIndex].sheets[sheetIndex].feiticos = document.getElementById('sheet-feiticos').value;
            campaigns[campIndex].sheets[sheetIndex].notasGerais = document.getElementById('sheet-notas-gerais').value;
            
            campaigns[campIndex].sheets[sheetIndex].dano = capturarEstadoDoDano();
            
            await saveCampaignsDB(campaigns);
            currentCampaign = campaigns[campIndex]; 
            
            if (currentUser.role === 'narrador') renderCampaignSheets();
            if (currentUser.role === 'jogador') renderPlayerSheets();

            alert("Ficha guardada com sucesso!");
        }
    }
});

// ==========================================
// 8. LÓGICA DE REGRAS TEMPERANÇA E ABAS
// ==========================================

['sheet-fisico', 'sheet-motoras', 'sheet-mente'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
        atualizarAtributosDerivados();
        if (id === 'sheet-fisico') {
            const estadoAtual = capturarEstadoDoDano();
            renderizarTrilhasDano(estadoAtual);
        }
    });
});

function atualizarAtributosDerivados() {
    const fisico = parseInt(document.getElementById('sheet-fisico').value) || 0;
    const motoras = parseInt(document.getElementById('sheet-motoras').value) || 0;
    const mente = parseInt(document.getElementById('sheet-mente').value) || 0;

    const temTrauma = document.querySelectorAll('#track-trauma-cells input:checked').length > 0;
    
    document.getElementById('sheet-max-estresse').innerText = 4 + mente;
    document.getElementById('sheet-max-reacoes').innerText = 1 + motoras;
    
    let cargaMaxima = 10 + (fisico * 2);
    if (temTrauma) cargaMaxima -= 3;
    
    document.getElementById('sheet-max-carga').innerText = cargaMaxima;
}

function renderizarTrilhasDano(danoSalvo) {
    const fisico = parseInt(document.getElementById('sheet-fisico').value) || 0;
    
    // Valores iniciais do Condenado (Físico 0)
    let maxMachucado = 3;
    let maxFerimento = 2;
    let maxTrauma = 1;
    const maxLetal = 1;

    // A cada 1 ponto de físico, distribui 1 espaço extra na ordem da hierarquia
    for (let i = 1; i <= fisico; i++) {
        if (i % 3 === 1) {
            maxMachucado++;
        } else if (i % 3 === 2) {
            maxFerimento++;
        } else if (i % 3 === 0) {
            maxTrauma++;
        }
    }

    gerarCaixasDano('track-machucado-cells', maxMachucado, danoSalvo.machucado);
    gerarCaixasDano('track-ferimento-cells', maxFerimento, danoSalvo.ferimento);
    gerarCaixasDano('track-trauma-cells', maxTrauma, danoSalvo.trauma);
    gerarCaixasDano('track-letal-cells', maxLetal, danoSalvo.letal);
}

document.querySelector('.damage-tracks-container').addEventListener('change', (e) => {
    if (e.target.classList.contains('damage-cell')) {
        atualizarAtributosDerivados();
    }
});

function gerarCaixasDano(containerId, totalCaixas, caixasMarcadas) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = ''; 
    
    for (let i = 0; i < totalCaixas; i++) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'damage-cell';
        if (i < caixasMarcadas) checkbox.checked = true;
        container.appendChild(checkbox);
    }
}

function capturarEstadoDoDano() {
    return {
        machucado: document.querySelectorAll('#track-machucado-cells input:checked').length,
        ferimento: document.querySelectorAll('#track-ferimento-cells input:checked').length,
        trauma: document.querySelectorAll('#track-trauma-cells input:checked').length,
        letal: document.querySelectorAll('#track-letal-cells input:checked').length
    };
}

// Automação: O Limite Letal é sempre o dobro do Limite Grave
document.getElementById('sheet-limite-grave').addEventListener('change', (e) => {
    const valorGrave = parseInt(e.target.value) || 12;
    document.getElementById('sheet-limite-letal').innerText = valorGrave * 2;
});

// NAVEGAÇÃO DAS ABAS (Corrigido "conteudo" sem acento)
document.addEventListener('click', (e) => {
    const tabClicada = e.target.closest('.tab-btn');
    if (!tabClicada) return; 

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(conteudo => conteudo.classList.add('hidden'));

    tabClicada.classList.add('active');

    const idDaAbaAlvo = tabClicada.getAttribute('data-tab');
    document.getElementById(idDaAbaAlvo).classList.remove('hidden');
});