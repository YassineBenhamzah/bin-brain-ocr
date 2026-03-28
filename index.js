const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
app.get('/', (req, res) => {
  res.json({ status: 'non' });
});
app.get('/hamza', (req, res) => {
  res.json({ status: 'hamza' });
});



app.listen(3000, () => console.log('OCR service running on port 3000'));
