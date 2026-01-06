const { handleMessage } = require('../src/messageHandler');

// Mock Config
const mockConfig = {
    autoReplyEnabled: true,
    getGreetings: () => ['Hi'],
    genAI: {},
    GEMINI_AVAILABLE: false,
    loadFAQs: () => [],
    logQAtoExcel: () => { },
    logGrievanceToExcel: () => { },
    logReviewToExcel: () => { },
    getFallbackAnswer: () => 'Fallback',
    getPersona: () => 'Bot'
};

// Mock Client and Message
const mockClient = {};
const log = [];

const createMockMsg = (from, body, isStatus = false) => ({
    from,
    body,
    isStatus,
    reply: (text) => log.push(`REPLY to ${from}: ${text}`)
});

async function runTests() {
    console.log('--- TEST START ---');

    // Test 1: Status Update (Should be ignored)
    log.length = 0;
    console.log('Test 1: Status Update');
    await handleMessage(mockClient, createMockMsg('status@broadcast', 'New Status', true), {}, mockConfig);
    if (log.length === 0) console.log('PASS: Ignored Status');
    else console.error('FAIL: Replied to Status:', log);

    // Test 2: Status Update (via ID check only)
    log.length = 0;
    console.log('Test 2: Status Update (ID Check)');
    await handleMessage(mockClient, createMockMsg('status@broadcast', 'New Status', false), {}, mockConfig); // isStatus false, but ID matches
    if (log.length === 0) console.log('PASS: Ignored Status ID');
    else console.error('FAIL: Replied to Status ID:', log);

    // Test 3: Auto-Reply Disabled
    log.length = 0;
    console.log('Test 3: Auto-Reply Disabled');
    const disabledConfig = { ...mockConfig, autoReplyEnabled: false };
    await handleMessage(mockClient, createMockMsg('1234567890@c.us', 'Hi'), {}, disabledConfig);
    if (log.length === 0) console.log('PASS: Ignored message when Auto-Reply is OFF');
    else console.error('FAIL: Replied when Auto-Reply is OFF:', log);

    // Test 4: Normal Message (Should Reply)
    log.length = 0;
    console.log('Test 4: Normal Message');
    const userState = {};
    await handleMessage(mockClient, createMockMsg('1234567890@c.us', 'Hi'), userState, mockConfig);
    if (log.length > 0) console.log('PASS: Replied to normal message');
    else console.error('FAIL: Did not reply to normal message');

    console.log('--- TEST END ---');
}

runTests();
