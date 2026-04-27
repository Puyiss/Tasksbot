const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { CATEGORY_ID, loadTasks, saveTasks } = require('../utils');

module.exports = async (interaction) => {
    const tasks = loadTasks();
    const userTasks = tasks[interaction.user.id] || {};
    const taskEntries = Object.entries(userTasks);

    if (taskEntries.length === 0) {
        const emptyEmbed = new EmbedBuilder()
            .setTitle('No hay tareas para cancelar')
            .setColor(0xFFCC00);
        return interaction.reply({ embeds: [emptyEmbed], ephemeral: true });
    }

    const taskOption = interaction.options.getString('tarea');
    if (taskOption) {
        const search = taskOption.toLowerCase();
        const match = taskEntries.find(([taskId, task]) =>
            taskId === taskOption ||
            task.title.toLowerCase() === search ||
            task.channelName?.toLowerCase() === search ||
            task.title.toLowerCase().includes(search) ||
            task.channelName?.toLowerCase().includes(search)
        );
        if (!match) {
            const notFoundEmbed = new EmbedBuilder()
                .setTitle('Tarea no encontrada')
                .setDescription('No pude encontrar esa tarea. Usa el nombre exacto o selecciona desde el menú.')
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [notFoundEmbed], ephemeral: true });
        }
        const [taskId, task] = match;
        if (task.channelName && interaction.guild) {
            const channel = interaction.guild.channels.cache.find(ch => ch.name === task.channelName && ch.parentId === CATEGORY_ID);
            if (channel) await channel.delete('Tarea cancelada');
        }
        delete userTasks[taskId];
        saveTasks(tasks);

        const cancelledEmbed = new EmbedBuilder()
            .setTitle('Tarea cancelada')
            .setDescription(`Se canceló la tarea **${task.title}**.`)
            .setColor(0xFF0000);
        return interaction.reply({ embeds: [cancelledEmbed], ephemeral: false });
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId('cancel-task-select')
        .setPlaceholder('Elegí la tarea a cancelar')
        .addOptions(taskEntries.map(([taskId, task]) => ({
            label: task.title.substring(0, 100),
            description: `Fecha: ${new Date(task.dueDate).toLocaleDateString('es-ES')}`,
            value: taskId
        })));

    const row = new ActionRowBuilder().addComponents(select);
    const chooseEmbed = new EmbedBuilder()
        .setTitle('Cancelar tarea')
        .setDescription('Seleccioná la tarea que querés cancelar:')
        .setColor(0x00AE86);

    return interaction.reply({ embeds: [chooseEmbed], components: [row], ephemeral: true });
};
