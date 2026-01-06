const transliterate = require('transliteration').transliterate;
const stringSimilarity = require('string-similarity');

const LANGUAGES = {
    en: 'English',
    hi: 'हिन्दी',
    mr: 'मराठी'
};

const getLanguagePrompt = () =>
    `Please select your language:\n1. English\n2. हिन्दी\n3. मराठी\nReply with 1, 2, or 3.`;

function getOptionPrompt(lang) {
    switch (lang) {
        case 'hi':
            return 'कृपया एक विकल्प चुनें:\n1. सामान्य प्रश्न (FAQ)\n2. शिकायत दर्ज करें\n3. हमें रेटिंग दें\nउत्तर में 1, 2 या 3 लिखें।';
        case 'mr':
            return 'कृपया एक पर्याय निवडा:\n1. वारंवार विचारले जाणारे प्रश्न (FAQ)\n2. तक्रार नोंदवा\n3. आम्हाला रेटिंग द्या\nउत्तरात 1, 2 किंवा 3 लिहा.';
        default:
            return 'Please select an option:\n1. Frequently Asked Questions (FAQ)\n2. File a Grievance\n3. Rate our Service\nReply with 1, 2 or 3.';
    }
}

async function handleMessage(client, msg, userState, config) {
    const user = msg.from;

    // CRITICAL: Ignore Status Updates (Broadcasts)
    if (msg.isStatus || user === 'status@broadcast') {
        return;
    }

    // Check Auto-Reply Toggle
    if (config.autoReplyEnabled === false) {
        return;
    }

    // Ignore group messages (automatic replies only for DMs)
    if (user.endsWith('@g.us')) {
        return;
    }

    const { getGreetings, genAI, GEMINI_AVAILABLE, loadFAQs, logQAtoExcel, logGrievanceToExcel, logReviewToExcel, getFallbackAnswer, getPersona } = config;

    // Check for the '!ping' command to reset the session
    if (msg.body.trim().toLowerCase() === '!ping') {
        delete userState[user];
        await msg.reply("Session reset. Please send 'Hi' to start over.");
        return;
    }

    if (!userState[user]) {
        userState[user] = { step: 'language' };
        const greetings = getGreetings();
        const greeting = greetings[Math.floor(Math.random() * greetings.length)];
        await msg.reply(`${greeting}\n\n${getLanguagePrompt()}`);
        return;
    }

    const state = userState[user];
    const input = transliterate(msg.body.trim().toLowerCase());

    if (state.step === 'language') {
        let lang = null;
        if (input === '1') lang = 'en';
        else if (input === '2') lang = 'hi';
        else if (input === '3') lang = 'mr';
        if (!lang) {
            await msg.reply(getLanguagePrompt());
            return;
        }
        state.lang = lang;
        state.step = 'option';
        await msg.reply(getOptionPrompt(lang));
        return;
    }

    if (state.step === 'option') {
        if (msg.body === '1') {
            state.step = 'faq';
            let reply = state.lang === 'hi' ? 'कृपया अपना प्रश्न पूछें (FAQ)।' : state.lang === 'mr' ? 'कृपया आपला प्रश्न विचारा (FAQ).' : 'Please type your FAQ question.';
            await msg.reply(reply);
            return;
        } else if (msg.body === '2') {
            state.step = 'grievance_input';
            let reply = state.lang === 'hi' ? 'कृपया अपनी शिकायत विस्तार से बताएं।' : state.lang === 'mr' ? 'कृपया आपली तक्रार तपशीलवार सांगा.' : 'Please describe your grievance in detail.';
            await msg.reply(reply);
            return;
        } else if (msg.body === '3') {
            state.step = 'rating_input';
            let reply = state.lang === 'hi' ? 'कृपया हमें 1 से 5 तक रेटिंग दें (1 सबसे कम, 5 सबसे अधिक)।' : state.lang === 'mr' ? 'कृपया आम्हाला १ ते ५ पर्यंत रेटिंग द्या (१ सर्वात कमी, ५ सर्वात जास्त).' : 'Please rate our service from 1 to 5 (1 being lowest, 5 being highest).';
            await msg.reply(reply);
            return;
        } else {
            await msg.reply(getOptionPrompt(state.lang));
            return;
        }
    }

    if (state.step === 'grievance_input') {
        logGrievanceToExcel(user, msg.body);
        let reply = state.lang === 'hi' ?
            'हमें हुई असुविधा के लिए हमें गहरा खेद है। हमारी प्रबंधन टीम को सूचित कर दिया गया है और वे तुरंत इस पर ध्यान देंगे।' :
            state.lang === 'mr' ?
                'झालेल्या त्रासाबद्दल आम्हाला मनापासून क्षमस्व आहे. आमच्या व्यवस्थापन टीमला सूचित करण्यात आले आहे आणि ते त्वरित याकडे लक्ष देतील.' :
                'We are sincerely sorry for the inconvenience caused. Our management team has been notified and will look into this immediately.';
        await msg.reply(reply);
        delete userState[user];
        return;
    }

    if (state.step === 'rating_input') {
        const rating = parseInt(msg.body);
        if (isNaN(rating) || rating < 1 || rating > 5) {
            await msg.reply(state.lang === 'hi' ? 'कृपया 1 और 5 के बीच एक नंबर लिखें।' : 'Please enter a valid number between 1 and 5.');
            return;
        }
        state.rating = rating;
        state.step = 'review_input';
        await msg.reply(state.lang === 'hi' ? 'धन्यवाद! क्या आप कोई टिप्पणी या समीक्षा देना चाहेंगे?' : 'Thank you! Would you like to leave a comment or review?');
        return;
    }

    if (state.step === 'review_input') {
        logReviewToExcel(user, state.rating, msg.body);
        let reply = state.lang === 'hi' ?
            'आपकी बहुमूल्य प्रतिक्रिया के लिए धन्यवाद! हमें उम्मीद है कि अगली बार हम आपकी और भी बेहतर सेवा कर पाएंगे।' :
            state.lang === 'mr' ?
                'तुमच्या मौल्यवान अभिप्रायाबद्दल धन्यवाद! आम्हाला आशा आहे की पुढच्या वेळी आम्ही तुमची आणखी चांगली सेवा करू शकू.' :
                'Thank you for your valuable feedback! We hope to serve you even better next time.';
        await msg.reply(reply);
        delete userState[user];
        return;
    }

    if (state.step === 'faq') {
        const question = transliterate(msg.body);
        let answer = '';
        try {
            let translatedQuestion = question;
            if (state.lang !== 'en') {
                try {
                    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
                    const result = await model.generateContent(`Translate to English: ${question}`);
                    translatedQuestion = (await result.response).text().trim();
                } catch (e) { console.error('[Translation] Error:', e.message); }
            }

            const faqs = loadFAQs();
            const questions = faqs.map(f => f.Question);
            const matches = stringSimilarity.findBestMatch(translatedQuestion, questions);
            let faq = matches.bestMatch.rating > 0.5 ? faqs[matches.bestMatchIndex] : null;

            let context;
            if (faq) {
                context = `Relevant FAQ Found:\nQuestion: ${faq.Question}\nTrusted Answer: ${faq.Answer}`;
            } else if (faqs.length > 0) {
                context = `No direct match found in FAQ. Here is the Knowledge Base for reference:\n${faqs.map(f => `Q: ${f.Question}\nA: ${f.Answer}`).join('\n')}\n\nUser Question: ${translatedQuestion}`;
            } else {
                context = `Knowledge Base is CURRENTLY EMPTY.\nUser Question: ${translatedQuestion}`;
            }

            if (!GEMINI_AVAILABLE) {
                answer = getFallbackAnswer(translatedQuestion, faqs, state.lang);
            } else {
                const persona = getPersona();
                const systemPrompt = `SYSTEM INSTRUCTIONS:
- You are a helpful hotel assistant. 
- Use the "FAQ Data" provided below to answer the user's question. 
- If the answer is NOT in the FAQ data, politely say you don't have that information and suggest contacting the front desk.
- Keep your response CONCISE and directly answer the question. 
- Tone: ${persona}
- Reply in: ${state.lang === 'hi' ? 'Hindi' : state.lang === 'mr' ? 'Marathi' : 'English'}.

FAQ Data:
${context}`;
                const model = genAI.getGenerativeModel({
                    model: "gemini-2.5-flash",
                    generationConfig: { temperature: 0.2 }
                });
                const result = await model.generateContent(systemPrompt);
                answer = (await result.response).text();
            }
        } catch (e) {
            console.error('[FAQ] Error:', e.message);
            answer = getFallbackAnswer(question, loadFAQs(), state.lang);
        }
        await msg.reply(answer);
        logQAtoExcel(question, answer);
        state.step = 'faq_followup';
        await msg.reply(state.lang === 'hi' ? 'क्या आप चैट समाप्त करना चाहते हैं? हाँ या नहीं लिखें।' : 'Do you want to end the chat? Type yes or no.');
        return;
    }

    if (state.step === 'faq_followup') {
        const inputStr = msg.body.trim().toLowerCase();
        const isYes = ['yes', 'y', 'ha', 'haan', 'ho', 'hoy'].some(w => inputStr.includes(w));
        if (isYes) {
            delete userState[user];
            await msg.reply(state.lang === 'hi' ? 'चैट समाप्त किया गया। धन्यवाद!' : 'Chat ended. Thank you!');
        } else {
            state.step = 'faq';
            await msg.reply(state.lang === 'hi' ? 'ठीक है! कृपया अपना अगला प्रश्न पूछें।' : 'Great! Please ask your next question.');
        }
        return;
    }
}

module.exports = { handleMessage, getLanguagePrompt, getOptionPrompt };
