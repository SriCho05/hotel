# 🏥 Hotel WhatsApp Bot & Dashboard

This is a complete AI-powered WhatsApp automation system for hotels, featuring a Bulk Messenger, Dynamic FAQ Knowledge Base, and Guest Review tracking.

## 🚀 Quick Setup Instructions

Follow these steps to get the bot running on a new computer:

### 1. Prerequisites
Make sure the computer has **Node.js** installed (Version 18 or higher).
- Check by running: `node -v`
- Download from: [nodejs.org](https://nodejs.org/)

### 2. Installation
Open your terminal (Command Prompt or PowerShell) inside the unzipped project folder and run:

```bash
# Install backend dependencies
npm install

# Install dashboard dependencies
cd dashboard
npm install
cd ..
```

### 3. Get Your API Key
The bot uses **Google Gemini AI**. 
- Go to [Google AI Studio](https://aistudio.google.com/) to get a free API key.
- Currently, the key is hardcoded in `server.js` and `bot.js`. (Tip: You can update it via the dashboard settings or edit the files).

### 4. Run the System
From the main project folder, type:
```bash
npm run dev
```

### 5. Access the Dashboard
Once the command is running:
1. Open your browser and go to: **http://localhost:5173/**
2. You will see a **QR Code**. 
3. Open WhatsApp on your phone -> **Linked Devices** -> **Link a Device**.
4. Scan the code.

---

## 🛠️ How to Use
- **Bulk Messenger**: Upload an Excel file with a "Number" column and send messages/media to guests.
- **Knowledge Base**: Add your hotel's FAQ (WiFi, Check-in times, etc.) in the dashboard.
- **Settings**: Adjust the bot's tone and personality.
- **Logs**: Guest reviews and formal grievances are automatically saved to `reviews.xlsx` and `grievances.xlsx`.

## 📁 Project Structure
- `server.js`: The central "brain" and API server.
- `src/`: Core bot logic and message handling.
- `dashboard/`: The React-based user interface.
- `faqs.xlsx`: Your bot's knowledge source.
- `config.json`: Your bot's saved settings.
