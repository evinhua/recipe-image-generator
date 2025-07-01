import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import './App.css';

const NVIDIA_MODELS = [
  'meta/llama-3.1-405b-instruct',
  'meta/llama-3.1-70b-instruct',
  'meta/llama-3.1-8b-instruct',
  'microsoft/phi-3-medium-128k-instruct',
  'mistralai/mixtral-8x7b-instruct-v0.1',
  'google/gemma-2-9b-it',
  'nvidia/nemotron-4-340b-instruct'
];

function App() {
  // Configure PDF.js worker on component mount
  useEffect(() => {
    // Use local worker file served from public directory
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
    console.log('PDF.js worker configured:', pdfjsLib.GlobalWorkerOptions.workerSrc);
  }, []);
  const [recipe, setRecipe] = useState('');
  const [selectedModel, setSelectedModel] = useState(NVIDIA_MODELS[0]);
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState('');
  const [loading, setLoading] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileStatus, setFileStatus] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const fileInputRef = useRef(null);

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      // Create a fake event object to reuse handleFileUpload
      const fakeEvent = {
        target: {
          files: [file]
        }
      };
      handleFileUpload(fakeEvent);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setFileLoading(true);
      setError('');
      setFileStatus('');
      setProcessingProgress(0);

      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        // Handle PDF files with improved error handling
        setFileStatus('Processing PDF file...');
        console.log('Processing PDF file...');
        
        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let fullText = '';
          
          setFileStatus(`Extracting text from ${pdf.numPages} page(s)...`);
          
          // Extract text from all pages
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const progress = Math.round((pageNum / pdf.numPages) * 100);
            setProcessingProgress(progress);
            setFileStatus(`Processing page ${pageNum} of ${pdf.numPages} (${progress}%)...`);
            
            try {
              const page = await pdf.getPage(pageNum);
              const textContent = await page.getTextContent();
              const pageText = textContent.items
                .map(item => item.str)
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
              
              if (pageText) {
                fullText += pageText + '\n';
              }
            } catch (pageError) {
              console.warn(`Error processing page ${pageNum}:`, pageError);
              // Continue with other pages
            }
          }
          
          if (fullText.trim()) {
            setRecipe(fullText.trim());
            setFileStatus(`✅ Successfully extracted text from PDF (${pdf.numPages} pages)`);
            console.log('PDF text extracted successfully');
          } else {
            setError('No text found in the PDF. This might be a scanned document or contain only images. Try using OCR software to convert it to text first, or copy-paste the text manually.');
            setFileStatus('');
          }
        } catch (pdfError) {
          console.error('PDF parsing error:', pdfError);
          
          // Provide helpful error messages and alternatives
          let errorMessage = 'Unable to process this PDF file. ';
          
          if (pdfError.message.includes('worker') || pdfError.message.includes('fetch')) {
            errorMessage += 'PDF processing is temporarily unavailable. ';
          } else if (pdfError.message.includes('Invalid PDF')) {
            errorMessage += 'The PDF file appears to be corrupted. ';
          } else if (pdfError.message.includes('password')) {
            errorMessage += 'This PDF is password protected. ';
          }
          
          errorMessage += 'Please try one of these alternatives:\n\n';
          errorMessage += '• Convert the PDF to a Word document (.docx) using online tools\n';
          errorMessage += '• Copy and paste the text directly from the PDF\n';
          errorMessage += '• Save the PDF content as a text file (.txt)\n';
          errorMessage += '• Use a PDF-to-text converter tool';
          
          setError(errorMessage);
          setFileStatus('');
        }
        
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
          file.name.toLowerCase().endsWith('.docx')) {
        // Handle .docx files
        setFileStatus('Processing Word document...');
        console.log('Processing DOCX file...');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        
        if (result.value.trim()) {
          setRecipe(result.value);
          setFileStatus('✅ Successfully extracted text from Word document');
          console.log('DOCX text extracted successfully');
        } else {
          setError('No text found in the Word document.');
          setFileStatus('');
        }
        
      } else if (file.type === 'application/msword' || file.name.toLowerCase().endsWith('.doc')) {
        // Handle .doc files (limited support)
        setError('Legacy .doc files have limited support. Please save as .docx or .pdf, or copy and paste the text directly.');
        setFileStatus('');
        
      } else if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
        // Handle text files
        setFileStatus('Processing text file...');
        console.log('Processing text file...');
        const text = await file.text();
        
        if (text.trim()) {
          setRecipe(text);
          setFileStatus('✅ Successfully loaded text file');
          console.log('Text file loaded successfully');
        } else {
          setError('The text file appears to be empty.');
          setFileStatus('');
        }
        
      } else {
        setError('Unsupported file format. Please upload a PDF (.pdf), Word document (.docx), or text file (.txt), or copy and paste the text directly.');
        setFileStatus('');
      }
    } catch (error) {
      console.error('Error reading file:', error);
      setError('Error reading file. Please try again or paste the text directly.');
      setFileStatus('');
    } finally {
      setFileLoading(false);
      setProcessingProgress(0);
      // Clear status message after 3 seconds if successful
      if (!error) {
        setTimeout(() => setFileStatus(''), 3000);
      }
    }
  };

  const generatePrompt = async () => {
    if (!recipe.trim()) {
      setError('Please enter or upload a recipe first.');
      return;
    }

    try {
      setPromptLoading(true);
      setError('');
      
      console.log('Making request to proxy server...');
      console.log('Selected model:', selectedModel);
      
      const response = await axios.post(
        'http://localhost:3001/api/nvidia/chat',
        {
          model: selectedModel,
          messages: [
            {
              role: 'system',
              content: 'You are an expert food photographer and image generation prompt creator. Create detailed, vivid image generation prompts that will produce beautiful, appetizing photos of dishes.'
            },
            {
              role: 'user',
              content: `Based on this recipe, create a detailed image generation prompt that describes how the finished dish should look. Focus on visual details like colors, textures, plating, lighting, and presentation. Make it appetizing and professional looking.

Recipe:
${recipe}

Please provide only the image generation prompt, nothing else.`
            }
          ],
          max_tokens: 500,
          temperature: 0.7
        },
        {
          timeout: 30000 // 30 second timeout
        }
      );

      console.log('Proxy server response:', response.data);
      setPrompt(response.data.choices[0].message.content);
      
    } catch (error) {
      console.error('Error generating prompt:', error);
      
      if (error.response) {
        // Server responded with error status
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        
        if (error.response.status === 401) {
          setError('Invalid NVIDIA API key. Please check your API key in the .env file.');
        } else if (error.response.status === 429) {
          setError('Rate limit exceeded. Please wait a moment and try again.');
        } else if (error.response.status === 403) {
          setError('Access forbidden. Please check your NVIDIA API key permissions.');
        } else {
          setError(`NVIDIA API error (${error.response.status}): ${error.response.data?.error || 'Unknown error'}`);
        }
      } else if (error.code === 'ECONNREFUSED') {
        setError('Proxy server is not running. Please start the server with "npm run server" in a separate terminal.');
      } else if (error.request) {
        setError('Network error. Please check your internet connection and ensure the proxy server is running.');
      } else {
        setError('Error generating prompt. Please try again.');
      }
    } finally {
      setPromptLoading(false);
    }
  };

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError('Please generate a prompt first.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      console.log('Making request to proxy server for image generation...');
      
      const response = await axios.post(
        'http://localhost:3001/api/openai/images',
        {
          model: 'dall-e-3',
          prompt: prompt,
          n: 1,
          size: '1024x1024',
          quality: 'standard'
        },
        {
          timeout: 60000 // 60 second timeout for image generation
        }
      );

      console.log('Proxy server response:', response.data);
      setGeneratedImage(response.data.data[0].url);
      
    } catch (error) {
      console.error('Error generating image:', error);
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        
        if (error.response.status === 401) {
          setError('Invalid OpenAI API key. Please check your API key in the .env file.');
        } else if (error.response.status === 429) {
          setError('Rate limit exceeded or insufficient credits. Please check your OpenAI account.');
        } else {
          setError(`OpenAI API error (${error.response.status}): ${error.response.data?.error || 'Unknown error'}`);
        }
      } else if (error.code === 'ECONNREFUSED') {
        setError('Proxy server is not running. Please start the server with "npm run server" in a separate terminal.');
      } else if (error.request) {
        setError('Network error. Please check your internet connection and ensure the proxy server is running.');
      } else {
        setError('Error generating image. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Simple prompt generation fallback (doesn't require API)
  const generateSimplePrompt = () => {
    if (!recipe.trim()) {
      setError('Please enter or upload a recipe first.');
      return;
    }

    // Extract key ingredients and cooking method for a basic prompt
    const lines = recipe.toLowerCase().split('\n');
    const ingredients = [];
    const cookingMethods = [];
    
    // Look for common ingredients
    const commonIngredients = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'pasta', 'rice', 'bread', 'cheese', 'tomato', 'onion', 'garlic', 'herbs', 'spices', 'chocolate', 'vanilla', 'flour', 'butter', 'oil'];
    const commonMethods = ['baked', 'grilled', 'fried', 'roasted', 'steamed', 'sautéed', 'boiled', 'braised'];
    
    lines.forEach(line => {
      commonIngredients.forEach(ingredient => {
        if (line.includes(ingredient) && !ingredients.includes(ingredient)) {
          ingredients.push(ingredient);
        }
      });
      
      commonMethods.forEach(method => {
        if (line.includes(method) && !cookingMethods.includes(method)) {
          cookingMethods.push(method);
        }
      });
    });

    const dishName = recipe.split('\n')[0] || 'delicious dish';
    const ingredientText = ingredients.length > 0 ? ` featuring ${ingredients.slice(0, 3).join(', ')}` : '';
    const methodText = cookingMethods.length > 0 ? `, ${cookingMethods[0]}` : '';
    
    const simplePrompt = `A beautifully plated ${dishName}${ingredientText}${methodText}, photographed from above on a white ceramic plate, professional food photography, natural lighting, appetizing presentation, high resolution, detailed textures, vibrant colors, restaurant quality plating`;
    
    setPrompt(simplePrompt);
    setError('');
  };

  return (
    <div className="App">
      <div className="container">
        <header className="header">
          <h1>🍽️ Recipe to Image Generator</h1>
          <p>Transform your recipes into beautiful dish visualizations</p>
        </header>

        {error && (
          <div className="error-message">
            <div className="error-content">
              {error.split('\n').map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
          </div>
        )}

        <div 
          className={`upload-section ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="upload-area">
            <button 
              className="upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={fileLoading}
            >
              {fileLoading ? '⏳ Processing...' : '📁 Upload Recipe (PDF/DOCX/TXT)'}
            </button>
            <p className="upload-hint">
              or drag and drop your file here
            </p>
            <div className="upload-info">
              <p><strong>Supported formats:</strong></p>
              <p>✅ Word documents (.docx) - Best compatibility</p>
              <p>✅ Text files (.txt) - Fastest processing</p>
              <p>⚠️ PDF files (.pdf) - Limited support*</p>
              <p className="pdf-note">
                *PDF support depends on the file type. If PDF doesn't work, try converting to .docx or copy-paste the text directly.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </div>
          {fileStatus && (
            <div className="file-status">
              <p>{fileStatus}</p>
              {processingProgress > 0 && processingProgress < 100 && (
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${processingProgress}%` }}
                  ></div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="input-section">
          <label htmlFor="recipe-input">Recipe Text:</label>
          <textarea
            id="recipe-input"
            className="recipe-input"
            value={recipe}
            onChange={(e) => setRecipe(e.target.value)}
            placeholder="Enter your recipe here or upload a document above..."
            rows={8}
          />
        </div>

        <div className="model-section">
          <label htmlFor="model-select">Select NVIDIA Model:</label>
          <select
            id="model-select"
            className="model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            {NVIDIA_MODELS.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>

        <div className="button-section">
          <button 
            className="show-btn"
            onClick={generatePrompt}
            disabled={promptLoading || !recipe.trim()}
          >
            {promptLoading ? '⏳ Generating...' : '✨ Show (AI)'}
          </button>
          <button 
            className="simple-btn"
            onClick={generateSimplePrompt}
            disabled={!recipe.trim()}
          >
            🎯 Simple Prompt
          </button>
        </div>

        <div className="output-section">
          <label htmlFor="prompt-output">Generated Image Prompt:</label>
          <textarea
            id="prompt-output"
            className="prompt-output"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Generated prompt will appear here... (You can also edit it manually)"
            rows={6}
          />
        </div>

        <div className="button-section">
          <button 
            className="generate-btn"
            onClick={generateImage}
            disabled={loading || !prompt.trim()}
          >
            {loading ? '🎨 Generating Image...' : '🎨 Generate'}
          </button>
        </div>

        {generatedImage && (
          <div className="image-section">
            <h3>Generated Dish Image:</h3>
            <div className="image-container">
              <img 
                src={generatedImage} 
                alt="Generated dish" 
                className="generated-image"
              />
            </div>
          </div>
        )}

        <div className="api-status">
          <p>
            NVIDIA API: {process.env.REACT_APP_NVIDIA_API_KEY ? '✅ Configured' : '❌ Not configured'}
          </p>
          <p>
            OpenAI API: {process.env.REACT_APP_OPENAI_API_KEY ? '✅ Configured' : '❌ Not configured'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
