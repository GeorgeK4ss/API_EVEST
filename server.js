/* Lightweight API to read/write referral options stored in src/data/referralData.json.
   Runs locally so additions are persisted to the actual file. */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.API_PORT || 4000;
const DATA_FILE = path.join(__dirname, 'src', 'data', 'referralData.json');

// Only these parameters are user-editable / persisted.
const EDITABLE_KEYS = ['affiliate_id', 'campaign_id', 'utm_campaign'];

app.use(cors());
app.use(express.json());

const readData = () => {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const data = JSON.parse(raw);
  data.options = data.options || {};
  data.labels = data.labels || {};
  EDITABLE_KEYS.forEach((key) => {
    data.options[key] = data.options[key] || [];
    data.labels[key] = data.labels[key] || {};
  });
  return data;
};

const writeData = (data) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
};

// Return the full stored dataset.
app.get('/api/referral', (req, res) => {
  try {
    res.json(readData());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new option { key, value, label? } and persist it to the file.
app.post('/api/referral', (req, res) => {
  const { key, value, label } = req.body || {};
  if (!EDITABLE_KEYS.includes(key)) {
    return res.status(400).json({ error: `Key "${key}" is not editable` });
  }
  const cleanValue = (value || '').toString().trim();
  if (!cleanValue) {
    return res.status(400).json({ error: 'Value is required' });
  }

  try {
    const data = readData();
    if (!data.options[key].includes(cleanValue)) {
      data.options[key].push(cleanValue);
    }
    const cleanLabel = (label || '').toString().trim();
    if (cleanLabel) {
      data.labels[key][cleanValue] = cleanLabel;
    }
    writeData(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Referral API running on http://localhost:${PORT}`);
});
