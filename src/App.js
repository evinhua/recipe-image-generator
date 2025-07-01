import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
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

  // Enhanced text processing function for better PDF text extraction
  const processTextContent = async (textContent, page) => {
    try {
      // Get viewport for positioning calculations
      const viewport = page.getViewport({ scale: 1.0 });
      
      // Sort text items by position (top to bottom, left to right)
      const sortedItems = textContent.items.sort((a, b) => {
        const yDiff = Math.abs(a.transform[5] - b.transform[5]);
        if (yDiff < 5) { // Same line (within 5 units)
          return a.transform[4] - b.transform[4]; // Sort by x position
        }
        return b.transform[5] - a.transform[5]; // Sort by y position (top to bottom)
      });
      
      let processedText = '';
      let currentY = null;
      let lineText = '';
      
      for (let i = 0; i < sortedItems.length; i++) {
        const item = sortedItems[i];
        const itemY = Math.round(item.transform[5]);
        
        // Check if we're on a new line
        if (currentY !== null && Math.abs(currentY - itemY) > 5) {
          // Process the completed line
          if (lineText.trim()) {
            processedText += lineText.trim() + '\n';
          }
          lineText = '';
        }
        
        currentY = itemY;
        
        // Add spacing between words if needed
        if (lineText && !lineText.endsWith(' ') && !item.str.startsWith(' ')) {
          lineText += ' ';
        }
        
        lineText += item.str;
      }
      
      // Add the last line
      if (lineText.trim()) {
        processedText += lineText.trim() + '\n';
      }
      
      return processedText;
      
    } catch (error) {
      console.warn('Error in enhanced text processing, falling back to simple extraction:', error);
      // Fallback to simple text extraction
      return textContent.items
        .map(item => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  };

  // Analyze PDF to detect if it's likely a scanned document
  const analyzePDFContent = async (pdf) => {
    try {
      let totalTextItems = 0;
      let totalImages = 0;
      let hasEmbeddedFonts = false;
      
      // Analyze first few pages
      const pagesToAnalyze = Math.min(pdf.numPages, 3);
      
      for (let pageNum = 1; pageNum <= pagesToAnalyze; pageNum++) {
        const page = await pdf.getPage(pageNum);
        
        // Check text content
        const textContent = await page.getTextContent();
        totalTextItems += textContent.items.length;
        
        // Check for embedded fonts (indicates text-based PDF)
        const fonts = await page.getOperatorList();
        if (fonts.fnArray && fonts.fnArray.length > 0) {
          hasEmbeddedFonts = true;
        }
        
        // Check for images
        try {
          const ops = await page.getOperatorList();
          const imageOps = ops.fnArray.filter(fn => 
            fn === pdfjsLib.OPS.paintImageXObject || 
            fn === pdfjsLib.OPS.paintInlineImageXObject
          );
          totalImages += imageOps.length;
        } catch (e) {
          // Ignore errors in image detection
        }
      }
      
      const analysis = {
        totalTextItems,
        totalImages,
        hasEmbeddedFonts,
        likelyScanned: totalTextItems < 10 && totalImages > 0,
        textDensity: totalTextItems / pagesToAnalyze,
        recommendation: ''
      };
      
      if (analysis.likelyScanned) {
        analysis.recommendation = 'This appears to be a scanned PDF. OCR processing is recommended.';
      } else if (analysis.textDensity > 50) {
        analysis.recommendation = 'This appears to be a text-based PDF. Standard extraction should work well.';
      } else {
        analysis.recommendation = 'This PDF has mixed content. Try standard extraction first, then OCR if needed.';
      }
      
      return analysis;
      
    } catch (error) {
      console.warn('PDF analysis failed:', error);
      return {
        totalTextItems: 0,
        totalImages: 0,
        hasEmbeddedFonts: false,
        likelyScanned: false,
        textDensity: 0,
        recommendation: 'Unable to analyze PDF structure.'
      };
    }
  };

  // OCR fallback for scanned PDFs
  const tryOCRExtraction = async (pdf, maxPages = 3) => {
    try {
      setFileStatus('Attempting OCR text extraction from images...');
      let ocrText = '';
      const pagesToProcess = Math.min(pdf.numPages, maxPages);
      
      for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
        setFileStatus(`Running OCR on page ${pageNum} of ${pagesToProcess}...`);
        setProcessingProgress(Math.round((pageNum / pagesToProcess) * 100));
        
        try {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
          
          // Create canvas to render PDF page as image
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          // Render PDF page to canvas
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
          
          // Convert canvas to image data for OCR
          const imageData = canvas.toDataURL('image/png');
          
          // Run OCR on the image
          const { data: { text } } = await Tesseract.recognize(imageData, 'eng', {
            logger: m => {
              if (m.status === 'recognizing text') {
                const progress = Math.round(m.progress * 100);
                setFileStatus(`OCR processing page ${pageNum}: ${progress}%`);
              }
            }
          });
          
          if (text && text.trim().length > 10) {
            ocrText += text + '\n\n';
          }
          
        } catch (pageError) {
          console.warn(`OCR failed for page ${pageNum}:`, pageError);
        }
      }
      
      return ocrText.trim();
      
    } catch (ocrError) {
      console.error('OCR extraction failed:', ocrError);
      return '';
    }
  };

  // Post-process extracted text to improve formatting
  const postProcessExtractedText = (text) => {
    if (!text) return '';
    
    let processed = text;
    
    // Fix common PDF extraction issues
    processed = processed
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Fix broken words (common in PDF extraction)
      .replace(/(\w)-\s+(\w)/g, '$1$2')
      // Fix ingredient lists (common pattern: "• item" or "- item")
      .replace(/([•\-\*])\s*([A-Za-z])/g, '\n$1 $2')
      // Fix numbered lists
      .replace(/(\d+\.)\s*([A-Za-z])/g, '\n$1 $2')
      // Add line breaks before common recipe sections
      .replace(/(Ingredients?|Instructions?|Directions?|Method|Steps?|Preparation):/gi, '\n\n$1:')
      // Fix temperature and measurement formatting
      .replace(/(\d+)\s*°\s*([CF])/g, '$1°$2')
      .replace(/(\d+)\s*(cups?|tbsp|tsp|oz|lbs?|grams?|ml|liters?)/gi, '$1 $2')
      // Remove multiple consecutive newlines
      .replace(/\n{3,}/g, '\n\n')
      // Trim whitespace
      .trim();
    
    // Try to identify and format recipe sections
    const lines = processed.split('\n');
    const formattedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Check if line looks like a section header
      if (line.match(/^(ingredients?|instructions?|directions?|method|steps?|preparation|notes?|tips?):\s*$/i)) {
        formattedLines.push('\n' + line.toUpperCase());
      }
      // Check if line looks like an ingredient (starts with amount or bullet)
      else if (line.match(/^[\d\-•\*]\s*/) || line.match(/^\d+\/\d+/) || line.match(/^\d+\s+(cups?|tbsp|tsp|oz|lbs?)/i)) {
        formattedLines.push('• ' + line.replace(/^[\-•\*]\s*/, ''));
      }
      // Check if line looks like a step (starts with number)
      else if (line.match(/^\d+\.\s*/)) {
        formattedLines.push('\n' + line);
      }
      else {
        formattedLines.push(line);
      }
    }
    
    return formattedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  };
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
  const [ocrEnabled, setOcrEnabled] = useState(true);
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
        // Enhanced PDF processing with better text extraction
        setFileStatus('Initializing PDF processor...');
        console.log('Processing PDF file with enhanced extraction...');
        
        try {
          const arrayBuffer = await file.arrayBuffer();
          
          // Configure PDF.js for better text extraction
          const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
            useSystemFonts: true,
            disableFontFace: false,
            verbosity: 0 // Reduce console noise
          });
          
          const pdf = await loadingTask.promise;
          let fullText = '';
          let extractedPages = 0;
          
          // Analyze PDF content first
          setFileStatus('Analyzing PDF structure...');
          const analysis = await analyzePDFContent(pdf);
          console.log('PDF Analysis:', analysis);
          
          setFileStatus(`${analysis.recommendation} Processing ${pdf.numPages} pages...`);
          
          // Extract text from all pages with enhanced processing
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const progress = Math.round((pageNum / pdf.numPages) * 100);
            setProcessingProgress(progress);
            setFileStatus(`Extracting text from page ${pageNum} of ${pdf.numPages} (${progress}%)...`);
            
            try {
              const page = await pdf.getPage(pageNum);
              const textContent = await page.getTextContent({
                normalizeWhitespace: true,
                disableCombineTextItems: false
              });
              
              // Enhanced text processing with better formatting
              const pageText = await processTextContent(textContent, page);
              
              if (pageText && pageText.trim().length > 0) {
                fullText += pageText + '\n\n';
                extractedPages++;
              }
              
              // Add small delay to prevent browser freezing on large PDFs
              if (pageNum % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
              }
              
            } catch (pageError) {
              console.warn(`Error processing page ${pageNum}:`, pageError);
              setFileStatus(`Warning: Could not process page ${pageNum}, continuing...`);
              // Continue with other pages
            }
          }
          
          // Post-process the extracted text
          const cleanedText = postProcessExtractedText(fullText);
          
          if (cleanedText && cleanedText.trim().length > 10) {
            setRecipe(cleanedText);
            setFileStatus(`✅ Successfully extracted text from ${extractedPages}/${pdf.numPages} pages`);
            console.log(`PDF text extracted successfully from ${extractedPages} pages`);
            
            // Show extraction statistics
            setTimeout(() => {
              setFileStatus(`📊 Extracted ${cleanedText.length} characters from ${extractedPages} pages`);
            }, 2000);
            
          } else {
            // Try OCR as fallback for scanned PDFs (if enabled or if analysis suggests it)
            const shouldTryOCR = ocrEnabled || analysis.likelyScanned;
            
            if (shouldTryOCR) {
              setFileStatus('No text found with standard extraction. Trying OCR...');
              console.log('Attempting OCR fallback for scanned PDF');
              
              const ocrText = await tryOCRExtraction(pdf);
              
              if (ocrText && ocrText.trim().length > 10) {
                const cleanedOcrText = postProcessExtractedText(ocrText);
                setRecipe(cleanedOcrText);
                setFileStatus(`✅ Successfully extracted text using OCR from ${Math.min(pdf.numPages, 3)} pages`);
                console.log('OCR extraction successful');
                
                setTimeout(() => {
                  setFileStatus(`🔍 OCR extracted ${cleanedOcrText.length} characters (first 3 pages only)`);
                }, 2000);
                
              } else {
                setError('OCR extraction failed to find readable text.\n\nTry these alternatives:\n• Ensure the PDF has clear, readable text\n• Use a higher quality scan if this is a scanned document\n• Copy and paste text directly from a PDF viewer\n• Convert the PDF to a Word document (.docx)');
                setFileStatus('');
              }
            } else {
              const errorMsg = extractedPages === 0 
                ? 'No readable text found in the PDF. This appears to be a scanned document or contains only images.'
                : 'Very little text was extracted. The PDF might have formatting issues or contain mostly images.';
              
              setError(`${errorMsg}\n\nSuggestions:\n• Enable OCR processing for scanned PDFs\n• Copy and paste text directly from a PDF viewer\n• Convert the PDF to a Word document (.docx)\n• Save the content as a plain text file (.txt)`);
              setFileStatus('');
            }
          }
        } catch (pdfError) {
          console.error('PDF parsing error:', pdfError);
          
          // Enhanced error handling with specific solutions
          let errorMessage = 'Failed to process PDF file. ';
          
          if (pdfError.message.includes('Invalid PDF structure')) {
            errorMessage += 'The PDF file appears to be corrupted or has an invalid structure.';
          } else if (pdfError.message.includes('worker') || pdfError.message.includes('fetch')) {
            errorMessage += 'PDF processing service is temporarily unavailable.';
          } else if (pdfError.message.includes('password') || pdfError.name === 'PasswordException') {
            errorMessage += 'This PDF is password protected and cannot be processed.';
          } else if (pdfError.message.includes('XRef')) {
            errorMessage += 'The PDF has structural issues that prevent text extraction.';
          } else {
            errorMessage += 'An unexpected error occurred during PDF processing.';
          }
          
          errorMessage += '\n\nRecommended solutions:\n';
          errorMessage += '• Try opening the PDF in a different viewer and copy-paste the text\n';
          errorMessage += '• Convert the PDF to Word format (.docx) using online tools\n';
          errorMessage += '• Use PDF repair tools if the file appears corrupted\n';
          errorMessage += '• For scanned PDFs, use OCR software to extract text';
          
          setError(errorMessage);
          setFileStatus('');
        }
          
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
              <p>⚠️ PDF files (.pdf) - Enhanced support with OCR*</p>
              <div className="ocr-toggle">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={ocrEnabled}
                    onChange={(e) => setOcrEnabled(e.target.checked)}
                  />
                  <span className="toggle-text">
                    Enable OCR for scanned PDFs (slower but more accurate)
                  </span>
                </label>
              </div>
              <p className="pdf-note">
                *PDF support includes text extraction and OCR for scanned documents. OCR processes first 3 pages only.
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
