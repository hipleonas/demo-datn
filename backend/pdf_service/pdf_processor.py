"""
PDF Processing Service using PyMuPDF (fitz)

This service extracts PDF pages as images using Python backend,
which is more reliable than browser-based PDF.js processing.
"""

import fitz  # PyMuPDF
import io
import base64
import json
import os
from PIL import Image
from typing import List, Dict, Optional
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PDFProcessor:
    def __init__(self, output_dir: str = "extracted_images"):
        """
        Initialize PDF processor
        
        Args:
            output_dir: Directory to save extracted images
        """
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def extract_pages_as_images(self, pdf_path: str, 
                               scale: float = 2.0, 
                               image_format: str = "PNG") -> List[Dict]:
        """
        Extract PDF pages as images
        
        Args:
            pdf_path: Path to PDF file
            scale: Scale factor for image quality (higher = better quality)
            image_format: Output image format (PNG, JPEG)
            
        Returns:
            List of dictionaries containing page info and image data
        """
        try:
            logger.info(f"Processing PDF: {pdf_path}")
            
            # Open PDF file
            pdf_document = fitz.open(pdf_path)
            total_pages = len(pdf_document)
            logger.info(f"PDF has {total_pages} pages")
            
            extracted_pages = []
            
            # Process each page
            for page_index in range(total_pages):
                try:
                    logger.info(f"Processing page {page_index + 1}/{total_pages}")
                    
                    # Load the page
                    page = pdf_document.load_page(page_index)
                    
                    # Get page dimensions
                    page_rect = page.rect
                    page_width = int(page_rect.width)
                    page_height = int(page_rect.height)
                    
                    # Create transformation matrix for scaling
                    matrix = fitz.Matrix(scale, scale)
                    
                    # Render page to pixmap (image)
                    pixmap = page.get_pixmap(matrix=matrix, alpha=False)
                    
                    # Convert to PIL Image
                    img_data = pixmap.tobytes("png")
                    img = Image.open(io.BytesIO(img_data))
                    
                    # Convert to desired format if needed
                    if image_format.upper() == "JPEG":
                        # Convert RGBA to RGB for JPEG
                        if img.mode == 'RGBA':
                            img = img.convert('RGB')
                    
                    # Save image to memory buffer
                    img_buffer = io.BytesIO()
                    img.save(img_buffer, format=image_format.upper())
                    img_buffer.seek(0)
                    
                    # Convert to base64 for web transmission
                    img_base64 = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
                    
                    # Create data URL
                    mime_type = f"image/{image_format.lower()}"
                    data_url = f"data:{mime_type};base64,{img_base64}"
                    
                    # Save to file (optional)
                    filename = f"page_{page_index + 1}.{image_format.lower()}"
                    filepath = os.path.join(self.output_dir, filename)
                    img.save(filepath, format=image_format.upper())
                    
                    # Create page info
                    page_info = {
                        "page_number": page_index + 1,
                        "width": img.width,
                        "height": img.height,
                        "original_width": page_width,
                        "original_height": page_height,
                        "scale": scale,
                        "format": image_format.upper(),
                        "file_size_kb": len(img_base64) * 0.75 / 1024,  # Approximate KB
                        "data_url": data_url,
                        "file_path": filepath,
                        "filename": filename
                    }
                    
                    extracted_pages.append(page_info)
                    logger.info(f"✅ Page {page_index + 1} extracted successfully")
                    
                except Exception as page_error:
                    logger.error(f"❌ Error processing page {page_index + 1}: {page_error}")
                    # Create error placeholder
                    error_page = self._create_error_page(page_index + 1, str(page_error))
                    extracted_pages.append(error_page)
            
            # Close PDF document
            pdf_document.close()
            
            logger.info(f"✅ Successfully extracted {len(extracted_pages)} pages")
            return extracted_pages
            
        except Exception as e:
            logger.error(f"❌ PDF processing failed: {e}")
            raise Exception(f"Failed to process PDF: {str(e)}")
    
    def extract_pdf_info(self, pdf_path: str) -> Dict:
        """
        Extract basic PDF information
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            Dictionary with PDF metadata
        """
        try:
            pdf_document = fitz.open(pdf_path)
            metadata = pdf_document.metadata
            
            info = {
                "total_pages": len(pdf_document),
                "title": metadata.get('title', ''),
                "author": metadata.get('author', ''),
                "subject": metadata.get('subject', ''),
                "creator": metadata.get('creator', ''),
                "producer": metadata.get('producer', ''),
                "creation_date": metadata.get('creationDate', ''),
                "modification_date": metadata.get('modDate', ''),
                "file_size": os.path.getsize(pdf_path) if os.path.exists(pdf_path) else 0
            }
            
            pdf_document.close()
            return info
            
        except Exception as e:
            logger.error(f"❌ Failed to extract PDF info: {e}")
            raise Exception(f"Failed to extract PDF info: {str(e)}")
    
    def _create_error_page(self, page_number: int, error_message: str) -> Dict:
        """
        Create an error placeholder page
        
        Args:
            page_number: Page number that failed
            error_message: Error message
            
        Returns:
            Dictionary with error page info
        """
        # Create a simple error image
        img = Image.new('RGB', (800, 600), color='#f8f9fa')
        
        try:
            from PIL import ImageDraw, ImageFont
            draw = ImageDraw.Draw(img)
            
            # Try to use a default font
            try:
                font_large = ImageFont.truetype("arial.ttf", 36)
                font_medium = ImageFont.truetype("arial.ttf", 24)
                font_small = ImageFont.truetype("arial.ttf", 18)
            except:
                font_large = ImageFont.load_default()
                font_medium = ImageFont.load_default()
                font_small = ImageFont.load_default()
            
            # Draw error message
            draw.text((400, 200), f"Error Loading Page {page_number}", 
                     fill='#dc3545', font=font_large, anchor="mm")
            draw.text((400, 250), "PDF Processing Failed", 
                     fill='#6c757d', font=font_medium, anchor="mm")
            draw.text((400, 300), error_message[:50] + "..." if len(error_message) > 50 else error_message, 
                     fill='#6c757d', font=font_small, anchor="mm")
            
        except ImportError:
            # If PIL drawing is not available, just use plain image
            pass
        
        # Convert to base64
        img_buffer = io.BytesIO()
        img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        img_base64 = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
        data_url = f"data:image/png;base64,{img_base64}"
        
        return {
            "page_number": page_number,
            "width": 800,
            "height": 600,
            "original_width": 800,
            "original_height": 600,
            "scale": 1.0,
            "format": "PNG",
            "file_size_kb": len(img_base64) * 0.75 / 1024,
            "data_url": data_url,
            "file_path": None,
            "filename": f"error_page_{page_number}.png",
            "error": True,
            "error_message": error_message
        }

# Example usage and testing
def main():
    """
    Example usage of the PDF processor
    """
    processor = PDFProcessor()
    
    # Example PDF file path
    pdf_path = "sample.pdf"  # Replace with your PDF path
    
    if os.path.exists(pdf_path):
        try:
            # Extract PDF info
            info = processor.extract_pdf_info(pdf_path)
            print("PDF Info:")
            print(json.dumps(info, indent=2))
            
            # Extract pages as images
            pages = processor.extract_pages_as_images(
                pdf_path=pdf_path,
                scale=2.0,
                image_format="PNG"
            )
            
            print(f"\nExtracted {len(pages)} pages:")
            for page in pages:
                print(f"- Page {page['page_number']}: {page['width']}x{page['height']} "
                      f"({page['file_size_kb']:.1f}KB)")
                
        except Exception as e:
            print(f"Error: {e}")
    else:
        print(f"PDF file not found: {pdf_path}")

if __name__ == "__main__":
    main()
