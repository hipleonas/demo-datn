/**
 * AudioAccumulatorService - Generate and accumulate audio chunks, then play sequentially
 * Uses HTML5 Audio for reliable playback without decoding issues
 */

export interface AudioChunk {
    index: number;
    text: string;
    audioUrl: string;
    status: 'pending' | 'generating' | 'ready' | 'error';
    error?: string;
}

export interface AudioAccumulatorCallbacks {
    onChunkGenerated?: (chunk: AudioChunk, index: number, total: number) => void;
    onGenerationComplete?: (chunks: AudioChunk[]) => void;
    onPlaybackProgress?: (currentIndex: number, total: number) => void;
    onPlaybackComplete?: () => void;
    onError?: (error: string) => void;
}

class AudioAccumulatorService {
    private readonly CHUNK_SIZE: number = 48; // words per chunk
    private synthesizeEndpoint: string;
    private baseUrl: string;
    
    private audioChunks: AudioChunk[] = [];
    private currentAudioElement: HTMLAudioElement | null = null;
    private isPlaying: boolean = false;
    private currentPlayIndex: number = 0;
    private playbackSpeed: number = 1.0;
    private gapBetweenChunks: number = 0.05; // seconds

    constructor(synthesizeEndpoint: string = 'http://localhost:5000/synthesize') {
        this.synthesizeEndpoint = synthesizeEndpoint;
        const url = new URL(synthesizeEndpoint);
        this.baseUrl = `${url.protocol}//${url.host}`;
    }

    /**
     * Split text into chunks based on word count
     */
    private splitTextIntoChunks(fullText: string, chunkSize: number): string[] {
        const sentences = fullText.match(/[^.!?]+[.!?]?/g) || [fullText];
        const chunks: string[] = [];
        let currentChunk: string[] = [];
        let currentWordCount = 0;

        for (const sentence of sentences) {
            const words = sentence.trim().split(/\s+/);
            if (words[0] === "") continue;

            if (currentWordCount + words.length > chunkSize && currentChunk.length > 0) {
                chunks.push(currentChunk.join(" ").trim());
                currentChunk = [];
                currentWordCount = 0;
            }

            currentChunk.push(sentence.trim());
            currentWordCount += words.length;
        }

        if (currentChunk.length > 0) {
            chunks.push(currentChunk.join(" ").trim());
        }

        return chunks;
    }

    /**
     * Generate a single audio chunk
     */
    private async generateChunk(text: string, speakerId: string): Promise<string> {
        try {
            const response = await fetch(this.synthesizeEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text_chunk: text,
                    speaker_id: speakerId
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server error response:', errorText);
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Synthesis failed');
            }

            // Construct full URL if needed
            let audioUrl = data.url;
            if (audioUrl.startsWith('/')) {
                audioUrl = `${this.baseUrl}${audioUrl}`;
            }

            return audioUrl;
        } catch (error) {
            console.error('Error generating audio chunk:', error);
            throw error;
        }
    }

    /**
     * Generate all audio chunks for the text
     */
    public async generateAllChunks(
        fullText: string,
        speakerId: string,
        callbacks?: AudioAccumulatorCallbacks
    ): Promise<AudioChunk[]> {
        try {
            // Split text into chunks
            const textChunks = this.splitTextIntoChunks(fullText, this.CHUNK_SIZE);
            console.log(`Split text into ${textChunks.length} chunks`);

            // Initialize chunk objects
            this.audioChunks = textChunks.map((text, index) => ({
                index,
                text,
                audioUrl: '',
                status: 'pending' as const
            }));

            // Generate each chunk sequentially
            for (let i = 0; i < textChunks.length; i++) {
                this.audioChunks[i].status = 'generating';
                
                try {
                    console.log(`Generating chunk ${i + 1}/${textChunks.length}`);
                    const audioUrl = await this.generateChunk(textChunks[i], speakerId);
                    
                    this.audioChunks[i].audioUrl = audioUrl;
                    this.audioChunks[i].status = 'ready';
                    
                    console.log(`Chunk ${i + 1} ready: ${audioUrl}`);
                    callbacks?.onChunkGenerated?.(this.audioChunks[i], i + 1, textChunks.length);
                    
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    this.audioChunks[i].status = 'error';
                    this.audioChunks[i].error = errorMsg;
                    console.error(`Failed to generate chunk ${i + 1}:`, error);
                    
                    // Continue with next chunk instead of stopping
                    callbacks?.onError?.(`Chunk ${i + 1} failed: ${errorMsg}`);
                }
            }

            callbacks?.onGenerationComplete?.(this.audioChunks);
            return this.audioChunks;

        } catch (error) {
            console.error('Error in generateAllChunks:', error);
            callbacks?.onError?.(error instanceof Error ? error.message : 'Generation failed');
            throw error;
        }
    }

