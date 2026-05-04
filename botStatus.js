const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const { BotStatus } = require('./models');
const { testConnection } = require('./database');
const { BOT_STATUS_FILE, DEFAULT_STATUS_CHANNEL_ID } = require('./config');

const statusFile = BOT_STATUS_FILE;

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
            const parsed = JSON.parse(data);
            
            // Normalizar timestamps a números
            return {
                startTime: typeof parsed.startTime === 'number' ? parsed.startTime : new Date(parsed.startTime).getTime(),
                lastCheckTime: typeof parsed.lastCheckTime === 'number' ? parsed.lastCheckTime : new Date(parsed.lastCheckTime).getTime(),
                nextCheckTime: typeof parsed.nextCheckTime === 'number' ? parsed.nextCheckTime : new Date(parsed.nextCheckTime).getTime(),
                statusChannelId: parsed.statusChannelId || null,
                isOnline: parsed.isOnline !== false,
                totalTasks: parsed.totalTasks || 0
            };
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
                
                // Normalizar y guardar
                const normalized = {
                    startTime: typeof status.startTime === 'number' ? status.startTime : new Date(status.startTime).getTime(),
                    lastCheckTime: typeof status.lastCheckTime === 'number' ? status.lastCheckTime : new Date(status.lastCheckTime).getTime(),
                    nextCheckTime: typeof status.nextCheckTime === 'number' ? status.nextCheckTime : new Date(status.nextCheckTime).getTime(),
                    statusChannelId: status.statusChannelId || null,
                    isOnline: status.isOnline !== false,
                    totalTasks: status.totalTasks || 0
                };
                
                // Ensure directory exists
                const dir = path.dirname(statusFile);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(statusFile, JSON.stringify(normalized, null, 2));
                console.info('Bot status restored from backup successfully');
                return normalized;
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
        // Asegurar que los timestamps sean números
        const cleanStatus = {
            startTime: typeof status.startTime === 'number' ? status.startTime : new Date(status.startTime).getTime(),
            lastCheckTime: typeof status.lastCheckTime === 'number' ? status.lastCheckTime : new Date(status.lastCheckTime).getTime(),
            nextCheckTime: typeof status.nextCheckTime === 'number' ? status.nextCheckTime : new Date(status.nextCheckTime).getTime(),
            statusChannelId: status.statusChannelId,
            isOnline: status.isOnline,
            totalTasks: status.totalTasks
        };
        
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
        fs.writeFileSync(statusFile, JSON.stringify(cleanStatus, null, 2));
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
    
    // Validar y convertir timestamps a números
    let lastCheckTime = status.lastCheckTime;
    let nextCheckTime = status.nextCheckTime;
    let startTime = status.startTime;
    
    // Si son strings ISO, convertir a timestamp
    if (typeof lastCheckTime === 'string') {
        lastCheckTime = new Date(lastCheckTime).getTime();
    }
    if (typeof nextCheckTime === 'string') {
        nextCheckTime = new Date(nextCheckTime).getTime();
    }
    if (typeof startTime === 'string') {
        startTime = new Date(startTime).getTime();
    }
    
    // Validar que sean números válidos
    if (!Number.isFinite(lastCheckTime)) lastCheckTime = Date.now();
    if (!Number.isFinite(nextCheckTime)) nextCheckTime = Date.now() + (10 * 60 * 1000);
    if (!Number.isFinite(startTime) || startTime === 0 || startTime < 1000000000000) {
        // Si startTime es inválido o muy antiguo (época Unix), usar la hora actual
        startTime = Date.now();
        status.startTime = startTime;
        await saveBotStatus(status);
    }
    
    const lastCheck = new Date(lastCheckTime);
    const nextCheck = new Date(nextCheckTime);
    
    const lastCheckFormatted = lastCheck.toLocaleString('es-ES');
    const nextCheckFormatted = nextCheck.toLocaleString('es-ES');
    
    // Calcular uptime desde startTime (nunca se reinicia)
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    
    const uptimeFormatted = formatUptime(uptime);
    
    const embed = new EmbedBuilder()
        .setTitle('🤖 Estado del Bot de Tareas')
        .setDescription('Estado actualizado del bot de múltiples tareas.')
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
async function setStatusChannelId(channelId) {
    const status = await loadBotStatus();
    status.statusChannelId = channelId;
    await saveBotStatus(status);
}

// Obtener canal de estado
async function getStatusChannelId() {
    const status = await loadBotStatus();
    return status.statusChannelId || DEFAULT_STATUS_CHANNEL_ID;
}

module.exports = {
    loadBotStatus,
    saveBotStatus,
    updateCheckTime,
    createStatusEmbed,
    setStatusChannelId,
    getStatusChannelId
};
