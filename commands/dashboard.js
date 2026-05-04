const { EmbedBuilder } = require('discord.js');
const { loadTasks, safeInteractionReply, getHistory } = require('../utils');

module.exports = async (interaction) => {
    await interaction.deferReply({ ephemeral: false });

    try {
        const tasks = await loadTasks();
        const userTasks = tasks[interaction.user.id] || {};
        const history = getHistory(interaction.user.id);
        
        const now = Date.now();
        let completedCount = 0;
        let pendingCount = 0;
        let overdueCount = 0;
        let completedThisWeek = 0;
        let completedThisMonth = 0;
        
        const weekStart = now - (7 * 24 * 60 * 60 * 1000);
        const monthStart = now - (30 * 24 * 60 * 60 * 1000);

        // Contar tareas actuales
        for (const taskId in userTasks) {
            const task = userTasks[taskId];
            const dueDate = new Date(task.dueDate).getTime();
            if (task.isCompleted) {
                completedCount++;
            } else if (dueDate < now) {
                overdueCount++;
            } else {
                pendingCount++;
            }
        }

        // Contar del historial
        history.forEach(entry => {
            const completedTime = new Date(entry.completedAt).getTime();
            if (entry.status === 'completed') {
                if (completedTime > weekStart) {
                    completedThisWeek++;
                }
                if (completedTime > monthStart) {
                    completedThisMonth++;
                }
            }
        });

        const totalTasks = Object.keys(userTasks).length;
        const totalCompleted = completedCount + history.filter(e => e.status === 'completed').length;
        const completionRate = totalCompleted > 0 ? Math.round((totalCompleted / (totalCompleted + totalTasks)) * 100) : 0;

        // Crear progreso visual
        const createProgressBar = (filled, total, maxBar = 10) => {
            if (total === 0) return '░░░░░░░░░░ 0%';
            const percent = Math.round((filled / total) * 100);
            const bars = Math.round((filled / total) * maxBar);
            const empty = maxBar - bars;
            return `${'█'.repeat(bars)}${'░'.repeat(empty)} ${percent}%`;
        };

        const dashboardEmbed = new EmbedBuilder()
            .setTitle('📊 Dashboard de Productividad')
            .setColor(0x5865F2)
            .setThumbnail(interaction.user.avatarURL({ size: 256 }))
            .addFields(
                {
                    name: '📈 Resumen General',
                    value: `**Total de tareas creadas:** ${totalTasks + history.length}\n**Completadas all-time:** ${totalCompleted}`,
                    inline: false
                },
                {
                    name: '✅ Completadas (Actual)',
                    value: `${completedCount} tareas\n${createProgressBar(completedCount, totalTasks)}`,
                    inline: true
                },
                {
                    name: '⏳ Pendientes',
                    value: `${pendingCount} tareas\n${createProgressBar(pendingCount, totalTasks)}`,
                    inline: true
                },
                {
                    name: '⚠️ Vencidas',
                    value: `${overdueCount} tareas\n${createProgressBar(overdueCount, totalTasks)}`,
                    inline: true
                },
                {
                    name: '🎯 Tasa de Completitud',
                    value: `**${completionRate}%**\n${createProgressBar(completionRate, 100)}`,
                    inline: false
                },
                {
                    name: '📅 Esta Semana',
                    value: `✅ Completadas: **${completedThisWeek}**\n⏳ Pendientes: **${pendingCount}**`,
                    inline: true
                },
                {
                    name: '📆 Este Mes',
                    value: `✅ Completadas: **${completedThisMonth}**\n📦 Total: **${history.length}** en historial`,
                    inline: true
                }
            )
            .setFooter({ text: `Actualizado: ${new Date().toLocaleString('es-ES')}` })
            .setTimestamp();

        return await safeInteractionReply(interaction, { embeds: [dashboardEmbed] });
    } catch (error) {
        console.error('Error en /dashboard:', error);
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error al mostrar dashboard')
            .setDescription('Ocurrió un problema al generar el dashboard. Intenta de nuevo en unos segundos.')
            .setColor(0xFF0000);
        return await safeInteractionReply(interaction, { embeds: [errorEmbed], ephemeral: true });
    }
};
