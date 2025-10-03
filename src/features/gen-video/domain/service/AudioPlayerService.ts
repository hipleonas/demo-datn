/**
 * AudioPlayerService - Advanced audio playback with chunking, prefetching, and caching
 * Implements Web Audio API for smooth, low-latency audio playback
 */

export interface AudioPlayerConfig {
    chunkSize?: number;
    prefetchAhead?: number;
    maxCacheSize?: number;
    speed?: number;
    gap?: number;
}

export interface AudioPlayerCallbacks {
    onProgress?: (current: number, total: number) => void;
    onStatusChange?: (status: string, isLoading: boolean) => void;
    onComplete?: () => void;
    onError?: (error: string) => void;
}

class AudioPlayerService {
    // Configuration
    private readonly CHUNK_SIZE: number = 48; // words per chunk
    private readonly PREFETCH_AHEAD: number = 3; // chunks to prefetch ahead
    private readonly MAX_CACHE_SIZE: number = 5; // max chunks in cache

    // State
    private audioContext: AudioContext | null = null;
    private isPlaying: boolean = false;
    private textChunks: string[] = [];
    private currentChunkIndex: number = 0;
    private activeSource: AudioBufferSourceNode | null = null;
    private audioBufferCache: Map<number, AudioBuffer> = new Map();
    private loadingPromises: Map<number, Promise<AudioBuffer>> = new Map();
    private playbackQueue: AudioBufferSourceNode[] = [];
    private nextPlayTime: number = 0;

    // Runtime config
    private speed: number = 1.0;
    private gap: number = 0.05; // seconds between chunks

    // API endpoint
    private synthesizeEndpoint: string;
    private baseUrl: string;

    // Callbacks
    private callbacks: AudioPlayerCallbacks = {};

    constructor(synthesizeEndpoint: string = 'http://localhost:5000/synthesize') {
        this.synthesizeEndpoint = synthesizeEndpoint;
        // Extract base URL from endpoint (e.g., http://localhost:5000)
        const url = new URL(synthesizeEndpoint);
        this.baseUrl = `${url.protocol}//${url.host}`;
    }

