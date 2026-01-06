const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { handleMessage } = require('./src/messageHandler');
const { sendBulkMessages } = require('./src/bulkMessenger');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const XLSX = require('xlsx');

// Configuration
// Configuration
const PORT = process.env.PORT || 3001;
// Default key preserved from previous hardcoded value
const DEFAULT_GEMINI_KEY = 'AIzaSyAvdY1CLzVcyVr-WyGGK7F77KM-F2eywEk';

const UPLOADS_DIR = 'uploads';
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

const CONFIG_FILE = 'config.json';
function loadConfig() {
    let config = {
        greetings: ["Hi!", "Hello!"],
        persona: "Helpful assistant.",
        geminiEnabled: true,
        autoReplyEnabled: true,
        geminiApiKey: DEFAULT_GEMINI_KEY
    };

    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            config = { ...config, ...fileConfig };
            // Ensure default key is set if missing in file
            if (!config.geminiApiKey) config.geminiApiKey = DEFAULT_GEMINI_KEY;
        } catch (e) {
            console.error("Error loading config:", e);
        }
    }
    return config;
}

let botSettings = loadConfig();

// Initialize Gemini with the key from settings
let genAI = new GoogleGenerativeAI(botSettings.geminiApiKey || DEFAULT_GEMINI_KEY);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

// WhatsApp Client Setup (Robust Puppeteer Config)
const os = require('os');
const puppeteerArgs = [
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-extensions',
    '--disable-plugins',
    '--disable-default-apps',
    '--no-sandbox',
    '--disable-setuid-sandbox'
];

let executablePath = undefined;
if (os.platform() === 'win32') {
    const chromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Chromium\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Chromium\\Application\\chrome.exe'
    ];
    for (const path of chromePaths) {
        if (fs.existsSync(path)) {
            executablePath = path;
            break;
        }
    }
} else if (os.platform() === 'linux') {
    const linuxChromePaths = ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
    for (const path of linuxChromePaths) {
        if (fs.existsSync(path)) {
            executablePath = path;
            break;
        }
    }
}

let client;
let qrCode = null;
let connectionStatus = 'DISCONNECTED';
const userState = {};

// Bot Configuration (shared with handler)
const botConfig = {
    // Dynamic getter for genAI to ensure it uses the latest key
    get genAI() { return genAI; },
    get GEMINI_AVAILABLE() { return botSettings.geminiEnabled; },
    getPersona: () => botSettings.persona,
    getGreetings: () => botSettings.greetings,
    getFallbackAnswer: (question, faqs, lang) => {
        // Simple keyword-based fallback if AI fails or is disabled
        const q = question.toLowerCase();
        for (const f of faqs) {
            if (q.includes(f.Question.toLowerCase()) || f.Question.toLowerCase().includes(q)) {
                return f.Answer;
            }
        }
        return lang === 'hi' ? 'क्षमा करें, मुझे उसका उत्तर नहीं मिला। कृपया बाद में पुनः प्रयास करें।' :
            lang === 'mr' ? 'क्षमस्व, मला त्याचे उत्तर सापडले नाही. कृपया पुन्हा प्रयत्न करा.' :
                'I am sorry, I do not have information on that. Please try again or contact our front desk.';
    },
    loadFAQs: () => {
        if (!fs.existsSync('faqs.xlsx')) {
            return [];
        }
        const workbook = XLSX.readFile('faqs.xlsx');
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        return XLSX.utils.sheet_to_json(sheet, { header: ['Question', 'Answer'], range: 1 });
    },
    // Implementations of log functions
    logQAtoExcel: (question, answer) => {
        const file = 'data.xlsx';
        let ws, wb;
        if (fs.existsSync(file)) {
            wb = XLSX.readFile(file);
            ws = wb.Sheets[wb.SheetNames[0]];
        } else {
            wb = XLSX.utils.book_new();
            ws = XLSX.utils.aoa_to_sheet([['Date', 'Question', 'Answer']]);
            XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        }
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        data.push([new Date().toLocaleString(), question, answer]);
        wb.Sheets[wb.SheetNames[0]] = XLSX.utils.aoa_to_sheet(data);
        XLSX.writeFile(wb, file);
    },
    logGrievanceToExcel: (user, description) => {
        const file = 'grievances.xlsx';
        let ws, wb;
        if (fs.existsSync(file)) {
            wb = XLSX.readFile(file);
            ws = wb.Sheets[wb.SheetNames[0]];
        } else {
            wb = XLSX.utils.book_new();
            ws = XLSX.utils.aoa_to_sheet([['Date', 'User', 'Description']]);
            XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        }
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        data.push([new Date().toLocaleString(), user, description]);
        wb.Sheets[wb.SheetNames[0]] = XLSX.utils.aoa_to_sheet(data);
        XLSX.writeFile(wb, file);
    },
    logReviewToExcel: (user, rating, review) => {
        const file = 'reviews.xlsx';
        let ws, wb;
        if (fs.existsSync(file)) {
            wb = XLSX.readFile(file);
            ws = wb.Sheets[wb.SheetNames[0]];
        } else {
            wb = XLSX.utils.book_new();
            ws = XLSX.utils.aoa_to_sheet([['Date', 'User', 'Rating', 'Review']]);
            XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        }
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        data.push([new Date().toLocaleString(), user, rating, review]);
        wb.Sheets[wb.SheetNames[0]] = XLSX.utils.aoa_to_sheet(data);
        XLSX.writeFile(wb, file);
    },
    getFallbackAnswer: (q, f, l) => "AI is currently unavailable. Please contact the hotel directly."
};

