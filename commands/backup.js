const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { loadTasks, saveTasks, safeInteractionReply } = require('../utils');
const fs = require('fs');
const path = require('path');

module.exports = async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    try {
        const subcommand = interaction.options.getSubcommand();
        const tasks = loadTasks();
        const userTasks = tasks[interaction.user.id] || {};

        if (subcommand === 'exportar') {
            // Exportar tareas a JSON
            const backup = {
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                exportDate: new Date().toISOString(),
                tasks: userTasks,
                stats: {
                    totalTasks: Object.keys(userTasks).length,
                    completedTasks: Object.values(userTasks).filter(t => t.isCompleted).length,
                    pendingTasks: Object.values(userTasks).filter(t => !t.isCompleted).length
                }
            };

            const backupJson = JSON.stringify(backup, null, 2);
            const fileName = `backup-tareas-${Date.now()}.json`;
            const tempPath = path.join(__dirname, '..', 'data', fileName);

            // Asegurar que exista el directorio
            const dir = path.dirname(tempPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(tempPath, backupJson);

            const attachment = new AttachmentBuilder(tempPath, { name: fileName });
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Backup Exportado')
                .setDescription(`Se generó correctamente tu backup con ${backup.stats.totalTasks} tareas.`)
                .addFields(
                    { name: '✅ Completadas', value: `${backup.stats.completedTasks}`, inline: true },
                    { name: '⏳ Pendientes', value: `${backup.stats.pendingTasks}`, inline: true }
                )
                .setColor(0x00AE86)
                .setFooter({ text: `Archivo: ${fileName}` });

            // Limpiar archivo después de 5 minutos
            setTimeout(() => {
                if (fs.existsSync(tempPath)) {
                    fs.unlinkSync(tempPath);
                }
            }, 5 * 60 * 1000);

            return await safeInteractionReply(interaction, { embeds: [successEmbed], files: [attachment] });

        } else if (subcommand === 'historial') {
            // Mostrar historial de tareas completadas
            const completedTasks = Object.values(userTasks)
                .filter(t => t.isCompleted)
                .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
                .slice(0, 10);

            if (completedTasks.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setTitle('📋 Historial de Tareas')
                    .setDescription('No tienes tareas completadas aún.')
                    .setColor(0x808080);
                return await safeInteractionReply(interaction, { embeds: [emptyEmbed] });
            }

            const historyEmbed = new EmbedBuilder()
                .setTitle('📋 Historial de Tareas Completadas')
                .setColor(0x00AE86)
                .setDescription(`Últimas ${completedTasks.length} tareas completadas:`);

            for (const task of completedTasks) {
                const completedDate = new Date(task.completedAt).toLocaleDateString('es-ES');
                const dueDate = new Date(task.dueDate).toLocaleDateString('es-ES');
                historyEmbed.addFields({
                    name: `✅ ${task.title}`,
                    value: `📅 Fecha: ${dueDate} | ✔️ Completada: ${completedDate}`,
                    inline: false
                });
            }

            return await safeInteractionReply(interaction, { embeds: [historyEmbed] });

        } else if (subcommand === 'restaurar') {
            // Restaurar desde backup (requeriría un archivo adjunto, simplificado aquí)
            const restoreEmbed = new EmbedBuilder()
                .setTitle('🔄 Restauración')
                .setDescription('Para restaurar un backup, carga el archivo JSON generado con `/backup exportar` y usa este comando.')
                .setColor(0x00AE86)
                .addFields(
                    { name: 'Instrucciones', value: 'Actualmente el comando está disponible pero requiere validación manual del archivo. Contacta a un administrador si necesitas restaurar tareas.' }
                );

            return await safeInteractionReply(interaction, { embeds: [restoreEmbed] });
        }

    } catch (error) {
        console.error('Error en /backup:', error);
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error en backup')
            .setDescription('Ocurrió un problema al procesar el backup. Intenta de nuevo en unos segundos.')
            .setColor(0xFF0000);
        return await safeInteractionReply(interaction, { embeds: [errorEmbed], ephemeral: true });
    }
};
