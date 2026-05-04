const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Modelo para Tareas
const Task = sequelize.define('Task', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: false,
        index: true
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    note: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    attachmentUrl: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    dueDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    reminder: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: '2h'
    },
    reminderIntervalMs: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    nextReminder: {
        type: DataTypes.DATE,
        allowNull: false
    },
    channelName: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    isCompleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    completedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'tasks',
    indexes: [
        {
            fields: ['userId']
        },
        {
            fields: ['dueDate']
        },
        {
            fields: ['nextReminder']
        }
    ]
});

// Modelo para Estado del Bot
const BotStatus = sequelize.define('BotStatus', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    startTime: {
        type: DataTypes.DATE,
        allowNull: false
    },
    lastCheckTime: {
        type: DataTypes.DATE,
        allowNull: false
    },
    nextCheckTime: {
        type: DataTypes.DATE,
        allowNull: false
    },
    statusChannelId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    isOnline: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    totalTasks: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: 'bot_status'
});

module.exports = {
    Task,
    BotStatus
};
