const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { loadTasks, saveTasks, parseReminderInterval, safeInteractionReply } = require('../utils');

module.exports = async (interaction) => {
    const tasks = await loadTasks();
    const userTasks = tasks[interaction.user.id] || {};
    const taskEntries = Object.entries(userTasks);

    if (taskEntries.length === 0) {
        const emptyEmbed = new EmbedBuilder()
            .setTitle('No hay tareas para editar')
            .setDescription('No tienes tareas pendientes.')
            .setColor(0xFFCC00);
        return interaction.reply({ embeds: [emptyEmbed], ephemeral: true });
    }

    const taskOption = interaction.options.getString('tarea');

    if (taskOption) {
        // User provided task name directly
        const search = taskOption.toLowerCase();
        const match = taskEntries.find(([taskId, task]) =>
            taskId === taskOption ||
            task.title.toLowerCase() === search ||
            task.title.toLowerCase().includes(search)
        );

        if (!match) {
            const notFoundEmbed = new EmbedBuilder()
                .setTitle('Tarea no encontrada')
                .setDescription('No pude encontrar esa tarea.')
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [notFoundEmbed], ephemeral: true });
        }

        return showEditModal(interaction, match[0], match[1], userTasks);
    } else {
        // Show selection menu for all tasks
        const select = new StringSelectMenuBuilder()
            .setCustomId('edit-task-select')
            .setPlaceholder('Seleccioná la tarea a editar')
            .addOptions(taskEntries.map(([taskId, task]) => ({
                label: task.title.substring(0, 100),
                description: `Fecha: ${new Date(task.dueDate).toLocaleDateString('es-ES')}`,
                value: taskId
            })));

        const row = new ActionRowBuilder().addComponents(select);
        const chooseEmbed = new EmbedBuilder()
            .setTitle('Editar tarea')
            .setDescription('Seleccioná la tarea que querés editar:')
            .setColor(0x00AE86);

        return interaction.reply({ embeds: [chooseEmbed], components: [row], ephemeral: true });
    }
};

async function showEditModal(interaction, taskId, task, userTasks) {
    const modal = new ModalBuilder()
        .setCustomId(`edit-task-modal-${taskId}`)
        .setTitle('Editar Tarea');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('edit-title')
                .setLabel('Nombre de la tarea')
                .setStyle(TextInputStyle.Short)
                .setValue(task.title)
                .setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('edit-date')
                .setLabel('Fecha de entrega (YYYY-MM-DD)')
                .setStyle(TextInputStyle.Short)
                .setValue(new Date(task.dueDate).toISOString().split('T')[0])
                .setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('edit-reminder')
                .setLabel('Recordatorio (30m, 2h, 1d, etc.)')
                .setStyle(TextInputStyle.Short)
                .setValue(task.reminder || '2h')
                .setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('edit-note')
                .setLabel('Nota/Descripción')
                .setStyle(TextInputStyle.Paragraph)
                .setValue(task.note || '')
                .setRequired(false)
        )
    );

    await interaction.showModal(modal);
}
