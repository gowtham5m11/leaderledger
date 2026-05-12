import json
import os

JSON_PATH = "/Users/gowthamjadapalli/Documents/GitHub/knowyourleader/src/data/candidates.json"

updates = {
    47: "completed B.Sc from Govt. Degree College, Rajahmundry in 1987",
    90: "completed 10th Pass (SSC) from R.T.H High School, Guntur in 1989",
    103: "completed 12th Pass from National Open School, New Delhi in 2022",
    120: "completed B.E Mechanical Engineering from Osmania University in 1990",
    121: "completed B.A. from S.V. University, Tirupati in 1995",
    125: "completed B.Tech from P.E.S. Institute of Technology, Bangalore in 1998",
    127: "completed MBBS from Kurnool Medical College in 1989",
    128: "completed Graduate (B.Com) from S.V University in 1992",
    172: "completed M.Sc and Ph.D in Zoology from S.V University, Tirupati",
    174: "completed 5th Pass from Upper Primary School, Gollapalle in 1992"
}

with open(JSON_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

count = 0
for cand in data:
    if cand['id'] in updates:
        cand['education'] = updates[cand['id']]
        count += 1

with open(JSON_PATH, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print(f"✅ Successfully updated {count} candidates.")
