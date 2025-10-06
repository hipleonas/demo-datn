class OcrApi {

    async createClickableObject(slideImageUrls: string[]): Promise<void> {
        // Implement the actual OCR logic here, e.g., call an API or use a library
        console.log("OcrApi: Creating clickable object from slides:", slideImageUrls);
        return new Promise((resolve) => setTimeout(resolve, 1000));
    }
}

export default OcrApi;