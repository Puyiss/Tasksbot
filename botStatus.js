const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const statusFile = path.join(__dirname, 'botStatus.json');

// Cargar estado del bot con validación
function loadBotStatus() {
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
function saveBotStatus(status) {
    try {
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
function updateCheckTime() {
    const status = loadBotStatus();
    status.lastCheckTime = Date.now();
    status.nextCheckTime = Date.now() + (10 * 60 * 1000); // +10 minutos
    status.isOnline = true;
    saveBotStatus(status);
}

// Crear o actualizar el embed de estado
function createStatusEmbed(totalTasks) {
    const status = loadBotStatus();
    
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
        .setFooter({ text: '' })
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
