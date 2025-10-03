# PDF Extractor Service

FastAPI service để xử lý PDF và trích xuất ảnh từ các trang PDF.

## Cài đặt

1. Cài đặt Python dependencies:
```bash
pip install -r requirements.txt
```

2. Chạy server:
```bash
python run_server.py
```

Hoặc:
```bash
python main.py
```

## API Endpoints

### 1. Health Check
- **GET** `/health` - Kiểm tra trạng thái service

### 2. PDF Info
- **POST** `/pdf-info` - Lấy thông tin cơ bản của PDF (số trang, metadata, etc.)

### 3. Upload & Process PDF
- **POST** `/upload-pdf` - Upload PDF và trích xuất tất cả trang thành ảnh
  - Parameters:
    - `file`: PDF file (required)
    - `scale`: Tỷ lệ phóng to (default: 2.0)
    - `image_format`: Định dạng ảnh (PNG/JPEG, default: PNG)

### 4. Extract Single Page
- **POST** `/extract-page` - Trích xuất một trang cụ thể
  - Parameters:
    - `file`: PDF file (required)
    - `page_number`: Số trang cần trích xuất (required)
    - `scale`: Tỷ lệ phóng to (default: 2.0)
    - `image_format`: Định dạng ảnh (PNG/JPEG, default: PNG)

### 5. List Extracted Images
- **GET** `/extracted-images` - Liệt kê tất cả ảnh đã trích xuất

## Sử dụng với Frontend

Service này được thiết kế để hoạt động với `GenAudioServices.ts` trong frontend. Các endpoint chính:

- `http://localhost:8000/health` - Health check
- `http://localhost:8000/pdf-info` - Lấy thông tin PDF
- `http://localhost:8000/upload-pdf` - Xử lý PDF chính

## Cấu trúc Response

### PDF Info Response:
```json
{
  "success": true,
  "pdf_info": {
    "total_pages": 5,
    "title": "Document Title",
    "author": "Author Name",
    "file_size": 1024000
  }
}
```

### Upload PDF Response:
```json
{
  "success": true,
  "message": "Successfully processed 5 pages",
  "pdf_info": {...},
  "pages": [
    {
      "page_number": 1,
      "width": 1600,
      "height": 1200,
      "data_url": "data:image/png;base64,...",
      "file_path": "extracted_images/page_1.png",
      "filename": "page_1.png"
    }
  ],
  "processing_params": {
    "original_filename": "document.pdf",
    "scale": 2.0,
    "image_format": "PNG",
    "total_pages": 5
  }
}
```

## Lưu ý

- Service chạy trên port 8000
- CORS được cấu hình để cho phép tất cả origins (chỉ dùng cho development)
- Ảnh được lưu trong thư mục `extracted_images/`
- Service tự động dọn dẹp file tạm sau khi xử lý
