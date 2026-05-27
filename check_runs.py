import urllib.request
import json

url = "https://api.github.com/repos/gowtham5m11/leaderledger/actions/runs?per_page=20"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        for run in data.get('workflow_runs', []):
            print(f"ID: {run['id']} | Name: {run['name']} | Event: {run['event']} | Status: {run['status']} | Conclusion: {run['conclusion']} | Created: {run['created_at']}")
except Exception as e:
    print(f"Error: {e}")
