const { EmbedBuilder } = require('discord.js');
const { CATEGORY_ID, loadTasks, saveTasks, addToHistory } = require('../utils');

module.exports = async (interaction) => {
    const tasks = await loadTasks();
    const userTasks = tasks[interaction.user.id] || {};
    const taskEntries = Object.entries(userTasks);

    if (taskEntries.length === 0) {
        const emptyEmbed = new EmbedBuilder()
            .setTitle('No hay tareas')
            .setDescription('No tienes tareas pendientes para cancelar.')
            .setColor(0xFFCC00);
        return interaction.reply({ embeds: [emptyEmbed], ephemeral: true });
    }

    // Guardar todas las tareas en historial antes de eliminarlas
    for (const [taskId, task] of taskEntries) {
        addToHistory(interaction.user.id, { id: taskId, ...task }, 'cancelled', 'Canceladas todas desde /cancelartareas');
    }

    if (interaction.guild) {
        for (const [, task] of taskEntries) {
            if (task.channelName) {
                const channel = interaction.guild.channels.cache.find(ch => ch.name === task.channelName && ch.parentId === CATEGORY_ID);
                if (channel) await channel.delete('Tareas canceladas');
            }
        }
    }

    delete tasks[interaction.user.id];
    await saveTasks(tasks);

    const cancelAllEmbed = new EmbedBuilder()
        .setTitle('Todas las tareas canceladas')
        .setDescription('Se cancelaron todas tus tareas y se borraron los canales correspondientes.')
        .setColor(0xFF0000);
    return interaction.reply({ embeds: [cancelAllEmbed], ephemeral: false });
};
