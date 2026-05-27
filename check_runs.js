import https from 'https';

const url = 'https://api.github.com/repos/gowtham5m11/leaderledger/actions/runs?per_page=20';
const options = {
  headers: {
    'User-Agent': 'Mozilla/5.0'
  }
};

https.get(url, options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (!json.workflow_runs) {
        console.log("No runs found in response:", json);
        return;
      }
      for (const run of json.workflow_runs) {
        console.log(`ID: ${run.id} | Name: ${run.name} | Event: ${run.event} | Status: ${run.status} | Conclusion: ${run.conclusion} | Created: ${run.created_at}`);
      }
    } catch (err) {
      console.error("Error parsing JSON:", err);
    }
  });
}).on('error', (err) => {
  console.error("Error fetching runs:", err);
});
