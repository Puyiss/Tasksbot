const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const { BotStatus } = require('./models');
const { testConnection } = require('./database');

const statusFile = path.join(__dirname, 'data', 'botStatus.json');

// Variable para saber si usar DB o archivos
let useDatabase = false;

// Inicializar conexión a DB para status
async function initializeBotStatusDB() {
    try {
        const connected = await testConnection();
        if (connected) {
            useDatabase = true;
        } else {
            useDatabase = false;
        }
    } catch (error) {
        useDatabase = false;
    }
}

// Cargar estado del bot con validación
async function loadBotStatus() {
    if (useDatabase) {
        try {
            let status = await BotStatus.findOne();
            if (!status) {
                // Crear registro inicial
                const now = Date.now();
                status = await BotStatus.create({
                    startTime: new Date(now),
                    lastCheckTime: new Date(now),
                    nextCheckTime: new Date(now + (10 * 60 * 1000)),
                    statusChannelId: null,
                    isOnline: true,
                    totalTasks: 0
                });
            }
            return {
                startTime: status.startTime.getTime(),
                lastCheckTime: status.lastCheckTime.getTime(),
                nextCheckTime: status.nextCheckTime.getTime(),
                statusChannelId: status.statusChannelId,
                isOnline: status.isOnline,
                totalTasks: status.totalTasks
            };
        } catch (error) {
            console.error('Error loading bot status from database:', error);
            return loadBotStatusFromFile();
        }
    } else {
        return loadBotStatusFromFile();
    }
}

// Cargar estado del bot desde archivo (fallback)
function loadBotStatusFromFile() {
    try {
        if (fs.existsSync(statusFile)) {
            const data = fs.readFileSync(statusFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading botStatus.json:', error);
        // Try to restore from backup if exists
        const backupFile = statusFile + '.backup';
        if (fs.existsSync(backupFile)) {
            try {
                console.warn('Attempting to restore bot status from backup...');
                const backupData = fs.readFileSync(backupFile, 'utf8');
                const status = JSON.parse(backupData);
                // Ensure directory exists
                const dir = path.dirname(statusFile);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(statusFile, JSON.stringify(status, null, 2));
                console.info('Bot status restored from backup successfully');
                return status;
            } catch (backupError) {
                console.error('Bot status backup restore failed:', backupError);
            }
        }
    }
    const now = Date.now();
    return {
        startTime: now,
        lastCheckTime: now,
        nextCheckTime: now + (10 * 60 * 1000),
        statusChannelId: null,
        isOnline: true,
        totalTasks: 0
    };
}

// Guardar estado del bot con backup
async function saveBotStatus(status) {
    if (useDatabase) {
        try {
            const existing = await BotStatus.findOne();
            if (existing) {
                await existing.update({
                    startTime: new Date(status.startTime),
                    lastCheckTime: new Date(status.lastCheckTime),
                    nextCheckTime: new Date(status.nextCheckTime),
                    statusChannelId: status.statusChannelId,
                    isOnline: status.isOnline,
                    totalTasks: status.totalTasks
                });
            } else {
                await BotStatus.create({
                    startTime: new Date(status.startTime),
                    lastCheckTime: new Date(status.lastCheckTime),
                    nextCheckTime: new Date(status.nextCheckTime),
                    statusChannelId: status.statusChannelId,
                    isOnline: status.isOnline,
                    totalTasks: status.totalTasks
                });
            }
        } catch (error) {
            console.error('Error saving bot status to database:', error);
            // Fallback to file
            saveBotStatusToFile(status);
        }
    } else {
        saveBotStatusToFile(status);
    }
}

// Guardar estado del bot en archivo (fallback)
function saveBotStatusToFile(status) {
    try {
        // Ensure directory exists
        const dir = path.dirname(statusFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        // Create backup before overwriting
        const backupFile = statusFile + '.backup';
        if (fs.existsSync(statusFile)) {
            fs.copyFileSync(statusFile, backupFile);
        }
        // Write new data
        fs.writeFileSync(statusFile, JSON.stringify(status, null, 2));
    } catch (error) {
        console.error('Error saving bot status:', error);
        // Don't throw, just log the error
    }
}

// Actualizar último chequeo
async function updateCheckTime() {
    const status = await loadBotStatus();
    status.lastCheckTime = Date.now();
    status.nextCheckTime = Date.now() + (10 * 60 * 1000); // +10 minutos
    status.isOnline = true;
    await saveBotStatus(status);
}

// Crear o actualizar el embed de estado
async function createStatusEmbed(totalTasks) {
    const status = await loadBotStatus();
    
    const lastCheck = new Date(status.lastCheckTime);
    const nextCheck = new Date(status.nextCheckTime);
    
    const lastCheckFormatted = lastCheck.toLocaleString('es-ES');
    const nextCheckFormatted = nextCheck.toLocaleString('es-ES');
    // Calcular uptime desde startTime (nunca se reinicia)
    const uptime = Math.floor((Date.now() - status.startTime) / 1000);
    
    const uptimeFormatted = formatUptime(uptime);
    
    const embed = new EmbedBuilder()
        .setTitle('🤖 Estado del Bot de Tareas')
        .setColor(status.isOnline ? 0x00FF00 : 0xFF0000)
        .addFields(
            { name: 'Estado', value: status.isOnline ? '✅ Encendido' : '❌ Apagado', inline: true },
            { name: 'Tiempo en línea', value: uptimeFormatted, inline: true },
            { name: 'Tareas activas', value: `${totalTasks}`, inline: true },
            { name: '⏱️ Último chequeo', value: lastCheckFormatted, inline: false },
            { name: '⏭️ Próximo chequeo', value: nextCheckFormatted, inline: false }
        )
        .setFooter({ text: 'Actualizado automáticamente cada 10 minutos' })
        .setTimestamp();
    
    return embed;
}

// Formatear tiempo
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    
    return parts.length > 0 ? parts.join(' ') : '< 1 min';
}

// Establecer canal de estado
function setStatusChannelId(channelId) {
    const status = loadBotStatus();
    status.statusChannelId = channelId;
    saveBotStatus(status);
}

// Obtener canal de estado
function getStatusChannelId() {
    const status = loadBotStatus();
    return status.statusChannelId;
}

module.exports = {
    loadBotStatus,
    saveBotStatus,
    updateCheckTime,
    createStatusEmbed,
    setStatusChannelId,
    getStatusChannelId
};
