const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const cors = require('cors');
const { OpenAI } = require('openai'); 
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const upload = multer();

const client = new OpenAI({
  apiKey: process.env.ANTHROPIC_API_KEY, 
  baseURL: 'https://api.perplexity.ai'
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('Literatus API (Robust Reasoning) Running'));

// --- HELPER FUNCTION TO CLEAN AI OUTPUT ---
function cleanAIResponse(rawText) {
  // 1. Remove <think> tags and everything inside them
  let clean = rawText.replace(/<think>[\s\S]*?<\/think>/g, '');
  
  // 2. Remove markdown code blocks
  clean = clean.replace(/```json/g, '').replace(/```/g, '');
  
  // 3. Find the actual JSON object (start at first '{', end at last '}')
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1) {
    clean = clean.substring(firstBrace, lastBrace + 1);
  }
  
  return clean.trim();
}

// 1. PDF IMPORT
app.post('/api/upload-pdf', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send({ error: 'No file' });

  try {
    const data = await pdf(req.file.buffer);
    const fullText = data.text;

    const completion = await client.chat.completions.create({
      model: "sonar-pro", 
      messages: [
        { role: "system", content: "You are a JSON extractor. Output valid JSON only." },
        { role: "user", content: `Extract metadata (title, authors array, year, journal, abstract, methodology array) from: ${fullText.substring(0, 5000)}` }
      ]
    });

    const cleanJson = cleanAIResponse(completion.choices[0].message.content);
    res.json(JSON.parse(cleanJson));

  } catch (error) {
    console.error("PDF Error:", error);
    res.status(500).json({ error: "PDF Extraction Failed" });
  }
});

// 2. ANALYSIS
app.post('/api/analyze', async (req, res) => {
  const { abstract, title } = req.body;
  
  try {
    const completion = await client.chat.completions.create({
      model: "sonar-reasoning-pro", 
      messages: [
        { role: "system", content: "You are a Senior Researcher. Output valid JSON only." },
        { role: "user", content: `Analyze: "${title}". Abstract: "${abstract}"
        
        Return JSON with:
        1. keyFindings: 3 complex insights.
        2. relevanceScore: 0-100 score.
        3. gaps: 2 critical limitations.
        4. keywords: 5 semantic topics.` }
      ]
    });

    // Clean the "thinking" out before parsing
    const cleanJson = cleanAIResponse(completion.choices[0].message.content);
    res.json(JSON.parse(cleanJson));

  } catch (error) {
    console.error("Analysis Error:", error);
    res.status(500).json({ error: "Analysis Failed" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
