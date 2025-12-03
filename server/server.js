const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const cors = require('cors');
const { OpenAI } = require('openai'); 
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const upload = multer();

// Initialize Perplexity Client
const client = new OpenAI({
  apiKey: process.env.ANTHROPIC_API_KEY, 
  baseURL: 'https://api.perplexity.ai'
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('Literatus API (Perplexity Sonar-Reasoning) Running'));

// 1. PDF IMPORT - Use "sonar-pro" (Smart & Stable)
app.post('/api/upload-pdf', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send({ error: 'No file' });

  try {
    const data = await pdf(req.file.buffer);
    const fullText = data.text;

    // We use sonar-pro here because it follows instructions better than basic sonar
    const completion = await client.chat.completions.create({
      model: "sonar-pro", 
      messages: [
        { role: "system", content: "You are a precise data extraction engine. You always output valid JSON and nothing else." },
        { role: "user", content: `Extract the following metadata from this text into a JSON object: { title, authors (array), year, journal, abstract, methodology (array of keywords) }. 
        
        Text: ${fullText.substring(0, 6000)}` }
      ]
    });

    let raw = completion.choices[0].message.content;
    // Clean up if the AI adds markdown ticks
    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    
    res.json(JSON.parse(raw));

  } catch (error) {
    console.error("PDF Parsing Error:", error);
    res.status(500).json({ error: "PDF Extraction Failed" });
  }
});

// 2. ANALYSIS - Use "sonar-reasoning-pro" (The "Thinking" Model)
app.post('/api/analyze', async (req, res) => {
  const { abstract, title } = req.body;
  
  try {
    // This model will "think" and search specifically to validate the paper
    const completion = await client.chat.completions.create({
      model: "sonar-reasoning-pro", 
      messages: [
        { role: "system", content: "You are a Senior Research Scientist. Perform a deep reasoning analysis." },
        { role: "user", content: `Analyze this paper: "${title}". 
        Abstract: "${abstract}"
        
        Return a JSON object with:
        1. keyFindings: 3 complex, high-level insights.
        2. relevanceScore: 0-100 score of scientific rigor.
        3. gaps: 2 critical limitations or future research directions.
        4. keywords: 5 distinct semantic topics.` }
      ]
    });

    let raw = completion.choices[0].message.content;
    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();

    res.json(JSON.parse(raw));

  } catch (error) {
    console.error("Analysis Error:", error);
    // Fallback: If reasoning fails (it has stricter rate limits), try standard pro
    res.status(500).json({ error: "Analysis Failed. Check logs." });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