    /**
     * Initialize or resume audio context
     */
    private async initAudioContext(): Promise<void> {
        if (!this.audioContext || this.audioContext.state === 'closed') {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
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
     * Prefetch and cache a specific chunk
     */
    private async prefetchChunk(index: number, speakerId: string): Promise<AudioBuffer> {
        // Return cached buffer if available
        if (this.audioBufferCache.has(index)) {
            return this.audioBufferCache.get(index)!;
        }

        // Return ongoing loading promise if exists
        if (this.loadingPromises.has(index)) {
            return this.loadingPromises.get(index)!;
        }

        // Check bounds
        if (index >= this.textChunks.length) {
            throw new Error(`Chunk index ${index} out of bounds`);
        }

        try {
            // Create loading promise
            const loadingPromise = this.fetchAndDecodeChunk(index, speakerId);
            this.loadingPromises.set(index, loadingPromise);

            const audioBuffer = await loadingPromise;

            // Store in cache and cleanup
            this.audioBufferCache.set(index, audioBuffer);
            this.loadingPromises.delete(index);
            this.cleanupOldChunks(index);

            return audioBuffer;
        } catch (error) {
            this.loadingPromises.delete(index);
            console.error(`Failed to prefetch chunk ${index + 1}:`, error);
            throw error;
        }
    }

    /**
     * Fetch audio from backend and decode it
     */
    private async fetchAndDecodeChunk(index: number, speakerId: string): Promise<AudioBuffer> {
        if (!this.audioContext) {
            throw new Error('Audio context not initialized');
        }

        try {
            console.log(`Fetching chunk ${index + 1}: "${this.textChunks[index].substring(0, 50)}..."`);
            
            // Request synthesis from backend
            const response = await fetch(this.synthesizeEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text_chunk: this.textChunks[index],
                    speaker_id: speakerId
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Server error response:`, errorText);
                throw new Error(`Server error loading chunk ${index + 1}: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Synthesis response for chunk ${index + 1}:`, data);
            
            if (!data.success) {
                throw new Error(data.error || 'Unknown synthesis error');
            }

            // Construct full URL if needed
            let audioUrl = data.url;
            if (audioUrl.startsWith('/')) {
                audioUrl = `${this.baseUrl}${audioUrl}`;
            }
            console.log(`Fetching audio from: ${audioUrl}`);

            // Fetch the audio file
            const audioResponse = await fetch(audioUrl);
            if (!audioResponse.ok) {
                throw new Error(`Audio fetch error for chunk ${index + 1}: ${audioResponse.status}`);
            }

            const arrayBuffer = await audioResponse.arrayBuffer();
            console.log(`Audio buffer size for chunk ${index + 1}: ${arrayBuffer.byteLength} bytes`);
            
            // Decode audio data
            try {
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                console.log(`Successfully decoded chunk ${index + 1}: ${audioBuffer.duration.toFixed(2)}s`);
                return audioBuffer;
            } catch (decodeError) {
                console.error(`Failed to decode audio for chunk ${index + 1}:`, decodeError);
                console.error(`Audio URL was: ${audioUrl}`);
                console.error(`Buffer size: ${arrayBuffer.byteLength} bytes`);
                throw new Error(`Audio decoding failed: ${decodeError instanceof Error ? decodeError.message : 'Unknown decode error'}`);
            }

        } catch (error) {
            console.error(`Error fetching chunk ${index + 1}:`, error);
            throw error;
        }
    }

    /**
     * Clean up old cached chunks to manage memory
     */
    private cleanupOldChunks(currentIndex: number): void {
        const keysToDelete = Array.from(this.audioBufferCache.keys())
            .filter(k => k < currentIndex - 1) // Keep current and previous chunk
            .sort((a, b) => b - a)
            .slice(this.MAX_CACHE_SIZE);

        keysToDelete.forEach(key => {
            this.audioBufferCache.delete(key);
        });
    }

    /**
     * Play the next chunk in sequence
     */
    private async playNextChunk(speakerId: string): Promise<void> {
        if (!this.isPlaying || !this.audioContext || this.currentChunkIndex >= this.textChunks.length) {
            if (this.isPlaying) {
                this.setStatus('Hoàn tất!', false);
                this.callbacks.onComplete?.();
                this.resetState();
            }
            return;
        }

        try {
            // Wait for current chunk to be ready
            let audioBuffer: AudioBuffer;
            if (this.audioBufferCache.has(this.currentChunkIndex)) {
                audioBuffer = this.audioBufferCache.get(this.currentChunkIndex)!;
            } else if (this.loadingPromises.has(this.currentChunkIndex)) {
                audioBuffer = await this.loadingPromises.get(this.currentChunkIndex)!;
            } else {
                audioBuffer = await this.prefetchChunk(this.currentChunkIndex, speakerId);
            }

            if (!this.isPlaying) return; // Check if stopped while waiting

            // Prefetch upcoming chunks aggressively
            const prefetchEnd = Math.min(this.currentChunkIndex + this.PREFETCH_AHEAD, this.textChunks.length);
            for (let i = this.currentChunkIndex + 1; i < prefetchEnd; i++) {
                if (!this.audioBufferCache.has(i) && !this.loadingPromises.has(i)) {
                    this.prefetchChunk(i, speakerId).catch(err => 
                        console.warn(`Prefetch failed for chunk ${i + 1}:`, err)
                    );
                }
            }

            // Create audio source
            const source = this.audioContext.createBufferSource();
            this.playbackQueue.push(source);

            source.buffer = audioBuffer;
            source.playbackRate.value = this.speed;
            source.connect(this.audioContext.destination);

            // Calculate timing
            const chunkDuration = audioBuffer.duration / source.playbackRate.value;
            const startTime = Math.max(this.nextPlayTime, this.audioContext.currentTime + 0.01);

            // Setup ended callback
            source.onended = () => {
                const sourceIndex = this.playbackQueue.indexOf(source);
                if (sourceIndex > -1) {
                    this.playbackQueue.splice(sourceIndex, 1);
                }

                if (this.isPlaying && this.currentChunkIndex < this.textChunks.length - 1) {
                    this.currentChunkIndex++;
                    this.callbacks.onProgress?.(this.currentChunkIndex + 1, this.textChunks.length);

                    const nextGapMs = this.gap * 1000;
                    if (nextGapMs > 0) {
                        setTimeout(() => {
                            if (this.isPlaying) this.playNextChunk(speakerId);
                        }, nextGapMs);
                    } else {
                        if (this.isPlaying) this.playNextChunk(speakerId);
                    }
                } else if (this.isPlaying && this.currentChunkIndex >= this.textChunks.length - 1) {
                    this.setStatus('Hoàn tất!', false);
                    this.callbacks.onComplete?.();
                    this.resetState();
                }
            };

            // Update next play time
            this.nextPlayTime = startTime + chunkDuration + this.gap;

            // Start playback
            this.setStatus(`Đang phát phần ${this.currentChunkIndex + 1}/${this.textChunks.length}...`, true);
            this.callbacks.onProgress?.(this.currentChunkIndex + 1, this.textChunks.length);
            source.start(startTime);
            this.activeSource = source;

        } catch (error) {
            console.error(`Error playing chunk ${this.currentChunkIndex + 1}:`, error);
            this.setStatus(`Lỗi: Không thể phát chunk ${this.currentChunkIndex + 1}`, false);
            this.callbacks.onError?.(`Không thể phát chunk ${this.currentChunkIndex + 1}: ${error}`);
            this.stop();
        }
    }

    /**
     * Start playing text with specified speaker
     */
    public async play(
        fullText: string, 
        speakerId: string, 
        config?: AudioPlayerConfig,
        callbacks?: AudioPlayerCallbacks
    ): Promise<void> {
        if (this.isPlaying) {
            console.warn('Already playing audio');
            return;
        }

        if (!fullText.trim() || !speakerId.trim()) {
            const error = 'Lỗi: Vui lòng nhập cả Speaker ID và văn bản.';
            this.setStatus(error, false);
            this.callbacks.onError?.(error);
            return;
        }

        // Setup configuration
        if (config) {
            this.speed = config.speed ?? this.speed;
            this.gap = config.gap ?? this.gap;
        }

        // Setup callbacks
        this.callbacks = callbacks || {};

        // Initialize audio context
        await this.initAudioContext();

        // Start playback
        this.isPlaying = true;
        this.textChunks = this.splitTextIntoChunks(fullText, config?.chunkSize || this.CHUNK_SIZE);

        if (this.textChunks.length === 0) {
            this.setStatus("Lỗi: Không có nội dung để đọc.", false);
            this.resetState();
            return;
        }

        // Reset state
        this.currentChunkIndex = 0;
        this.audioBufferCache.clear();
        this.loadingPromises.clear();
        this.playbackQueue = [];
        this.nextPlayTime = this.audioContext!.currentTime;

        this.setStatus(`Đang tổng hợp phần 1/${this.textChunks.length}...`, true);

        // Start aggressive prefetching
        const prefetchCount = Math.min(this.PREFETCH_AHEAD, this.textChunks.length);
        const prefetchPromises: Promise<AudioBuffer>[] = [];
        for (let i = 0; i < prefetchCount; i++) {
            prefetchPromises.push(this.prefetchChunk(i, speakerId));
        }

        // Wait for first chunk to be ready
        try {
            await prefetchPromises[0];
            if (!this.isPlaying) return; // Check if stopped while waiting

            // Start playback
            this.playNextChunk(speakerId);
        } catch (error) {
            console.error('Error loading first chunk:', error);
            this.setStatus(`Lỗi: ${error}`, false);
            this.callbacks.onError?.(`Không thể tải chunk đầu tiên: ${error}`);
            this.stop();
        }
    }

    /**
     * Stop playback
     */
    public stop(): void {
        if (!this.isPlaying) return;

        this.isPlaying = false;

        // Stop all active audio sources
        this.playbackQueue.forEach(source => {
            try {
                source.onended = null;
                source.stop();
            } catch (e) {
                console.warn('Error stopping audio source:', e);
            }
        });

        if (this.activeSource) {
            try {
                this.activeSource.onended = null;
                this.activeSource.stop();
            } catch (e) {
                console.warn('Error stopping active source:', e);
            }
        }

        this.setStatus("Đã dừng lại.", false);
        this.resetState();
    }

    /**
     * Pause playback (not fully implemented - would need more complex state tracking)
     */
    public pause(): void {
        // TODO: Implement pause/resume functionality
        // This would require tracking current playback position within a chunk
        console.warn('Pause not fully implemented, stopping instead');
        this.stop();
    }

    /**
     * Check if currently playing
     */
    public getIsPlaying(): boolean {
        return this.isPlaying;
    }

    /**
     * Get current progress
     */
    public getProgress(): { current: number; total: number } {
        return {
            current: this.currentChunkIndex + 1,
            total: this.textChunks.length
        };
    }

    /**
     * Set status message
     */
    private setStatus(message: string, isLoading: boolean): void {
        this.callbacks.onStatusChange?.(message, isLoading);
    }

    /**
     * Reset internal state
     */
    private resetState(): void {
        this.isPlaying = false;
        this.textChunks = [];
        this.currentChunkIndex = 0;
        this.activeSource = null;
        this.playbackQueue = [];
        this.nextPlayTime = 0;

        // Delayed cache cleanup to avoid interrupting ongoing downloads
        setTimeout(() => {
            if (!this.isPlaying) {
                this.audioBufferCache.clear();
                this.loadingPromises.clear();
            }
        }, 1000);
    }

    /**
     * Cleanup resources
     */
    public dispose(): void {
        this.stop();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

export default AudioPlayerService;


