#!/bin/bash

# Recipe Image Generator Setup Script
echo "🍽️ Setting up Recipe Image Generator..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "🔑 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created"
    echo "⚠️  Please edit .env file and add your API keys:"
    echo "   - NVIDIA API key from: https://integrate.api.nvidia.com"
    echo "   - OpenAI API key from: https://platform.openai.com/api-keys"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file and add your API keys"
echo "2. Run 'npm run dev' to start both server and client"
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "Alternative commands:"
echo "- 'npm start' - Start React app only"
echo "- 'npm run server' - Start proxy server only"
echo "- 'npm run dev' - Start both (recommended)"
echo ""
echo "Happy cooking! 👨‍🍳"
