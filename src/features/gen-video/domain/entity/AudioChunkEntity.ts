class AudioChunkEntity {
    chunkIndex: number;
    chunkText: string;
    chunkAudioUrl: string;
    chunkStatus: 'pending' | 'generating' | 'ready' | 'error';
    chunkError?: string;

    constructor(chunkIndex: number, chunkText: string, chunkAudioUrl: string, chunkStatus: 'pending' | 'generating' | 'ready' | 'error', chunkError?: string) {
        this.chunkIndex = chunkIndex;
        this.chunkText = chunkText;
        this.chunkAudioUrl = chunkAudioUrl;
        this.chunkStatus = chunkStatus;
        this.chunkError = chunkError;
    }

    getChunkIndex(): number {
        return this.chunkIndex;
    }

    getChunkText(): string {
        return this.chunkText;
    }

    getChunkAudioUrl(): string {
        return this.chunkAudioUrl;
    }


    getChunkStatus(): 'pending' | 'generating' | 'ready' | 'error' {
        return this.chunkStatus;
    }

    getChunkError(): string | undefined {
        return this.chunkError;
    }

    setChunkIndex(chunkIndex: number): void {
        this.chunkIndex = chunkIndex;
    }

    setChunkText(chunkText: string): void {
        this.chunkText = chunkText;
    }

    setChunkAudioUrl(chunkAudioUrl: string): void {
        this.chunkAudioUrl = chunkAudioUrl;
    }

    setChunkStatus(chunkStatus: 'pending' | 'generating' | 'ready' | 'error'): void {
        this.chunkStatus = chunkStatus;
    }

    setChunkError(chunkError: string): void {
        this.chunkError = chunkError;
    }
}

export {AudioChunkEntity};