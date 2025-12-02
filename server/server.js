const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const cors = require('cors');
// NOTE: Perplexity uses the OpenAI library structure, not Anthropic
const { OpenAI } = require('openai'); 
require('dotenv').config();

const app = express();
// Use the PORT Render gives us
const PORT = process.env.PORT || 3001;

const upload = multer();

// Initialize Perplexity Client
// IMPORTANT: You must still use 'ANTHROPIC_API_KEY' in Render 
// (or change the variable name there to PERPLEXITY_API_KEY and update it here)
const client = new OpenAI({
  apiKey: process.env.ANTHROPIC_API_KEY, 
  baseURL: 'https://api.perplexity.ai'
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('Literatus API (Perplexity) Running'));

// 1. PDF IMPORT
app.post('/api/upload-pdf', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send({ error: 'No file' });

  try {
    const data = await pdf(req.file.buffer);
    const fullText = data.text;

    const completion = await client.chat.completions.create({
      model: "sonar", // Perplexity model
      messages: [
        { role: "system", content: "You are a JSON extractor. Return ONLY valid JSON." },
        { role: "user", content: `Extract JSON (title, authors array, year, journal, abstract, methodology array) from: ${fullText.substring(0, 3000)}` }
      ]
    });

    // Clean up markdown code blocks if Perplexity adds them
    let raw = completion.choices[0].message.content;
    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    
    res.json(JSON.parse(raw));

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Perplexity Parsing Failed" });
  }
});

// 2. ANALYSIS
app.post('/api/analyze', async (req, res) => {
  const { abstract, title } = req.body;
  
  try {
    const completion = await client.chat.completions.create({
      model: "sonar-pro",
      messages: [
        { role: "system", content: "You are a research assistant. Return ONLY valid JSON." },
        { role: "user", content: `Analyze: ${title} - ${abstract}. Return JSON with: keyFindings (3 strings), relevanceScore (int), gaps (2 strings), keywords (5 strings).` }
      ]
    });

    let raw = completion.choices[0].message.content;
    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();

    res.json(JSON.parse(raw));

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Perplexity Analysis Failed" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
