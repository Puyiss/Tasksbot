const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const CATEGORY_ID = '1498370661507403936';
const DEFAULT_STATUS_CHANNEL_ID = null;
const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024; // 50 MB

const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const BOT_STATUS_FILE = path.join(DATA_DIR, 'botStatus.json');

module.exports = {
    DATA_DIR,
    TASKS_FILE,
    BOT_STATUS_FILE,
    CATEGORY_ID,
    DEFAULT_STATUS_CHANNEL_ID,
    MAX_ATTACHMENT_SIZE
};
