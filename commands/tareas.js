const { EmbedBuilder } = require('discord.js');
const { loadTasks } = require('../utils');

module.exports = async (interaction) => {
    const tasks = await loadTasks();
    const userTasks = tasks[interaction.user.id] || {};
    const taskEntries = Object.entries(userTasks);

    if (taskEntries.length === 0) {
        const emptyEmbed = new EmbedBuilder()
            .setTitle('No hay tareas')
            .setDescription('No tienes tareas pendientes. Usa /subirtarea para agregar una.')
            .setColor(0xFFCC00);
        return interaction.reply({ embeds: [emptyEmbed], ephemeral: true });
    }

    const tasksEmbed = new EmbedBuilder()
        .setTitle('Tus tareas pendientes')
        .setColor(0x00AE86);

    taskEntries.forEach(([taskId, task]) => {
        const noteLine = task.note ? `\nNota: ${task.note}` : '';
        tasksEmbed.addFields({
            name: task.title,
            value: `Fecha entrega: ${new Date(task.dueDate).toLocaleString('es-ES')}\nRecordatorio: ${task.reminder}${noteLine}`
        });
    });

    await interaction.reply({ embeds: [tasksEmbed], ephemeral: true });
};
