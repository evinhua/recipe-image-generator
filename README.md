# Recipe to Image Generator

A beautiful React application that transforms recipes into stunning dish visualizations using AI. Upload or paste your recipe, generate an image prompt using NVIDIA's AI models, and create beautiful food images using OpenAI's DALL-E.

## Features

- 🍽️ **Recipe Input**: Upload PDF, .docx, or .txt files, or paste text directly
- 📄 **Enhanced PDF Support**: 
  - Smart text extraction with positioning awareness
  - OCR support for scanned PDFs using Tesseract.js
  - Automatic PDF analysis and processing recommendations
  - Intelligent fallback between text extraction and OCR
- 🤖 **AI-Powered Prompts**: Generate detailed image prompts using NVIDIA's language models
- 🎯 **Simple Prompts**: Generate basic prompts without API calls
- 🎨 **Image Generation**: Create beautiful dish images using OpenAI's DALL-E
- 📱 **Responsive Design**: Works perfectly on desktop and mobile devices
- ✨ **Smooth Animations**: Beautiful transitions and loading states
- 🔧 **Proxy Server**: Handles CORS issues and API calls securely
- 📊 **Advanced Processing**: Real-time progress tracking and intelligent error handling

## Setup Instructions

### 1. Install Dependencies

```bash
cd recipe-image-generator
npm install
```

### 2. Configure API Keys

Edit the `.env` file in the root directory and add your API keys:

```env
REACT_APP_NVIDIA_API_KEY=your_nvidia_api_key_here
REACT_APP_OPENAI_API_KEY=your_openai_api_key_here
```

#### Getting API Keys:

**NVIDIA API Key:**
1. Visit [NVIDIA API Catalog](https://integrate.api.nvidia.com)
2. Sign up or log in
3. Generate an API key
4. Copy the key to your `.env` file

**OpenAI API Key:**
1. Visit [OpenAI API](https://platform.openai.com/api-keys)
2. Sign up or log in
3. Create a new API key
4. Copy the key to your `.env` file

### 3. Start the Application

You have three options:

**Option 1: Run both server and client together (Recommended)**
```bash
npm run dev
```

**Option 2: Run separately**
```bash
# Terminal 1 - Start the proxy server
npm run server

# Terminal 2 - Start the React app
npm start
```

**Option 3: Use simple prompts only (no server needed)**
```bash
npm start
# Then use the "Simple Prompt" button instead of "Show (AI)"
```

The application will open at [http://localhost:3000](http://localhost:3000)
The proxy server runs at [http://localhost:3001](http://localhost:3001)

## How to Use

1. **Upload Recipe**: Click the "Upload Recipe" button to upload a PDF (.pdf), Word document (.docx), or text file (.txt), or paste your recipe directly into the text box
2. **Select Model**: Choose an NVIDIA AI model from the dropdown (default is recommended)
3. **Generate Prompt**: 
   - Click "Show (AI)" to generate an AI-powered image description prompt
   - Or click "Simple Prompt" for a basic prompt without API calls
4. **Edit Prompt**: You can manually edit the generated prompt if needed
5. **Generate Image**: Click "Generate" to create a beautiful image of your dish

## Troubleshooting

### Common Issues:

1. **"Proxy server is not running"**: Make sure to start the server with `npm run server` or `npm run dev`
2. **API Key Errors**: Make sure your API keys are correctly set in the `.env` file
3. **PDF Issues**: 
   - **Worker Error**: If you see "Failed to fetch dynamically imported module", restart the application
   - **No text extracted**: The PDF might be image-based (scanned) or password protected
   - **Processing fails**: Try converting the PDF to .docx or copy-paste the text directly
   - **Large PDFs**: May take longer to process - watch the progress bar
4. **File Upload Issues**: 
   - **Best compatibility**: Word documents (.docx)
   - **Fastest processing**: Text files (.txt) or direct paste
   - **Limited support**: PDF files (depends on PDF type)
5. **CORS Errors**: The proxy server should handle CORS issues. If you still get errors, try restarting both server and client

### Error Messages:

- "Error generating prompt": Check your NVIDIA API key and internet connection
- "Error generating image": Check your OpenAI API key and ensure you have sufficient credits
- "No text found in PDF": The PDF might contain only images, be password protected, or be a scanned document
- "PDF processing unavailable": Technical issue with PDF.js worker - try alternative file formats
- "Error reading file": Try a different file format or paste the text directly

### PDF Troubleshooting Specifically:

If PDF upload isn't working:
1. **Check the browser console** for detailed error messages
2. **Try a text-based PDF** (not scanned images)
3. **Use online PDF-to-Word converters** as an alternative
4. **Copy and paste** the text directly from the PDF viewer
5. **Save as .txt file** from your PDF reader

## Supported File Formats

- **Word documents (.docx)** ✅ - Best compatibility and reliability
- **Text files (.txt)** ✅ - Fastest processing, always works
- **PDF files (.pdf)** ✅ - **Enhanced support with multiple processing methods:**
  - ✅ **Text-based PDFs**: Fast, accurate extraction with formatting preservation
  - ✅ **Scanned PDFs**: OCR processing using Tesseract.js (first 3 pages)
  - ✅ **Mixed content PDFs**: Intelligent processing with automatic method selection
  - ✅ **Smart analysis**: Automatic detection of PDF type and processing recommendations
  - ⚠️ **Performance note**: OCR processing is slower but more comprehensive
- **Plain text** ✅ - Paste directly into the text area

**Recommendation**: All formats now have robust support. PDF processing includes both fast text extraction and OCR fallback for maximum compatibility.

## Technologies Used

- **React** - Frontend framework
- **Express.js** - Proxy server to handle API calls
- **NVIDIA API** - AI language models for prompt generation
- **OpenAI DALL-E** - Image generation
- **PDF.js** - PDF text extraction and parsing
- **Tesseract.js** - OCR engine for scanned document processing
- **Mammoth.js** - Word document parsing
- **Axios** - HTTP client for API calls

## Architecture

The application uses a proxy server architecture to avoid CORS issues:

```
React App (localhost:3000) → Express Proxy (localhost:3001) → External APIs
```

This ensures secure API key handling and resolves browser CORS restrictions.

## Development

To contribute to this project:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with both server and client
5. Submit a pull request

## License

This project is open source and available under the MIT License.