    /**
     * Play all generated chunks sequentially
     */
    public async playAllChunks(
        speed: number = 1.0,
        gap: number = 0.05,
        callbacks?: AudioAccumulatorCallbacks
    ): Promise<void> {
        if (this.isPlaying) {
            console.warn('Already playing');
            return;
        }

        const readyChunks = this.audioChunks.filter(chunk => chunk.status === 'ready');
        if (readyChunks.length === 0) {
            callbacks?.onError?.('No audio chunks available to play');
            return;
        }

        this.isPlaying = true;
        this.currentPlayIndex = 0;
        this.playbackSpeed = speed;
        this.gapBetweenChunks = gap;

        console.log(`Starting playback of ${readyChunks.length} chunks`);
        await this.playNextChunk(callbacks);
    }

    /**
     * Play the next chunk in sequence
     */
    private async playNextChunk(callbacks?: AudioAccumulatorCallbacks): Promise<void> {
        if (!this.isPlaying) {
            return;
        }

        // Find next ready chunk
        while (this.currentPlayIndex < this.audioChunks.length) {
            const chunk = this.audioChunks[this.currentPlayIndex];
            
            if (chunk.status === 'ready') {
                try {
                    console.log(`Playing chunk ${this.currentPlayIndex + 1}/${this.audioChunks.length}`);
                    callbacks?.onPlaybackProgress?.(this.currentPlayIndex + 1, this.audioChunks.length);
                    
                    await this.playChunk(chunk);
                    
                    // Wait for gap between chunks
                    if (this.gapBetweenChunks > 0 && this.isPlaying) {
                        await new Promise(resolve => setTimeout(resolve, this.gapBetweenChunks * 1000));
                    }
                    
                    this.currentPlayIndex++;
                } catch (error) {
                    console.error(`Error playing chunk ${this.currentPlayIndex + 1}:`, error);
                    this.currentPlayIndex++;
                }
            } else {
                // Skip non-ready chunks
                this.currentPlayIndex++;
            }
        }

        // Playback complete
        if (this.isPlaying) {
            console.log('Playback complete');
            this.isPlaying = false;
            callbacks?.onPlaybackComplete?.();
        }
    }

    /**
     * Play a single chunk
     */
    private playChunk(chunk: AudioChunk): Promise<void> {
        return new Promise((resolve, reject) => {
            const audio = new Audio(chunk.audioUrl);
            audio.playbackRate = this.playbackSpeed;
            this.currentAudioElement = audio;

            audio.onended = () => {
                this.currentAudioElement = null;
                resolve();
            };

            audio.onerror = (error) => {
                console.error('Audio playback error:', error);
                this.currentAudioElement = null;
                reject(new Error('Audio playback failed'));
            };

            audio.play().catch(error => {
                console.error('Failed to start audio playback:', error);
                reject(error);
            });
        });
    }

    /**
     * Stop playback
     */
    public stop(): void {
        this.isPlaying = false;
        
        if (this.currentAudioElement) {
            this.currentAudioElement.pause();
            this.currentAudioElement = null;
        }
        
        this.currentPlayIndex = 0;
        console.log('Playback stopped');
    }

    /**
     * Get current chunks
     */
    public getChunks(): AudioChunk[] {
        return this.audioChunks;
    }

    /**
     * Get playback status
     */
    public isCurrentlyPlaying(): boolean {
        return this.isPlaying;
    }

    /**
     * Clear all chunks
     */
    public clear(): void {
        this.stop();
        this.audioChunks = [];
    }
}

export default AudioAccumulatorService;

