const XLSX = require('xlsx');
const fs = require('fs');

const file = 'faqs.xlsx';
let faqs = [];

if (fs.existsSync(file)) {
    const workbook = XLSX.readFile(file);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    faqs = XLSX.utils.sheet_to_json(sheet);
}

// Update the specific map link
const mapLink = "https://maps.app.goo.gl/vXPx1io4upRv99987";

const addressIndex = faqs.findIndex(f => f.Question.toLowerCase().includes('address') || f.Question.toLowerCase().includes('location'));

if (addressIndex !== -1) {
    faqs[addressIndex].Answer = `We are located at Plot No. 10, P.C. Pawar Marg, Gangapur Rd, Anandvalli, Nashik.\n\n📍 View on Google Maps: ${mapLink}`;
} else {
    faqs.push({
        Question: "Where are you located?",
        Answer: `We are located at Plot No. 10, P.C. Pawar Marg, Gangapur Rd, Anandvalli, Nashik.\n\n📍 View on Google Maps: ${mapLink}`
    });
}

const wb = XLSX.utils.book_new();
const wsData = [['Question', 'Answer'], ...faqs.map(f => [f.Question, f.Answer])];
const ws = XLSX.utils.aoa_to_sheet(wsData);
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
XLSX.writeFile(wb, file);

console.log('faqs.xlsx updated with the NEW Google Maps link!');