/**
 * Robustly deletes a folder with retries (Wait for file locks to release)
 */
async function deleteFolderRecursive(folderPath, retries = 5, delay = 2000) {
    if (!fs.existsSync(folderPath)) return;

    for (let i = 0; i < retries; i++) {
        try {
            fs.rmSync(folderPath, { recursive: true, force: true });
            console.log(`✅ Deleted: ${folderPath}`);
            return;
        } catch (err) {
            console.warn(`⚠️ Failed to delete ${folderPath} (Attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`);
            if (i === retries - 1) console.error(`❌ Permanent failure deleting ${folderPath}:`, err.message);
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

async function createWhatsAppClient() {
    connectionStatus = 'INITIALIZING';
    io.emit('status', connectionStatus);

    client = new Client({
        authStrategy: new LocalAuth({ dataPath: './auth_session' }),
        puppeteer: {
            args: puppeteerArgs,
            headless: true,
            ...(executablePath ? { executablePath } : {})
        },
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
        }
    });

    client.on('qr', (qr) => {
        qrCode = qr;
        connectionStatus = 'WAITING_FOR_SCAN';
        io.emit('qr', qr);
        io.emit('status', connectionStatus);
        console.log('QR Received');
    });

    client.on('ready', () => {
        qrCode = null;
        connectionStatus = 'CONNECTED';
        io.emit('status', connectionStatus);
        io.emit('qr', null);
        console.log('Client is ready!');
    });

    client.on('message', async msg => {
        await handleMessage(client, msg, userState, botConfig);
    });

    client.on('disconnected', async (reason) => {
        console.log('⚠️ Client Disconnected:', reason);
        connectionStatus = 'DISCONNECTED';
        io.emit('status', connectionStatus);
        io.emit('qr', null); // Clear QR on disconnect

        // Destroy client to release file locks
        try {
            await client.destroy();
            console.log('🛑 Client destroyed.');
        } catch (e) {
            console.error('Error destroying client:', e);
        }

        // Wait a bit for processes to fully exit
        await new Promise(r => setTimeout(r, 3000));

        if (reason === 'LOGOUT' || reason === 'NAVIGATION') {
            const sessionPath = path.resolve('./auth_session');
            console.log(`Cleaning up session data at: ${sessionPath}`);
            await deleteFolderRecursive(sessionPath);

            console.log('🔄 Restarting client...');
            createWhatsAppClient();
        }
    });

    client.on('loading_screen', (percent, message) => {
        console.log('LOADING SCREEN', percent, message);
    });

    client.on('authenticated', () => {
        console.log('AUTHENTICATED');
    });

    client.on('auth_failure', msg => {
        console.error('AUTHENTICATION FAILURE', msg);
    });

    client.on('error', (err) => {
        console.error('WhatsApp Client Error:', err);
        io.emit('error', 'WhatsApp Client Error');
    });

    console.log('🚀 Initializing WhatsApp client...');
    try {
        await client.initialize();
        console.log('✅ Initialization call completed.');
    } catch (err) {
        console.error('❌ Failed to initialize:', err.message);
        connectionStatus = 'ERROR';
        io.emit('status', connectionStatus);
        // Retry logic could go here, or just let the user restart
    }
}

// Start the client
createWhatsAppClient();

// API Endpoints
app.get('/api/config', (req, res) => {
    res.json(botSettings);
});

app.post('/api/config', (req, res) => {
    const oldKey = botSettings.geminiApiKey;
    botSettings = { ...botSettings, ...req.body };

    // If key changed, re-initialize Gemini
    if (botSettings.geminiApiKey && botSettings.geminiApiKey !== oldKey) {
        console.log('Gemini API Key updated, re-initializing client...');
        genAI = new GoogleGenerativeAI(botSettings.geminiApiKey);
    }

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(botSettings, null, 2));
    res.json({ message: 'Config updated successfully', config: botSettings });
});

app.post('/api/test-gemini', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) {
        return res.json({ success: false, error: 'API Key is missing' });
    }

    try {
        const tempGenAI = new GoogleGenerativeAI(apiKey);
        const model = tempGenAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent("Hello! Are you working?");
        const response = await result.response;
        const text = response.text();
        res.json({ success: true, message: 'Connection Successful! AI replied: ' + text.substring(0, 50) + '...' });
    } catch (error) {
        console.error('Gemini Test Error:', error);
        let errorMsg = error.message;
        if (errorMsg.includes('429')) errorMsg = 'Rate Limit Exceeded (Quota Check)';
        if (errorMsg.includes('400')) errorMsg = 'Invalid API Key or Bad Request';
        res.json({ success: false, error: errorMsg });
    }
});

