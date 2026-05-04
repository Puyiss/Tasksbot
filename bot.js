require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ChannelType, EmbedBuilder, ActivityType, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Import commands
const subirtarea = require('./commands/subirtarea');
const cancelartarea = require('./commands/cancelartarea');
const cancelartareas = require('./commands/cancelartareas');
const tareas = require('./commands/tareas');
const seteststatus = require('./commands/seteststatus');
const dashboard = require('./commands/dashboard');
const backup = require('./commands/backup');
const editartareas = require('./commands/editartareas');
const historial = require('./commands/historial');

// Import bot status
const { updateCheckTime, createStatusEmbed, getStatusChannelId, loadBotStatus, saveBotStatus } = require('./botStatus');

// Import utils
const { loadTasks, saveTasks, parseReminderInterval, makeChannelName, CATEGORY_ID, MAX_ATTACHMENT_SIZE, addToHistory, getHistory } = require('./utils');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
    restRequestTimeout: 60000,
});

const tasksFile = path.join(__dirname, 'data', 'tasks.json');

function loadTasksFile() {
    if (fs.existsSync(tasksFile)) {
        return JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
    }
    return {};
}

function saveTasksFile(tasks) {
    fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2));
}

async function safeInteractionReply(interaction, options) {
    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(options);
        }
        return await interaction.reply(options);
    } catch (error) {
        console.warn('safeInteractionReply falló, intentando followUp:', error);
        if (interaction.deferred || interaction.replied) {
            try {
                return await interaction.followUp(options);
            } catch (followUpError) {
                console.error('FollowUp falló después de safeInteractionReply:', followUpError);
            }
        }
        if (!interaction.replied) {
            try {
                return await interaction.reply(options);
            } catch (replyError) {
                console.error('Reply falló después de safeInteractionReply:', replyError);
            }
        }
    }
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // Initialize bot status on startup
    const status = loadBotStatus();
    saveBotStatus(status);
    
    client.user.setPresence({
        activities: [{
            name: 'Transmitiendo',
            type: ActivityType.Streaming,
            url: 'https://twitch.tv/puyiii3',
            state: ' OwO'
        }],
        status: 'online'
    });
    // Start reminder interval
    setInterval(checkReminders, 60 * 1000); // Every minute
    // Start status update interval (every 10 minutes)
    setInterval(updateStatusChannel, 10 * 60 * 1000);
    // Initial status update
    updateStatusChannel();
});

async function updateStatusChannel() {
    try {
        const statusChannelId = await getStatusChannelId();
        if (!statusChannelId) return;

        const channel = await client.channels.fetch(statusChannelId);
        if (!channel) return;

        // Contar tareas totales
        const tasks = loadTasks();
        let totalTasks = 0;
        for (const userId in tasks) {
            totalTasks += Object.keys(tasks[userId]).length;
        }

        // Crear embed de estado
        const statusEmbed = await createStatusEmbed(totalTasks);

        // Obtener últimos mensajes del canal
        const messages = await channel.messages.fetch({ limit: 1 });
        const lastMessage = messages.first();

        if (lastMessage && lastMessage.author.id === client.user.id) {
            // Editar último mensaje
            await lastMessage.edit({ embeds: [statusEmbed] });
        } else {
            // Enviar nuevo mensaje
            await channel.send({ embeds: [statusEmbed] });
        }
    } catch (error) {
        console.error('Error actualizando canal de estado:', error);
        // Continue running, don't crash
    }
}

