require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ChannelType, EmbedBuilder, ActivityType, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const { CATEGORY_ID, MAX_ATTACHMENT_SIZE, TASKS_FILE } = require('./config');

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

// Load tasks from file
function loadTasks() {
    if (fs.existsSync(TASKS_FILE)) {
        return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
    }
    return {};
}

// Save tasks to file
function saveTasks(tasks) {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
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
            state: 'Viendo Tareas 👀'
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
        const statusChannelId = getStatusChannelId();
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
            const taskIds = Object.keys(userTasks);

            for (const taskId of taskIds) {
                const task = userTasks[taskId];
                const dueDate = new Date(task.dueDate).getTime();
                const dueDateFormatted = new Date(task.dueDate).toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });

                if (dueDate <= now) {
                    try {
                        const user = await client.users.fetch(userId);
                        const overdueEmbed = new EmbedBuilder()
                            .setTitle('🚨 Tarea vencida y eliminada')
                            .setDescription(`La tarea **${task.title}** venció el **${dueDateFormatted}** y fue eliminada automáticamente de tu lista.`)
                            .setColor(0xFF4500)
                            .addFields(
                                { name: 'Tarea', value: task.title, inline: false },
                                { name: 'Fecha de entrega', value: dueDateFormatted, inline: true },
                                { name: 'Recordatorio', value: task.reminder || '2h', inline: true }
                            )
                            .setFooter({ text: 'Volvé a crear la tarea si todavía la necesitás.' });

                        if (task.note) {
                            overdueEmbed.addFields({ name: 'Nota', value: task.note });
                        }

                        await user.send({ content: `<@${user.id}>`, embeds: [overdueEmbed] });
                    } catch (error) {
                        console.error(`Error sending overdue message to ${userId}:`, error);
                    }

                    if (task.channelName) {
                        const channel = client.channels.cache.find(
                            (ch) => ch.name === task.channelName && ch.parentId === CATEGORY_ID
                        );
                        if (channel) {
                            try {
                                await channel.delete('Tarea vencida eliminada automáticamente');
                            } catch (channelError) {
                                console.error('Error deleting overdue task channel:', channelError);
                            }
                        }
                    }

                    delete userTasks[taskId];
                    modified = true;
                    continue;
                }

                while (task.nextReminder <= now) {
                    try {
                        const user = await client.users.fetch(userId);
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

            if (Object.keys(userTasks).length === 0) {
                delete tasks[userId];
                modified = true;
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
    if (interaction.isModalSubmit() && interaction.customId === subirtarea.MODAL_ID) {
        return await subirtarea.handleModalSubmit(interaction);
    }

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
        return await subirtarea.run(interaction);
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
        .setDescription('Abre el formulario para subir una tarea (fecha, nombre, recordatorio, nota)'),
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