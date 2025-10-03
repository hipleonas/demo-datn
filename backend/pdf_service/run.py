"""
FastAPI server for PDF processing and image extraction
"""

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import tempfile
import os
import logging
from typing import Optional
import uvicorn

from pdf_processor import PDFProcessor

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="PDF Extractor Service",
    description="Service for extracting PDF pages as images",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize PDF processor
pdf_processor = PDFProcessor()

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "PDF Extractor Service is running", "status": "healthy"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "PDF Extractor Service"}

@app.post("/pdf-info")
async def get_pdf_info(file: UploadFile = File(...)):
    """
    Extract basic PDF information without processing pages
    """
    try:
        logger.info(f"Getting PDF info for: {file.filename}")
        
        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="File must be a PDF")
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            # Extract PDF info
            pdf_info = pdf_processor.extract_pdf_info(temp_file_path)
            
            return JSONResponse(content={
                "success": True,
                "pdf_info": pdf_info,
                "message": "PDF info extracted successfully"
            })
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                
    except Exception as e:
        logger.error(f"Error getting PDF info: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get PDF info: {str(e)}")

@app.post("/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    scale: float = Form(2.0),
    image_format: str = Form("PNG")
):
    """
    Upload PDF and extract all pages as images
    """
    try:
        logger.info(f"Processing PDF: {file.filename}")
        
        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="File must be a PDF")
        
        # Validate parameters
        if scale <= 0 or scale > 10:
            raise HTTPException(status_code=400, detail="Scale must be between 0 and 10")
        
        if image_format.upper() not in ['PNG', 'JPEG', 'JPG']:
            raise HTTPException(status_code=400, detail="Image format must be PNG or JPEG")
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            # Extract PDF info first
            pdf_info = pdf_processor.extract_pdf_info(temp_file_path)
            
            # Extract pages as images
            pages = pdf_processor.extract_pages_as_images(
                pdf_path=temp_file_path,
                scale=scale,
                image_format=image_format.upper()
            )
            
            # Prepare response
            response_data = {
                "success": True,
                "message": f"Successfully processed {len(pages)} pages",
                "pdf_info": pdf_info,
                "pages": pages,
                "processing_params": {
                    "original_filename": file.filename,
                    "scale": scale,
                    "image_format": image_format.upper(),
                    "total_pages": len(pages)
                }
            }
            
            logger.info(f"Successfully processed {len(pages)} pages from {file.filename}")
            return JSONResponse(content=response_data)
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")

@app.post("/extract-page")
async def extract_single_page(
    file: UploadFile = File(...),
    page_number: int = Form(...),
    scale: float = Form(2.0),
    image_format: str = Form("PNG")
):
    """
    Extract a single page from PDF as image
    """
    try:
        logger.info(f"Extracting page {page_number} from: {file.filename}")
        
        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="File must be a PDF")
        
        # Validate parameters
        if page_number < 1:
            raise HTTPException(status_code=400, detail="Page number must be >= 1")
        
        if scale <= 0 or scale > 10:
            raise HTTPException(status_code=400, detail="Scale must be between 0 and 10")
        
        if image_format.upper() not in ['PNG', 'JPEG', 'JPG']:
            raise HTTPException(status_code=400, detail="Image format must be PNG or JPEG")
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            # Get PDF info to validate page number
            pdf_info = pdf_processor.extract_pdf_info(temp_file_path)
            
            if page_number > pdf_info['total_pages']:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Page {page_number} not found. PDF has {pdf_info['total_pages']} pages"
                )
            
            # Extract all pages and get the requested one
            pages = pdf_processor.extract_pages_as_images(
                pdf_path=temp_file_path,
                scale=scale,
                image_format=image_format.upper()
            )
            
            # Find the requested page
            requested_page = None
            for page in pages:
                if page['page_number'] == page_number:
                    requested_page = page
                    break
            
            if not requested_page:
                raise HTTPException(status_code=500, detail="Failed to extract requested page")
            
            response_data = {
                "success": True,
                "message": f"Successfully extracted page {page_number}",
                "page": requested_page,
                "pdf_info": pdf_info
            }
            
            logger.info(f"Successfully extracted page {page_number} from {file.filename}")
            return JSONResponse(content=response_data)
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting page: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to extract page: {str(e)}")

@app.get("/extracted-images")
async def list_extracted_images():
    """
    List all extracted images in the output directory
    """
    try:
        output_dir = pdf_processor.output_dir
        if not os.path.exists(output_dir):
            return JSONResponse(content={
                "success": True,
                "images": [],
                "message": "No extracted images found"
            })
        
        images = []
        for filename in os.listdir(output_dir):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                file_path = os.path.join(output_dir, filename)
                file_size = os.path.getsize(file_path)
                images.append({
                    "filename": filename,
                    "file_path": file_path,
                    "file_size_bytes": file_size,
                    "file_size_kb": round(file_size / 1024, 2)
                })
        
        return JSONResponse(content={
            "success": True,
            "images": images,
            "total_count": len(images)
        })
        
    except Exception as e:
        logger.error(f"Error listing images: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list images: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(
        "run:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
