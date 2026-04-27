const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const statusFile = path.join(__dirname, 'botStatus.json');

// Cargar estado del bot
function loadBotStatus() {
    if (fs.existsSync(statusFile)) {
        return JSON.parse(fs.readFileSync(statusFile, 'utf8'));
    }
    return {
        lastCheckTime: Date.now(),
        nextCheckTime: Date.now() + (10 * 60 * 1000), // +10 minutos
        statusChannelId: null,
        isOnline: true,
        totalTasks: 0
    };
}

// Guardar estado del bot
function saveBotStatus(status) {
    fs.writeFileSync(statusFile, JSON.stringify(status, null, 2));
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
    const uptime = Math.floor((Date.now() - status.lastCheckTime) / 1000);
    
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
