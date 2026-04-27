const fs = require('fs');
const path = require('path');

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

// Load tasks from file with error handling
function loadTasks() {
    try {
        if (fs.existsSync(tasksFile)) {
            const data = fs.readFileSync(tasksFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading tasks.json:', error);
        // Try to restore from backup if exists
        const backupFile = tasksFile + '.backup';
        if (fs.existsSync(backupFile)) {
            try {
                console.warn('Attempting to restore from backup...');
                const backupData = fs.readFileSync(backupFile, 'utf8');
                const tasks = JSON.parse(backupData);
                fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2));
                console.info('Tasks restored from backup successfully');
                return tasks;
            } catch (backupError) {
                console.error('Backup restore failed:', backupError);
            }
        }
    }
    return {};
}

// Save tasks to file with backup
function saveTasks(tasks) {
    try {
        // Create backup before overwriting
        const backupFile = tasksFile + '.backup';
        if (fs.existsSync(tasksFile)) {
            fs.copyFileSync(tasksFile, backupFile);
        }
        // Write new data
        fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2));
    } catch (error) {
        console.error('Error saving tasks:', error);
        throw error;
    }
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

module.exports = {
    CATEGORY_ID,
    MAX_ATTACHMENT_SIZE,
    makeChannelName,
    loadTasks,
    saveTasks,
    parseReminderInterval,
    safeInteractionReply
};