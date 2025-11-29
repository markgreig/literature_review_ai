const express = require('express');
const multer = require('multer'); // Middleware for handling file uploads
const pdf = require('pdf-parse'); // Library to extract text from PDFs
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
const PORT = 3001;

// Configure Multer to store files in memory (as buffers)
const upload = multer(); 

// --- CONFIGURATION ---

// Initialize Claude SDK. It automatically looks for ANTHROPIC_API_KEY in .env
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, 
});

// Configure CORS to allow requests from your React app (default port 3000)
app.use(cors({
    origin: 'http://localhost:3000' 
}));
app.use(express.json());

// --- ENDPOINTS ---

/**
 * 1. PDF IMPORT ENDPOINT
 * Feature: PDF Import — Parse uploaded PDFs to auto-extract metadata
 */
app.post('/api/upload-pdf', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send({ error: 'No file uploaded.' });
  }

  try {
    // 1a. Extract raw text from PDF buffer
    const data = await pdf(req.file.buffer);
    const fullText = data.text;

    if (!fullText) {
        return res.status(400).send({ error: "Could not extract any text from the PDF." });
    }

    // 1b. Use Claude (Haiku for speed) to structure the messy text into JSON metadata
    const prompt = `Extract the following JSON from the provided paper text. Return ONLY the JSON object, nothing else.
    Fields required:
    - title (string)
    - authors (array of strings, format as "Last, F.")
    - year (integer)
    - journal (string)
    - abstract (string, summary of the first 200 words)
    - methodology (array of strings, identifying up to 5 key methods)
    
    Paper Text Snippet (first 4000 chars):\n\n${fullText.substring(0, 4000)}`;

    const completion = await anthropic.messages.create({
      model: "claude-3-haiku-20240307", 
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }]
    });

    // Attempt to parse the AI's JSON response
    const rawText = completion.content[0].text.trim();
    let metadata;
    try {
        metadata = JSON.parse(rawText);
    } catch (e) {
        // If parsing fails, we return the text for manual inspection on the frontend
        return res.status(500).json({ error: "AI extraction failed to produce valid JSON.", rawOutput: rawText });
    }

    res.json(metadata);

  } catch (error) {
    console.error("PDF Processing Error:", error);
    res.status(500).json({ error: `Failed to process PDF: ${error.message}` });
  }
});


/**
 * 2. AI ANALYSIS ENDPOINT
 * Feature: Real AI integration — Connect to Claude's API for actual paper summarization
 */
app.post('/api/analyze', async (req, res) => {
  const { abstract, title } = req.body;

  if (!abstract) {
    return res.status(400).send({ error: "Abstract is required for analysis." });
  }
  
  try {
    const prompt = `You are an expert academic research assistant. Analyze the following paper abstract and title.
    
    Title: ${title}
    Abstract: ${abstract}
    
    Based on this information, provide a critical summary in a single JSON object with the following strict structure:
    1. "keyFindings": Array of 3 highly specific strings summarizing the main contributions.
    2. "relevanceScore": Integer between 0 and 100 representing perceived scientific rigor/impact.
    3. "gaps": Array of 2 critical research gaps or limitations not addressed by the abstract.
    4. "keywords": Array of 5 specific terms for semantic search linking (e.g., ["XGBoost", "RA", "Genomics"]).`;

    const msg = await anthropic.messages.create({
      model: "claude-3-opus-20240229", // Using the most powerful model for deep analysis
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }]
    });

    const analysis = JSON.parse(msg.content[0].text.trim());
    res.json(analysis);

  } catch (error) {
    console.error("AI Analysis Error:", error);
    res.status(500).json({ error: "AI Analysis Failed. Check server logs or API key." });
  }
});

// --- SERVER START ---
app.listen(PORT, () => {
  console.log(`✅ Research Server is running on http://localhost:${PORT}`);
  console.log(`   Ensure your React Frontend is running on http://localhost:3000`);
});
