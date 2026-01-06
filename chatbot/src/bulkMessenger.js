const XLSX = require('xlsx');
const { MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');

/**
 * Sends messages in bulk based on an Excel file.
 * @param {Client} client - WhatsApp client instance
 * @param {string} excelPath - Path to the Excel file
 * @param {string} staticMessage - The text message to send to all contacts
 * @param {string} mediaCaption - Custom caption for all media files
 * @param {Array} mediaFiles - Array of media file objects { path, mimetype, filename }
 * @param {Function} onProgress - Callback for progress updates
 */
async function sendBulkMessages(client, excelPath, staticMessage, mediaCaption, mediaFiles = [], onProgress = () => { }) {
    try {
        const workbook = XLSX.readFile(excelPath);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        const total = data.length;
        let sent = 0;
        let failed = 0;

        for (const row of data) {
            const rawNumber = row.Number || row.Phone || row.Contact;
            const message = staticMessage;

            if (!rawNumber) {
                console.warn(`[Bulk] Missing number in row: ${JSON.stringify(row)}`);
                failed++;
                continue;
            }

            // Clean number and format
            let number = rawNumber.toString().replace(/\D/g, '');
            if (!number.endsWith('@c.us')) {
                number += '@c.us';
            }

            try {
                // Validate if number is on WhatsApp
                const isRegistered = await client.isRegisteredUser(number);
                if (!isRegistered) {
                    throw new Error('Not a WhatsApp number');
                }

                // Track internal flags for partial success
                let textSent = false;
                let mediaSentCount = 0;

                // Send text message if present
                if (message) {
                    await client.sendMessage(number, message);
                    textSent = true;
                }

                // Send media files if present
                for (const file of mediaFiles) {
                    // Create MessageMedia explicitly using mimetype and base64
                    // This ensures images/videos render correctly even without file extensions on disk
                    const media = new MessageMedia(
                        file.mimetype,
                        fs.readFileSync(file.path).toString('base64'),
                        file.originalname
                    );

                    // Use custom caption if provided, otherwise fallback to filename
                    const caption = mediaCaption || file.originalname || '';
                    await client.sendMessage(number, media, { caption });
                    mediaSentCount++;
                }

                sent++;
                onProgress({
                    sent, failed, total,
                    current: number,
                    status: mediaSentCount < mediaFiles.length ? 'Sent (Partial Media Error)' : 'Sent'
                });
            } catch (err) {
                console.error(`[Bulk] Error for ${number}:`, err.message);
                failed++;
                onProgress({
                    sent, failed, total,
                    current: number,
                    status: 'Failed',
                    error: err.message
                });
            }

            // Random delay between 2-5 seconds to avoid bans
            const delay = Math.floor(Math.random() * 3000) + 2000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        return { sent, failed, total };
    } catch (error) {
        console.error('[Bulk] Fatal Error:', error.message);
        throw error;
    }
}

module.exports = { sendBulkMessages };
