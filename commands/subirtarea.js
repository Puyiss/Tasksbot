const { EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { CATEGORY_ID, MAX_ATTACHMENT_SIZE, loadTasks, saveTasks, parseReminderInterval, makeChannelName, safeInteractionReply } = require('../utils');

module.exports = async (interaction) => {
    await interaction.deferReply({ ephemeral: false });

    try {
        const nombre = interaction.options.getString('nombre');
        const nota = interaction.options.getString('nota');
        const attachment = interaction.options.getAttachment('archivo');
        const attachmentTooLarge = attachment?.size > MAX_ATTACHMENT_SIZE;
        const attachmentAllowed = attachment && !attachmentTooLarge;
        const dueDate = interaction.options.getString('fecha');
        const reminder = interaction.options.getString('recordatorio');

        if (!dueDate) {
            return await safeInteractionReply(interaction, { content: 'Debes proporcionar la fecha de entrega.' });
        }

        
        const parsedDueDate = new Date(dueDate);
        if (isNaN(parsedDueDate)) {
            return await safeInteractionReply(interaction, { content: 'Fecha inválida. Usa formato YYYY-MM-DD.' });
        }

        const intervalMs = parseReminderInterval(reminder);
        if (!intervalMs) {
            return await safeInteractionReply(interaction, { content: 'Recordatorio inválido. Usa formatos como "30m", "2h" o "1d".' });
        }

        const title = nombre?.trim() || (attachment ? `Tarea: ${attachment.name}` : 'Tarea sin nombre');

        // Load tasks
        const tasks = loadTasks();
        if (!tasks[interaction.user.id]) {
            tasks[interaction.user.id] = {};
        }

        const taskId = Date.now().toString();
        let channelName = null;

        // Create channel FIRST (before saving task to avoid orphaned channels on restart)
        if (interaction.guild) {
            const category = interaction.guild.channels.cache.get(CATEGORY_ID);
            if (category && category.type === ChannelType.GuildCategory) {
                const rawChannelName = makeChannelName(title);
                const dateShort = parsedDueDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
                channelName = `${rawChannelName}-${dateShort}`;
                let suffix = 1;
                while (interaction.guild.channels.cache.some(channel => channel.parentId === CATEGORY_ID && channel.name === channelName)) {
                    channelName = `${rawChannelName}-${dateShort}-${suffix}`;
                    suffix += 1;
                }

                try {
                    const channel = await interaction.guild.channels.create({
                        name: channelName,
                        type: ChannelType.GuildText,
                        parent: CATEGORY_ID,
                        reason: `Canal creado para la tarea ${title}`
                    });

                    const taskEmbed = new EmbedBuilder()
                        .setTitle(`${title} (${dateShort})`)
                        .setColor(0x00AE86)
                        .addFields(
                            { name: 'Recordatorio', value: reminder || '2h', inline: true },
                            { name: 'Fecha entrega', value: dateShort, inline: true },
                            { name: 'Estado', value: '⏳ Pendiente', inline: true }
                        );

                    if (nota) {
                        taskEmbed.addFields({ name: 'Nota', value: nota });
                    }

                    // Crear botones interactivos
                    const buttons = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`complete-task-${taskId}`)
                                .setLabel('✅ Completar')
                                .setStyle(ButtonStyle.Success),
                            new ButtonBuilder()
                                .setCustomId(`cancel-task-${taskId}`)
                                .setLabel('❌ Cancelar')
                                .setStyle(ButtonStyle.Danger)
                        );

                    const sendOptions = { embeds: [taskEmbed], components: [buttons] };
                    if (attachmentAllowed) {
                        if (attachment.contentType && attachment.contentType.startsWith('image/')) {
                            taskEmbed.setImage(attachment.url);
                        } else {
                            sendOptions.files = [attachment.url];
                        }
                    } else if (attachmentTooLarge) {
                        taskEmbed.addFields({ name: 'Archivo omitido', value: 'El archivo supera 50 MB y no se adjuntó.' });
                    }

                    await channel.send(sendOptions);
                } catch (channelError) {
                    console.error('Error creando canal de tarea:', channelError);
                    // Continue anyway, task will be created without channel
                }
            } else {
                console.warn(`Categoría no encontrada o no es categoría: ${CATEGORY_ID}`);
            }
        }

        // NOW save task with channelName (if channel was created)
        tasks[interaction.user.id][taskId] = {
            title,
            note: nota?.trim() || '',
            attachmentUrl: attachmentAllowed ? attachment.url : null,
            dueDate: parsedDueDate.toISOString(),
            reminder: reminder || '2h',
            reminderIntervalMs: intervalMs,
            nextReminder: Date.now() + intervalMs,
            channelName: channelName // Will be null if channel creation failed, but that's okay
        };

        saveTasks(tasks);

        const replyEmbed = new EmbedBuilder()
            .setTitle('Tarea creada')
            .setDescription(`Recibirás recordatorios cada ${reminder || '2h'} hasta la fecha de entrega: ${new Date(dueDate).toLocaleDateString('es-ES')}`)
            .setColor(0x00AE86);

        if (attachmentTooLarge) {
            replyEmbed.addFields({ name: 'Advertencia', value: 'El archivo pesa más de 50 MB y no se adjuntó al canal.' });
        }

        return await safeInteractionReply(interaction, { embeds: [replyEmbed] });
    } catch (error) {
        console.error('Error en /subirtarea:', error);
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error al crear la tarea')
            .setDescription('Ocurrió un problema al crear la tarea. Intenta de nuevo en unos segundos.')
            .setColor(0xFF0000);
        return await safeInteractionReply(interaction, { embeds: [errorEmbed], ephemeral: true });
    }
};