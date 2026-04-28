const fs = require('fs');
const path = require('path');
const { Task } = require('./models');
const { testConnection } = require('./database');

const CATEGORY_ID = '1498370661507403936';
const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024; // 50 MB
const tasksFile = path.join(__dirname, 'data', 'tasks.json');

// Variable para saber si usar DB o archivos
let useDatabase = false;

// Inicializar conexión a DB
async function initializeDatabase() {
    try {
        const connected = await testConnection();
        if (connected) {
            useDatabase = true;
            console.log('📊 Usando base de datos MySQL');
        } else {
            useDatabase = false;
            console.log('📁 Usando archivos JSON (fallback)');
        }
    } catch (error) {
        console.error('Error inicializando base de datos:', error);
        useDatabase = false;
    }
}

function makeChannelName(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 90) || 'tarea';
}

// Load tasks from database or file
async function loadTasks() {
    if (useDatabase) {
        try {
            const tasks = await Task.findAll();
            const tasksObj = {};
            tasks.forEach(task => {
                if (!tasksObj[task.userId]) {
                    tasksObj[task.userId] = {};
                }
                tasksObj[task.userId][task.id] = {
                    title: task.title,
                    note: task.note,
                    attachmentUrl: task.attachmentUrl,
                    dueDate: task.dueDate.toISOString(),
                    reminder: task.reminder,
                    reminderIntervalMs: task.reminderIntervalMs,
                    nextReminder: task.nextReminder.toISOString(),
                    channelName: task.channelName
                };
            });
            return tasksObj;
        } catch (error) {
            console.error('Error loading tasks from database:', error);
            return loadTasksFromFile();
        }
    } else {
        return loadTasksFromFile();
    }
}

// Load tasks from file (fallback)
function loadTasksFromFile() {
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

// Save tasks to database or file
async function saveTasks(tasks) {
    if (useDatabase) {
        try {
            // Clear existing tasks
            await Task.destroy({ where: {} });

            // Insert new tasks
            const taskRecords = [];
            for (const userId in tasks) {
                for (const taskId in tasks[userId]) {
                    const task = tasks[userId][taskId];
                    taskRecords.push({
                        id: taskId,
                        userId: userId,
                        title: task.title,
                        note: task.note || '',
                        attachmentUrl: task.attachmentUrl || null,
                        dueDate: new Date(task.dueDate),
                        reminder: task.reminder || '2h',
                        reminderIntervalMs: task.reminderIntervalMs || 7200000,
                        nextReminder: new Date(task.nextReminder),
                        channelName: task.channelName || null
                    });
                }
            }

            if (taskRecords.length > 0) {
                await Task.bulkCreate(taskRecords);
            }
        } catch (error) {
            console.error('Error saving tasks to database:', error);
            // Fallback to file
            saveTasksToFile(tasks);
        }
    } else {
        saveTasksToFile(tasks);
    }
}

// Save tasks to file (fallback)
function saveTasksToFile(tasks) {
    try {
        // Ensure directory exists
        const dir = path.dirname(tasksFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
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
    safeInteractionReply,
    initializeDatabase
};