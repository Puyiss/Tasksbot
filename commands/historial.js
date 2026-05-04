const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getHistory, safeInteractionReply } = require('../utils');

module.exports = async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    try {
        const history = getHistory(interaction.user.id);

        if (history.length === 0) {
            const emptyEmbed = new EmbedBuilder()
                .setTitle('Sin historial')
                .setDescription('No has completado ni cancelado tareas aún.')
                .setColor(0xFFCC00);
            return await safeInteractionReply(interaction, { embeds: [emptyEmbed] });
        }

        // Separar completadas y canceladas
        const completed = history.filter(h => h.status === 'completed');
        const cancelled = history.filter(h => h.status === 'cancelled');

        // Crear embeds con paginación
        const pageSize = 5;
        const totalPages = Math.ceil(history.length / pageSize);
        
        let currentPage = 0;

        const createHistoryEmbed = (page) => {
            const start = page * pageSize;
            const end = start + pageSize;
            const pageItems = history.slice(start, end);

            const embed = new EmbedBuilder()
                .setTitle('📜 Historial de Tareas')
                .setColor(0x5865F2)
                .setThumbnail(interaction.user.avatarURL({ size: 256 }))
                .addFields(
                    { 
                        name: '📊 Resumen',
                        value: `✅ Completadas: **${completed.length}**\n❌ Canceladas: **${cancelled.length}**\n📦 Total: **${history.length}**`,
                        inline: false
                    }
                );

            pageItems.forEach(item => {
                const icon = item.status === 'completed' ? '✅' : '❌';
                const status = item.status === 'completed' ? 'Completada' : 'Cancelada';
                const date = new Date(item.completedAt).toLocaleDateString('es-ES');
                
                embed.addFields({
                    name: `${icon} ${item.title}`,
                    value: `📅 ${date}\n📝 ${item.note || 'Sin nota'}\n Status: ${status}`,
                    inline: false
                });
            });

            embed.setFooter({ text: `Página ${page + 1} de ${totalPages}` });
            return embed;
        };

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('history-prev')
                    .setLabel('← Anterior')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId('history-next')
                    .setLabel('Siguiente →')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === totalPages - 1)
            );

        const message = await safeInteractionReply(interaction, {
            embeds: [createHistoryEmbed(currentPage)],
            components: [buttons]
        });

        // Colector de botones
        const collector = message.createMessageComponentCollector({ time: 5 * 60 * 1000 });

        collector.on('collect', async (buttonInteraction) => {
            if (buttonInteraction.user.id !== interaction.user.id) {
                return await buttonInteraction.reply({ content: '❌ No puedes usar estos botones', ephemeral: true });
            }

            if (buttonInteraction.customId === 'history-prev') {
                if (currentPage > 0) currentPage--;
            } else if (buttonInteraction.customId === 'history-next') {
                if (currentPage < totalPages - 1) currentPage++;
            }

            const newButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('history-prev')
                        .setLabel('← Anterior')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId('history-next')
                        .setLabel('Siguiente →')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === totalPages - 1)
                );

            await buttonInteraction.update({
                embeds: [createHistoryEmbed(currentPage)],
                components: [newButtons]
            });
        });

        collector.on('end', async () => {
            const disabledButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('history-prev')
                        .setLabel('← Anterior')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('history-next')
                        .setLabel('Siguiente →')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true)
                );
            
            try {
                await message.edit({ components: [disabledButtons] });
            } catch (error) {
                console.error('Error disabling buttons:', error);
            }
        });

    } catch (error) {
        console.error('Error en /historial:', error);
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error al mostrar historial')
            .setDescription('Ocurrió un problema al cargar el historial.')
            .setColor(0xFF0000);
        return await safeInteractionReply(interaction, { embeds: [errorEmbed] });
    }
};