async function checkReminders() {
    try {
        const tasks = loadTasks();
        const now = Date.now();
        let modified = false;
        
        // Actualizar tiempo de chequeo
        await updateCheckTime();

        for (const userId in tasks) {
            const userTasks = tasks[userId];
            for (const taskId in userTasks) {
                const task = userTasks[taskId];
                const dueDate = new Date(task.dueDate).getTime();
                if (dueDate <= now) continue;

                while (task.nextReminder <= now) {
                    try {
                        const user = await client.users.fetch(userId);
                        const dueDateFormatted = new Date(task.dueDate).toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
                        const reminderEmbed = new EmbedBuilder()
                            .setTitle(`Hola ${user.username} 👋`)
                            .setDescription(`Tenés que hacer lo de ${task.channelName ? `#${task.channelName}` : 'tu tarea'}`)
                            .setColor(0x8A2BE2)
                            .addFields(
                                { name: 'Tarea', value: task.title, inline: false },
                                { name: 'Fecha de entrega', value: dueDateFormatted, inline: true },
                                { name: 'Recordatorio', value: task.reminder, inline: true }
                            );

                        if (task.note) {
                            reminderEmbed.addFields({ name: 'Nota', value: task.note });
                        }

                        for (let i = 0; i < 3; i += 1) {
                            await user.send({ content: `<@${user.id}>`, embeds: [reminderEmbed] });
                        }
                    } catch (error) {
                        console.error(`Error sending reminder to ${userId}:`, error);
                        break;
                }
                task.nextReminder += task.reminderIntervalMs;
                modified = true;
            }
        }
    }

    if (modified) {
        saveTasks(tasks);
    }
    } catch (error) {
        console.error('Critical error in checkReminders():', error);
        // Continue running even if something fails
    }
}

client.on('interactionCreate', async interaction => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'cancel-task-select') {
        const tasks = loadTasks();
        const userTasks = tasks[interaction.user.id] || {};
        const taskId = interaction.values[0];
        const task = userTasks[taskId];
        if (!task) {
            const expiredEmbed = new EmbedBuilder()
                .setTitle('Tarea no encontrada')
                .setColor(0xFF0000);
            return interaction.update({ embeds: [expiredEmbed], components: [] });
        }

        if (task.channelName && interaction.guild) {
            const channel = interaction.guild.channels.cache.find(ch => ch.name === task.channelName && ch.parentId === CATEGORY_ID);
            if (channel) await channel.delete('Tarea cancelada');
        }

        delete userTasks[taskId];
        saveTasks(tasks);
        addToHistory(interaction.user.id, { id: taskId, ...task }, 'cancelled', 'Cancelada desde select menu');

        const cancelledEmbed = new EmbedBuilder()
            .setTitle('Tarea cancelada')
            .setDescription(`Se canceló la tarea **${task.title}**.`)
            .setColor(0xFF0000);
        return interaction.update({ embeds: [cancelledEmbed], components: [] });
    }

    // Manejar select menu para editar tareas
    if (interaction.isStringSelectMenu() && interaction.customId === 'edit-task-select') {
        const tasks = loadTasks();
        const userTasks = tasks[interaction.user.id] || {};
        const taskId = interaction.values[0];
        const task = userTasks[taskId];
        
        if (!task) {
            const expiredEmbed = new EmbedBuilder()
                .setTitle('Tarea no encontrada')
                .setColor(0xFF0000);
            return interaction.update({ embeds: [expiredEmbed], components: [] });
        }

        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
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

    // Manejar modal submit para editar tareas
    if (interaction.isModalSubmit() && interaction.customId.startsWith('edit-task-modal-')) {
        await interaction.deferReply({ ephemeral: true });
        const taskId = interaction.customId.replace('edit-task-modal-', '');
        
        try {
            const tasks = loadTasks();
            const userTasks = tasks[interaction.user.id] || {};
            const task = userTasks[taskId];

            if (!task) {
                return await interaction.editReply({ content: '❌ Tarea no encontrada', ephemeral: true });
            }

            const newTitle = interaction.fields.getTextInputValue('edit-title') || task.title;
            const newDateStr = interaction.fields.getTextInputValue('edit-date');
            const newReminder = interaction.fields.getTextInputValue('edit-reminder') || task.reminder;
            const newNote = interaction.fields.getTextInputValue('edit-note') || task.note;

            // Validar fecha
            if (newDateStr) {
                const parsedDate = new Date(newDateStr);
                if (isNaN(parsedDate)) {
                    return await interaction.editReply({ content: '❌ Fecha inválida. Usa formato YYYY-MM-DD', ephemeral: true });
                }
                task.dueDate = parsedDate.toISOString();
            }

            // Validar recordatorio
            if (newReminder) {
                const interval = parseReminderInterval(newReminder);
                if (!interval) {
                    return await interaction.editReply({ content: '❌ Recordatorio inválido. Usa formatos como "30m", "2h" o "1d".', ephemeral: true });
                }
                task.reminder = newReminder;
                task.reminderIntervalMs = interval;
                task.nextReminder = Date.now() + interval;
            }

            task.title = newTitle;
            task.note = newNote;

            saveTasks(tasks);

            const editedEmbed = new EmbedBuilder()
                .setTitle('✅ Tarea editada correctamente')
                .setDescription(`Actualizamos **${newTitle}**`)
                .addFields(
                    { name: 'Nueva fecha', value: new Date(task.dueDate).toLocaleDateString('es-ES'), inline: true },
                    { name: 'Nuevo recordatorio', value: task.reminder, inline: true },
                    { name: 'Nueva nota', value: newNote || 'Sin nota', inline: false }
                )
                .setColor(0x00FF00);

            return await interaction.editReply({ embeds: [editedEmbed], ephemeral: true });
        } catch (error) {
            console.error('Error editando tarea:', error);
            return await interaction.editReply({ content: '❌ Error al editar la tarea', ephemeral: true });
        }
    }

    // Manejar botón de completar tarea
    if (interaction.isButton() && interaction.customId.startsWith('complete-task-')) {
        await interaction.deferUpdate();
        const taskId = interaction.customId.replace('complete-task-', '');
        const tasks = loadTasks();
        const userTasks = tasks[interaction.user.id] || {};
        const task = userTasks[taskId];

        if (!task) {
            const expiredEmbed = new EmbedBuilder()
                .setTitle('Tarea no encontrada')
                .setColor(0xFF0000);
            return interaction.editReply({ embeds: [expiredEmbed], components: [] });
        }

        // Marcar tarea como completada
        task.isCompleted = true;
        task.completedAt = new Date().toISOString();
        saveTasks(tasks);
        addToHistory(interaction.user.id, { id: taskId, ...task }, 'completed');

        // Actualizar el embed
        const completedEmbed = new EmbedBuilder()
            .setTitle(`${task.title} (COMPLETADA)`)
            .setColor(0x00FF00)
            .addFields(
                { name: 'Recordatorio', value: task.reminder || '2h', inline: true },
                { name: 'Fecha entrega', value: new Date(task.dueDate).toLocaleDateString('es-ES'), inline: true },
                { name: 'Estado', value: '✅ Completada', inline: true }
            );

        if (task.note) {
            completedEmbed.addFields({ name: 'Nota', value: task.note });
        }

        return interaction.editReply({ embeds: [completedEmbed], components: [] });
    }

    // Manejar botón de cancelar tarea
    if (interaction.isButton() && interaction.customId.startsWith('cancel-task-')) {
        await interaction.deferUpdate();
        const taskId = interaction.customId.replace('cancel-task-', '');
        const tasks = loadTasks();
        const userTasks = tasks[interaction.user.id] || {};
        const task = userTasks[taskId];

        if (!task) {
            const expiredEmbed = new EmbedBuilder()
                .setTitle('Tarea no encontrada')
                .setColor(0xFF0000);
            return interaction.editReply({ embeds: [expiredEmbed], components: [] });
        }

        // Eliminar el canal de la tarea si existe
        if (task.channelName && interaction.guild) {
            const channel = interaction.guild.channels.cache.find(ch => ch.name === task.channelName && ch.parentId === CATEGORY_ID);
            if (channel) await channel.delete('Tarea cancelada');
        }

        delete userTasks[taskId];
        saveTasks(tasks);
        addToHistory(interaction.user.id, { id: taskId, ...task }, 'cancelled', 'Cancelada desde botón');

        const cancelledEmbed = new EmbedBuilder()
            .setTitle('Tarea cancelada')
            .setDescription(`Se canceló la tarea **${task.title}**.`)
            .setColor(0xFF0000);
        return interaction.editReply({ embeds: [cancelledEmbed], components: [] });
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'subirtarea') {
        return await subirtarea(interaction);
    }

    if (interaction.commandName === 'cancelartarea') {
        return await cancelartarea(interaction);
    }

    if (interaction.commandName === 'cancelartareas') {
        return await cancelartareas(interaction);
    }

    if (interaction.commandName === 'tareas') {
        return await tareas(interaction);
    }

    if (interaction.commandName === 'seteststatus') {
        return await seteststatus(interaction);
    }

    if (interaction.commandName === 'dashboard') {
        return await dashboard(interaction);
    }

    if (interaction.commandName === 'backup') {
        return await backup(interaction);
    }

    if (interaction.commandName === 'editartareas') {
        return await editartareas(interaction);
    }

    if (interaction.commandName === 'historial') {
        return await historial(interaction);
    }

});

