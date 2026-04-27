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

// Import bot status
const { updateCheckTime, createStatusEmbed, getStatusChannelId, loadBotStatus, saveBotStatus } = require('./botStatus');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
    restRequestTimeout: 60000,
});

const CATEGORY_ID = '1498370661507403936';
const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024; // 50 MB
const tasksFile = path.join(__dirname, 'tasks.json');

function makeChannelName(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 90) || 'tarea';
}

// Load tasks from file
function loadTasks() {
    if (fs.existsSync(tasksFile)) {
        return JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
    }
    return {};
}

// Save tasks to file
function saveTasks(tasks) {
    fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2));
}

function parseReminderInterval(text) {
    if (!text) return 2 * 60 * 60 * 1000;
    const regex = /(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/i;
    const match = text.match(regex);
    if (!match) return null;

    const days = parseInt(match[1] || '0', 10);
    const hours = parseInt(match[2] || '0', 10);
    const minutes = parseInt(match[3] || '0', 10);
    const total = (days * 24 * 60 + hours * 60 + minutes) * 60 * 1000;
    return total > 0 ? total : null;
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
            name: 'puyiii3',
            type: ActivityType.Streaming,
            url: 'https://twitch.tv/puyiii3',
            state: 'made by puyissw | https://github.com/puyiss'
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
    const statusChannelId = getStatusChannelId();
    if (!statusChannelId) return;

    try {
        const channel = await client.channels.fetch(statusChannelId);
        if (!channel) return;

        // Contar tareas totales
        const tasks = loadTasks();
        let totalTasks = 0;
        for (const userId in tasks) {
            totalTasks += Object.keys(tasks[userId]).length;
        }

        // Crear embed de estado
        const statusEmbed = createStatusEmbed(totalTasks);

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
    }
}

async function checkReminders() {
    const tasks = loadTasks();
    const now = Date.now();
    let modified = false;
    
    // Actualizar tiempo de chequeo
    updateCheckTime();

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

        const cancelledEmbed = new EmbedBuilder()
            .setTitle('Tarea cancelada')
            .setDescription(`Se canceló la tarea **${task.title}**.`)
            .setColor(0xFF0000);
        return interaction.update({ embeds: [cancelledEmbed], components: [] });
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
        .setName('seteststatus')
        .setDescription('Configura el canal donde se mostrará el estado del bot')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal donde mostrar el estado')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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