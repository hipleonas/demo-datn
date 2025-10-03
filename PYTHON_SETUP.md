# Python Backend Setup for PDF Processing

This guide will help you set up the Python backend for reliable PDF processing using PyMuPDF (fitz).

## 🎯 Why Python Backend?

The Python solution is **much more reliable** than browser-based PDF.js because:
- ✅ No worker loading issues
- ✅ Better PDF compatibility  
- ✅ Higher quality image extraction
- ✅ More stable processing
- ✅ Server-side processing (no browser limitations)

## 🚀 Quick Start

### Step 1: Install Python Backend

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install Python 3.8+ (if not installed):**
   - Windows: Download from [python.org](https://www.python.org/downloads/)
   - macOS: `brew install python3`
   - Ubuntu/Debian: `sudo apt install python3 python3-pip`

3. **Create virtual environment:**
   ```bash
   python -m venv venv
   
   # Activate it:
   # Windows:
   venv\Scripts\activate
   
   # macOS/Linux:
   source venv/bin/activate
   ```

4. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

### Step 2: Start the Backend Server

```bash
python main.py
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
```

### Step 3: Test the Backend

Open your browser and go to: `http://localhost:8000`

You should see:
```json
{
  "message": "PDF Processing Service is running",
  "version": "1.0.0",
  "status": "healthy"
}
```

### Step 4: Use Your Frontend

Now your React frontend will automatically use the Python backend for PDF processing!

## 🔧 Alternative Installation Methods

### Method 1: Using Docker (Easiest)

1. **Build Docker image:**
   ```bash
   cd backend
   docker build -t pdf-processor .
   ```

2. **Run container:**
   ```bash
   docker run -p 8000:8000 pdf-processor
   ```

### Method 2: Using pip directly (if you have Python)

```bash
cd backend
pip install fastapi uvicorn PyMuPDF Pillow python-multipart
python main.py
```

## 🧪 Testing the Setup

### Test 1: Backend Health Check
```bash
curl http://localhost:8000/health
```

### Test 2: Upload a PDF (using curl)
```bash
curl -X POST "http://localhost:8000/upload-pdf" \
     -F "file=@your-pdf-file.pdf" \
     -F "scale=2.0" \
     -F "image_format=PNG"
```

### Test 3: Frontend Integration

1. Start your React frontend: `npm run dev`
2. Upload a PDF file through your UI
3. Check browser console - you should see: `🐍 Trying Python backend...` followed by `🎉 Python backend succeeded`

## 📁 File Structure After Setup

```
your-project/
├── backend/                 # Python backend
│   ├── main.py             # FastAPI server
│   ├── pdf_processor.py    # PDF processing logic
│   ├── requirements.txt    # Python dependencies
│   ├── Dockerfile          # Docker config
│   └── extracted_images/   # Output directory (created automatically)
├── src/                    # Your React frontend
│   └── features/gen-video/
│       └── domain/service/
│           └── PythonPDFService.ts  # New service for Python backend
└── package.json            # Frontend dependencies
```

## ⚙️ Configuration

### Backend Configuration

The backend runs on `http://localhost:8000` by default. To change:

```python
# In backend/main.py, change the uvicorn.run call:
uvicorn.run(
    "main:app",
    host="0.0.0.0",
    port=8080,  # Change port here
    reload=True
)
```

### Frontend Configuration

If you change the backend URL, update the frontend:

```typescript
// In your component or service initialization:
const mainController = new MainController();
mainController.setPythonBackendUrl('http://localhost:8080');
```

## 🔍 How It Works

1. **Frontend uploads PDF** → `PythonPDFService.processPDF()`
2. **Python backend receives file** → `POST /upload-pdf`
3. **PyMuPDF extracts pages** → High-quality images
4. **Images converted to base64** → Sent back to frontend
5. **Frontend creates SlideEntity objects** → Ready for your app!

## 📊 Processing Options

### Quality Settings

```typescript
// High quality (larger files)
await pythonPDFService.processHighQuality(file);

// Web optimized (smaller files)  
await pythonPDFService.processWebOptimized(file);

// Custom settings
await pythonPDFService.processPDF(file, {
    scale: 2.5,           // Image resolution multiplier
    imageFormat: 'PNG'    // PNG or JPEG
});
```

### Scale Factor Guide

- **1.0** = Original PDF size
- **1.5** = Good for web display
- **2.0** = Recommended for presentations
- **3.0** = High quality for printing

## 🛠️ Troubleshooting

### Common Issues

1. **"Python backend is not available"**
   - Make sure backend is running: `python main.py`
   - Check URL: `http://localhost:8000/health`

2. **"ModuleNotFoundError: No module named 'fitz'"**
   ```bash
   pip install PyMuPDF
   ```

3. **CORS errors in browser**
   - Backend already configured for CORS
   - Check if backend is running on correct port

4. **Permission errors on Windows**
   - Run command prompt as administrator
   - Or use virtual environment

5. **Memory issues with large PDFs**
   - Reduce scale factor to 1.5 or 1.0
   - Process fewer pages

### Debug Steps

1. **Check backend logs:**
   ```bash
   python main.py
   # Watch for error messages
   ```

2. **Test backend directly:**
   ```bash
   curl http://localhost:8000/health
   ```

3. **Check frontend console:**
   - Should see: "🐍 Trying Python backend..."
   - If not, check `PythonPDFService` configuration

## 🎉 Success!

Once setup is complete, your PDF processing will be:
- ✅ Much more reliable
- ✅ Higher quality images
- ✅ No more worker loading issues
- ✅ Faster processing
- ✅ Better error handling

The system automatically falls back to the old PDF.js method if the Python backend is unavailable, so your app is always working!

## 📞 Support

If you encounter issues:
1. Check the backend logs for error messages
2. Verify all dependencies are installed
3. Test the backend health endpoint
4. Check the browser console for frontend errors

The Python backend is much more reliable than the browser-based solution and should resolve all the PDF processing issues you were experiencing! 🚀