// Deploy commands
const commands = [
    new SlashCommandBuilder()
        .setName('subirtarea')
        .setDescription('Sube una tarea con nombre, fecha de entrega y recordatorio')
        .addStringOption(option =>
            option.setName('fecha')
                .setDescription('Fecha de entrega (ej: 2023-12-31)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('nombre')
                .setDescription('Nombre de la tarea')
                .setRequired(false))
        .addAttachmentOption(option =>
            option.setName('archivo')
                .setDescription('Archivo o foto de la tarea (opcional)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('recordatorio')
                .setDescription('Tipo de recordatorio (ej: 30m, 2h, 1d)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('nota')
                .setDescription('Información extra o nota para la tarea')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('tareas')
        .setDescription('Muestra tus tareas pendientes'),
    new SlashCommandBuilder()
        .setName('cancelartarea')
        .setDescription('Cancela una tarea específica')
        .addStringOption(option =>
            option.setName('tarea')
                .setDescription('Nombre o canal de la tarea')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('cancelartareas')
        .setDescription('Cancela todas tus tareas pendientes'),
    new SlashCommandBuilder()
        .setName('editartareas')
        .setDescription('Edita una tarea existente (nombre, fecha, recordatorio, nota)')
        .addStringOption(option =>
            option.setName('tarea')
                .setDescription('Nombre de la tarea a editar')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('seteststatus')
        .setDescription('Configura el canal donde se mostrará el estado del bot')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal donde mostrar el estado')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('dashboard')
        .setDescription('Muestra tu dashboard de productividad con estadísticas'),
    new SlashCommandBuilder()
        .setName('historial')
        .setDescription('Muestra el historial de tus tareas completadas y canceladas'),
    new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Crea un backup de tus tareas')
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

client.login(process.env.DISCORD_TOKEN);