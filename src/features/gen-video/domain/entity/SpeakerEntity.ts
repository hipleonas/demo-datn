class SpeakerEntity {
    id: string;
    audioFileName: string; //speakerName
    audioUrl: string; // URL to the stored audio file (e.g., audio.wav)
    fixedPromptInput: string; // Fixed Vietnamese prompt for voice cloning

    constructor(
        id: string,
        audioFileName: string, // This serves as both filename and speaker name
        audioUrl: string,
        fixedPromptInput: string = "Đối với bọn đơn chất này thì thầy sẽ gọi chung là x hai có công thức cấu tạo là x liên kết đơn với x, nhớ lại kiến thức ở chương liên kết hóa học một chút nhá. Hai nguyên tử giống nhau liên kết với nhau, đương nhiên bọn này chỉ có liên kết cộng hóa trị."
    ) {
        this.id = id;
        this.audioFileName = audioFileName;
        this.audioUrl = audioUrl;
        this.fixedPromptInput = fixedPromptInput;
    }

    // Getters
    getId(): string {
        return this.id;
    }

    getAudioFileName(): string {
        return this.audioFileName;
    }

    getSpeakerName(): string {
        return this.audioFileName; // audioFileName serves as speaker name
    }

    getAudioUrl(): string {
        return this.audioUrl;
    }

    getFixedPromptInput(): string {
        return this.fixedPromptInput;
    }

    // Setters
    setId(id: string): void {
        this.id = id;
    }

    setAudioFileName(audioFileName: string): void {
        this.audioFileName = audioFileName;
    }

    setAudioUrl(audioUrl: string): void {
        this.audioUrl = audioUrl;
    }

    setFixedPromptInput(fixedPromptInput: string): void {
        this.fixedPromptInput = fixedPromptInput;
    }
}

export { SpeakerEntity };