app.get('/api/faqs', (req, res) => {
    const faqs = botConfig.loadFAQs();
    res.json(faqs);
});

app.post('/api/faqs', (req, res) => {
    const { faqs } = req.body; // Expecting array of {Question, Answer}
    const wb = XLSX.utils.book_new();
    const wsData = [['Question', 'Answer'], ...faqs.map(f => [f.Question, f.Answer])];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, 'faqs.xlsx');
    res.json({ message: 'FAQs updated successfully' });
});

app.get('/api/grievances', (req, res) => {
    const file = 'grievances.xlsx';
    if (!fs.existsSync(file)) return res.json([]);
    const workbook = XLSX.readFile(file);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    res.json(data);
});

app.get('/api/reviews', (req, res) => {
    const file = 'reviews.xlsx';
    if (!fs.existsSync(file)) return res.json([]);
    const workbook = XLSX.readFile(file);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    res.json(data);
});

app.get('/api/status', (req, res) => {
    res.json({ status: connectionStatus, qr: qrCode });
});

app.post('/api/bulk-send', upload.fields([{ name: 'excel', maxCount: 1 }, { name: 'media' }]), async (req, res) => {
    if (!req.files || !req.files.excel) {
        return res.status(400).json({ error: 'Excel file is required' });
    }

    const excelPath = req.files.excel[0].path;
    const mediaFiles = req.files.media || [];
    const staticMessage = req.body.message || ''; // Get static message from request
    const mediaCaption = req.body.mediaCaption || ''; // Get media caption from request

    try {
        res.json({ message: 'Bulk sending started' });

        await sendBulkMessages(client, excelPath, staticMessage, mediaCaption, mediaFiles, (progress) => {
            io.emit('bulk-progress', progress);
        });

        // Cleanup
        if (fs.existsSync(excelPath)) fs.unlinkSync(excelPath);
        mediaFiles.forEach(f => {
            if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
