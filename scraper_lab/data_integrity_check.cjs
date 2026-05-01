const fs = require('fs');
const path = require('path');

const candidatesPath = path.join(__dirname, '../src/data/candidates.json');

try {
    const candidates = JSON.parse(fs.readFileSync(candidatesPath, 'utf8'));
    
    let totalWebsiteCases = 0;
    let totalGatheredCases = 0;
    let mismatchCount = 0;

    console.log(`${"Candidate Name".padEnd(45)} | ${"Website".padEnd(8)} | ${"Gathered".padEnd(8)} | Diff`);
    console.log("-".repeat(80));

    candidates.forEach(cand => {
        const name = cand.name || "Unknown";
        
        // Website data
        const webCasesRaw = cand.criminal_cases;
        let webCases = 0;
        if (typeof webCasesRaw === 'number') {
            webCases = webCasesRaw;
        } else if (typeof webCasesRaw === 'string') {
            const match = webCasesRaw.match(/\d+/);
            webCases = match ? parseInt(match[0]) : 0;
        }

        // Gathered data
        const gatheredCases = cand.criminal_summary ? (cand.criminal_summary.num_criminal_cases || 0) : 0;

        totalWebsiteCases += webCases;
        totalGatheredCases += gatheredCases;

        if (webCases !== gatheredCases) {
            mismatchCount++;
            const diff = gatheredCases - webCases;
            const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;
            console.log(`${name.padEnd(45)} | ${webCases.toString().padEnd(8)} | ${gatheredCases.toString().padEnd(8)} | ${diffStr}`);
        }
    });

    console.log("-".repeat(80));
    console.log(`TOTALS:`);
    console.log(`Website displayed cases: ${totalWebsiteCases}`);
    console.log(`Gathered from PDFs:      ${totalGatheredCases}`);
    console.log(`Total Mismatches found:  ${mismatchCount}`);

    if (totalWebsiteCases === totalGatheredCases) {
        console.log("\nSUCCESS: All counts match perfectly!");
    } else {
        console.log("\nWARNING: Discrepancies found between website data and PDF extraction.");
    }
} catch (e) {
    console.error("Error reading candidates.json:", e.message);
}
