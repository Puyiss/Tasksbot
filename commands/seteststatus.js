const { EmbedBuilder, ChannelType } = require('discord.js');
const { setStatusChannelId, createStatusEmbed, loadBotStatus } = require('../botStatus');
const { loadTasks } = require('../utils');

module.exports = async (interaction) => {
    // Verificar si el usuario es administrador
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        const noPermEmbed = new EmbedBuilder()
            .setTitle('Permiso denegado')
            .setDescription('Solo administradores pueden usar este comando.')
            .setColor(0xFF0000);
        return interaction.reply({ embeds: [noPermEmbed], ephemeral: true });
    }

    const channel = interaction.options.getChannel('canal');

    if (!channel || channel.type !== ChannelType.GuildText) {
        const invalidEmbed = new EmbedBuilder()
            .setTitle('Canal inválido')
            .setDescription('Debes especificar un canal de texto válido.')
            .setColor(0xFF0000);
        return interaction.reply({ embeds: [invalidEmbed], ephemeral: true });
    }

    // Establecer el canal
    setStatusChannelId(channel.id);

    // Obtener estadísticas
    const tasks = loadTasks();
    let totalTasks = 0;
    for (const userId in tasks) {
        totalTasks += Object.keys(tasks[userId]).length;
    }

    // Enviar primer mensaje de estado
    const statusEmbed = createStatusEmbed(totalTasks);
    try {
        await channel.send({ embeds: [statusEmbed] });
    } catch (error) {
        console.error('Error enviando primer mensaje de estado:', error);
    }

    const successEmbed = new EmbedBuilder()
        .setTitle('Canal de estado configurado')
        .setDescription(`El canal <#${channel.id}> ahora mostrará el estado del bot cada 10 minutos.`)
        .setColor(0x00AE86);
    
    return interaction.reply({ embeds: [successEmbed], ephemeral: true });
};
