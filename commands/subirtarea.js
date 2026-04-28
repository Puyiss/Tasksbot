const {
    EmbedBuilder,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require('discord.js');
const {
    CATEGORY_ID,
    loadTasks,
    saveTasks,
    parseReminderInterval,
    makeChannelName,
    safeInteractionReply
} = require('../utils');

const MODAL_ID = 'subirtarea_modal';
const FIELD_FECHA = 'subirtarea_fecha';
const FIELD_NOMBRE = 'subirtarea_nombre';
const FIELD_RECORDATORIO = 'subirtarea_recordatorio';
const FIELD_NOTA = 'subirtarea_nota';

/** Paso 1: /subirtarea abre el formulario tipo modal */
async function run(interaction) {
    const modal = new ModalBuilder()
        .setCustomId(MODAL_ID)
        .setTitle('Subir tarea');

    const fechaInput = new TextInputBuilder()
        .setCustomId(FIELD_FECHA)
        .setLabel('Fecha de entrega (YYYY-MM-DD)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 2025-12-31')
        .setRequired(true)
        .setMinLength(8)
        .setMaxLength(32);

    const nombreInput = new TextInputBuilder()
        .setCustomId(FIELD_NOMBRE)
        .setLabel('Nombre de la tarea')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Opcional')
        .setRequired(false)
        .setMaxLength(200);

    const recordatorioInput = new TextInputBuilder()
        .setCustomId(FIELD_RECORDATORIO)
        .setLabel('Recordatorio (ej: 30m, 2h, 1d)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Por defecto: 2h')
        .setRequired(false)
        .setMaxLength(20);

    const notaInput = new TextInputBuilder()
        .setCustomId(FIELD_NOTA)
        .setLabel('Nota o información extra')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Opcional')
        .setRequired(false)
        .setMaxLength(1000);

    modal.addComponents(
        new ActionRowBuilder().addComponents(fechaInput),
        new ActionRowBuilder().addComponents(nombreInput),
        new ActionRowBuilder().addComponents(recordatorioInput),
        new ActionRowBuilder().addComponents(notaInput)
    );

    await interaction.showModal(modal);
}

/** Paso 2: usuario envía el modal → crear tarea (misma lógica que antes, sin archivo adjunto en el formulario) */
async function handleModalSubmit(interaction) {
    await interaction.deferReply({ ephemeral: false });

    try {
        const dueDate = interaction.fields.getTextInputValue(FIELD_FECHA).trim();
        const nombre = interaction.fields.getTextInputValue(FIELD_NOMBRE)?.trim() || '';
        const reminderRaw = interaction.fields.getTextInputValue(FIELD_RECORDATORIO)?.trim() || '';
        const nota = interaction.fields.getTextInputValue(FIELD_NOTA)?.trim() || '';

        const reminder = reminderRaw || null;

        if (!dueDate) {
            return await safeInteractionReply(interaction, { content: 'Debés indicar la fecha de entrega.' });
        }

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dueDate)) {
            return await safeInteractionReply(interaction, {
                content: 'Fecha inválida. Usá formato **YYYY-MM-DD** (ej: 2025-12-31).'
            });
        }

        const [year, month, day] = dueDate.split('-').map(Number);
        const parsedDueDate = new Date(year, month - 1, day);
        if (
            Number.isNaN(parsedDueDate.getTime()) ||
            parsedDueDate.getFullYear() !== year ||
            parsedDueDate.getMonth() !== month - 1 ||
            parsedDueDate.getDate() !== day
        ) {
            return await safeInteractionReply(interaction, {
                content: 'Fecha inválida. Usá formato **YYYY-MM-DD** y un día real del calendario.'
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (parsedDueDate < today) {
            return await safeInteractionReply(interaction, {
                content: 'La fecha de entrega no puede ser pasada. Elegí hoy o una fecha futura.'
            });
        }

        const intervalMs = parseReminderInterval(reminder);
        if (!intervalMs) {
            return await safeInteractionReply(interaction, {
                content: 'Recordatorio inválido. Usá formatos como **30m**, **2h** o **1d**, o dejalo vacío para 2h.'
            });
        }

        const title = nombre || 'Tarea sin nombre';

        const tasks = await loadTasks();
        if (!tasks[interaction.user.id]) {
            tasks[interaction.user.id] = {};
        }

        const taskId = Date.now().toString();
        let channelName = null;

        if (interaction.guild) {
            const category = interaction.guild.channels.cache.get(CATEGORY_ID);
            if (category && category.type === ChannelType.GuildCategory) {
                const rawChannelName = makeChannelName(title);
                const dateShort = parsedDueDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
                channelName = `${rawChannelName}-${dateShort}`;
                let suffix = 1;
                while (
                    interaction.guild.channels.cache.some(
                        (ch) => ch.parentId === CATEGORY_ID && ch.name === channelName
                    )
                ) {
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
                        .setColor(0x00ae86)
                        .addFields(
                            { name: 'Recordatorio', value: reminder || '2h', inline: true },
                            { name: 'Fecha entrega', value: dateShort, inline: true }
                        );

                    if (nota) {
                        taskEmbed.addFields({ name: 'Nota', value: nota });
                    }

                    taskEmbed.addFields({
                        name: 'Archivos',
                        value: 'Podés adjuntar fotos o archivos enviando un mensaje en este canal.'
                    });

                    await channel.send({ embeds: [taskEmbed] });
                } catch (channelError) {
                    console.error('Error creando canal de tarea:', channelError);
                }
            } else {
                console.warn(`Categoría no encontrada o no es categoría: ${CATEGORY_ID}`);
            }
        }

        tasks[interaction.user.id][taskId] = {
            title,
            note: nota,
            attachmentUrl: null,
            dueDate: parsedDueDate.toISOString(),
            reminder: reminder || '2h',
            reminderIntervalMs: intervalMs,
            nextReminder: Date.now() + intervalMs,
            channelName
        };

        await saveTasks(tasks);

        const replyEmbed = new EmbedBuilder()
            .setTitle('Tarea creada')
            .setDescription(
                `Recibirás recordatorios cada **${reminder || '2h'}** hasta la fecha de entrega: **${new Date(dueDate).toLocaleDateString('es-ES')}**`
            )
            .setColor(0x00ae86);

        return await safeInteractionReply(interaction, { embeds: [replyEmbed] });
    } catch (error) {
        console.error('Error en modal subirtarea:', error);
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error al crear la tarea')
            .setDescription('Ocurrió un problema al crear la tarea. Intentá de nuevo en unos segundos.')
            .setColor(0xff0000);
        return await safeInteractionReply(interaction, { embeds: [errorEmbed], ephemeral: true });
    }
}

module.exports = {
    MODAL_ID,
    run,
    handleModalSubmit
};
