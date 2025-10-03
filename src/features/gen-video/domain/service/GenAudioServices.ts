import {SpeakerEntity} from "../entity/SpeakerEntity";
import {SlideEntity} from "../entity/SlideEntity";
import AudioPlayerService from "./AudioPlayerService";
import type { AudioPlayerConfig, AudioPlayerCallbacks } from "./AudioPlayerService";
import AudioAccumulatorService from "./AudioAccumulatorService";
import type { AudioChunk, AudioAccumulatorCallbacks } from "./AudioAccumulatorService";

// Re-export types for use in other modules
export type { AudioChunk, AudioAccumulatorCallbacks };

export interface GenAudioServicesInterface {
    validateAudioFile(audioFile: File): boolean;
    createAudioLocalUrl(audioFile: File): string;
    registerSpeaker(audioFile: File, speakerName: string): SpeakerEntity;
    registerSpeakerWithBackend(speakerId: string, audioFile: File, promptText: string): Promise<boolean>;
    getSpeakerList(): SpeakerEntity[];
    getSpeakerById(speakerId: string): SpeakerEntity | null;
    deleteSpeaker(speakerId: string): boolean;
    processPDF(file: File, options?: any): Promise<SlideEntity[]>;
    getPDFInfo(file: File): Promise<any>;
}

class GenAudioServices implements GenAudioServicesInterface {
    private readonly SPEAKERS_STORAGE_KEY = "gia-su-ai-speakers";
    private pdfServiceUrl: string = "http://localhost:8000";  // PDF Service (FastAPI)
    private ttsServiceUrl: string = "http://localhost:5000";  // TTS Service (Flask)
    private audioPlayer: AudioPlayerService;
    private audioAccumulator: AudioAccumulatorService;
    
    constructor() {
        this.audioPlayer = new AudioPlayerService(`${this.ttsServiceUrl}/synthesize`);
        this.audioAccumulator = new AudioAccumulatorService(`${this.ttsServiceUrl}/synthesize`);
    }
    //Local storage

    private saveSpeakersToStorage(speakers: SpeakerEntity[]) : void {
        try {
            const mapSpeakers = speakers.map(
                spk => {
                    const data = {
                        id: spk.getId(),
                        audioFile: spk.getAudioFileName(),
                        audioUrl: spk.getAudioUrl(),
                        fixedPromptInput: spk.getFixedPromptInput()
                    }
                    return data;
                }
            );

            const jsonData = JSON.stringify(mapSpeakers, null , 2);
            localStorage.setItem(this.SPEAKERS_STORAGE_KEY, jsonData);
            //Verify save
            const verified = localStorage.getItem(this.SPEAKERS_STORAGE_KEY);

            if (!verified) {
                throw new Error("Verification failed: Data not found in localStorage after save");
            }
            console.log(`Successfully saved ${speakers.length} speakers to local storage`);
            console.log("Saved data:", jsonData);
        }
        catch(error) {
            throw new Error("Failed to save speakers to local storage: " + error);
        }
    }

    private loadSpeakersFromStorage(): SpeakerEntity[] {
        try  {
            const speakersData = localStorage.getItem(this.SPEAKERS_STORAGE_KEY);
            console.log("Raw localStorage data:", speakersData);
            if(!speakersData) {
                console.log("No speakers found in local storage");
                return []
            }
            const parsedData = JSON.parse(speakersData);
            console.log("Parsed data from localStorage:", parsedData);

            const speakers_data_entity = parsedData
                .filter((data: any) => data && data.id && data.audioFile && data.audioUrl)
                .map((data: any) => {
                    return new SpeakerEntity(
                        data.id,
                        data.audioFile,
                        data.audioUrl,
                        data.fixedPromptInput || "Default prompt"
                    )
                })
            return speakers_data_entity;
        }
        catch(error) {
            console.error("Failed to load speakers from local storage: ", error);
            throw new Error("Failed to load speakers from local storage: " + error);
        }
    }

    validateAudioFile(audioFile: File): boolean {
        if (!audioFile) {
            throw new Error("No audio file provided");
        }
        const validTypes = ["audio/mpeg", "audio/wav", "audio/mp3", "audio/m4a", "audio/ogg", "audio/webm"];
        
        return validTypes.includes(audioFile.type);
    }

    createAudioLocalUrl(audioFile: File): string {
        if (!audioFile) {
            throw new Error("No audio file provided");
        }

        if (!this.validateAudioFile(audioFile)) {
            throw new Error("Invalid audio file");
        }

        const url = URL.createObjectURL(audioFile);
        return url;
    }

    async registerSpeakerWithBackend(speakerId: string, audioFile: File, promptText: string): Promise<boolean> {
        try {
            const formData = new FormData();
            formData.append('audio_file', audioFile);
            formData.append('speaker_id', speakerId);
            formData.append('prompt_text', promptText);

            const response = await fetch(`${this.ttsServiceUrl}/register`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(`Backend registration failed: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Backend speaker registration failed:', error);
            throw new Error(`Backend speaker registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    registerSpeaker(audioFile: File, speakerName: string): SpeakerEntity  {
        try {
            if(!audioFile) {
                throw new Error("Audio file is required!");
            }
            if(!speakerName || !speakerName.trim()) {
                throw new Error("Speaker name is required");
            }
            //validate audio file

            if(!this.validateAudioFile(audioFile)) {
                throw new Error("Invalid audio file");
            }

            

            //generate unique speaker id

            const speakerId = `speaker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const localUrl = this.createAudioLocalUrl(audioFile);
            if (!localUrl) {
                throw new Error("Failed to create audio local url");
            }
            const fixedPromptInput = "Xin chào, tôi muốn vui lòng được trải nghiệm dịch vụ tạo sinh giọng của hệ thống gia sư AI. Tôi đã xác nhận và đồng ý với các điều khoản và quy định pháp lí của dịch vụ này.";
            //Create speaker entity

            const speaker = new SpeakerEntity(
                speakerId,
                speakerName.trim(),
                localUrl,
                fixedPromptInput
            )

            const currentSpeakers = this.loadSpeakersFromStorage();
            console.log("Current speakers:", currentSpeakers.map(s => s.getAudioFileName()));
            console.log("Checking for duplicate speaker name:", speakerName.trim().toLowerCase());
            
            const foundDuplicate = currentSpeakers.find(spk => 
                spk.getAudioFileName() && spk.getAudioFileName().toLowerCase() === speakerName.trim().toLowerCase()
            );
            if (foundDuplicate) {
                throw new Error(`Speaker name "${speakerName}" already exists`);
            }
            //Add new speaker
            currentSpeakers.push(speaker);

            this.saveSpeakersToStorage(currentSpeakers);

            return speaker;
        }
        catch(error){
            console.error("Failed to register speaker: ", error);
            throw new Error("Failed to register speaker: " + error);
            // return null;

        }
    }

    getSpeakerList() : SpeakerEntity[] {
        try{
            console.log("=== GET SPEAKER LIST ===");
            const speakers = this.loadSpeakersFromStorage();
            console.log("Loaded speakers count:", speakers.length);
            console.log("Speaker details:", speakers.map(s => ({ id: s.getId(), name: s.getAudioFileName() })));
            if (speakers.length === 0) {
                console.log("No speakers found in local storage");
                return [];
            }
            console.log("=== RETURNING SPEAKERS ===");
            return speakers;
        }
        catch(error){
            console.error("Failed to get speaker list: ", error);
            throw new Error("Failed to get speaker list: " + error);
        }
    }
    getSpeakerById(speakerId: string): SpeakerEntity | null{
        try {
            const speakers = this.loadSpeakersFromStorage();
            const foundSpeaker_with_id = speakers.find(spk => spk.getId() === speakerId);

            if(!foundSpeaker_with_id) {
                console.log("Speaker not found with id: ", speakerId);
                return null;
            }
            return foundSpeaker_with_id;
        }
        catch(error) {
            console.error("Failed to get speaker by id: ", error);
            throw new Error("Failed to get speaker by id: " + error);
        }
    }

    deleteSpeaker(speakerId: string): boolean {
        try {
            const speakers = this.loadSpeakersFromStorage();
            const initialLength = speakers.length;
            const filteredSpeakers = speakers.filter(s => s.getId() !== speakerId);
            
            if (filteredSpeakers.length < initialLength) {
                this.saveSpeakersToStorage(filteredSpeakers);
                console.log(`Speaker ${speakerId} deleted successfully`);
                return true;
            } else {
                console.log(`Speaker ${speakerId} not found for deletion`);
                return false;
            }
        } catch (error) {
            console.error('Error deleting speaker:', error);
            return false;
        }
    }

    //PDF Processing Methods

    private async checkPDFServiceHealth() : Promise<boolean>{
        try {
            const response = await fetch(`${this.pdfServiceUrl}/health`);
            return response.ok;
        }
        catch(error){
            console.error("Failed to check PDF service health: ", error);
            return false;
        }
    }
    async getPDFInfo(file: File) : Promise<any> {
        try {
            console.log(`Extract info for: ${file.name}`);

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${this.pdfServiceUrl}/pdf-info`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
                throw new Error(`Backend error: ${errorData.detail || response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Failed to get PDF info');
            }

            console.log(`PDF info retrieved: ${data.pdf_info.total_pages} pages`);
            return data.pdf_info;

        }
        catch(error) {
            console.error('Failed to get PDF info:', error);
            throw new Error(`Failed to get PDF info: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async processPDF(file: File, options: any = {}): Promise<SlideEntity[]> {
        try {
            console.log(`🔧 Processing PDF with Python backend: ${file.name}`);
            
            // Check if backend is available
            const isHealthy = await this.checkPDFServiceHealth();
            if (!isHealthy) {
                throw new Error('Python backend is not available. Please start the backend service.');
            }

            const { scale = 2.0, imageFormat = 'PNG' } = options;

            const formData = new FormData();
            formData.append('file', file);
            formData.append('scale', scale.toString());
            formData.append('image_format', imageFormat);

            console.log(`Uploading PDF to backend...`);
            const response = await fetch(`${this.pdfServiceUrl}/upload-pdf`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
                throw new Error(`Backend error: ${errorData.detail || response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'PDF processing failed');
            }

            console.log(`Backend processing completed: ${data.pages.length} pages`);

            // Convert backend response to SlideEntity objects
            const slides: SlideEntity[] = data.pages.map((page: any) => {
                return new SlideEntity(
                    `python_pdf_slide_${page.page_number}`,
                    page.page_number,
                    page.data_url,
                    `Page ${page.page_number} from ${data.processing_params.original_filename}${page.error ? ' (Error)' : ''}`,
                    'default',
                    '',
                    false
                );
            });

            console.log(`Processing Summary: ${slides.length} slides created`);
            return slides;

        } catch (error) {
            console.error('Python PDF processing failed:', error);
            throw new Error(`Python PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    //Generate Voice Methods
    private async checkTTSServiceHealth() : Promise<boolean> {
        try {
            const response = await fetch(`${this.ttsServiceUrl}/health`);
            return response.ok;
        }
        catch (error) {
            console.error("Failed to check TTS service health:", error);
            return false;
        }
    }

    async synthesizeText(text: string, speakerId: string, options?: {
        speed?: number;
        gap?: number;
    }): Promise<string>{
        try {
            console.log(`Synthesizing text with speaker ${speakerId}: ${text.substring(0, 10) + "..."}`);
            const isHealthy = await this.checkTTSServiceHealth();
            if (!isHealthy) {
                throw new Error('TTS service is not available. Please start the TTS backend service.');
            }

            const response = await fetch(`${this.ttsServiceUrl}/synthesize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text_chunk: text,
                    speaker_id: speakerId,
                    speed: options?.speed || 1.0,
                    gap: options?.gap || 0.05
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(`TTS synthesis failed: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'TTS synthesis failed');
            }

            console.log("TTS synthesis successful, audio URL:", data.url);
            return data.url;

        }
        catch(error) {
            console.error('TTS synthesis failed:', error);
            throw new Error(`TTS synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }


    async synthesizeTextStreaming(text: string, speakerId: string, options?: {
        speed?: number;
        gap?: number;
        chunkSize?: number;
        onProgress?: (chunk: number, total: number) => void;
        onChunkReady?: (audioUrl: string, chunk: number) => void;
    }): Promise<string[]> {
        try {
            console.log(`Starting streaming synthesis for speaker ${speakerId}`);
            
            const chunkSize = options?.chunkSize || 48;
            const textChunks = this.splitTextIntoChunks(text, chunkSize);
            const audioUrls: string[] = [];
            
            console.log(`Split text into ${textChunks.length} chunks`);

            for (let i = 0; i < textChunks.length; i++) {
                try {
                    options?.onProgress?.(i + 1, textChunks.length);
                    
                    const audioUrl = await this.synthesizeText(textChunks[i], speakerId, {
                        speed: options?.speed,
                        gap: options?.gap
                    });
                    
                    audioUrls.push(audioUrl);
                    options?.onChunkReady?.(audioUrl, i + 1);
                    
                    console.log(`Chunk ${i + 1}/${textChunks.length} synthesized successfully`);
                    
                } catch (error) {
                    console.error(`Failed to synthesize chunk ${i + 1}:`, error);
                    throw new Error(`Failed to synthesize chunk ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            console.log(`Streaming synthesis completed: ${audioUrls.length} audio chunks`);
            return audioUrls;

        } catch (error) {
            console.error('Streaming synthesis failed:', error);
            throw new Error(`Streaming synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

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

    async generateVoiceForSlide(slideId: string, text: string, speakerId: string, options?: {
        speed?: number;
        gap?: number;
    }): Promise<string> {
        try {
            if (!text.trim()) {
                throw new Error("No text provided for voice generation");
            }
            
            if (!speakerId || speakerId === 'default') {
                throw new Error("No speaker selected for voice generation");
            }

            console.log(`Generating voice for slide ${slideId} with speaker ${speakerId}`);
            
            const audioUrl = await this.synthesizeText(text, speakerId, options);
            
            console.log(`Voice generation completed for slide ${slideId}`);
            return audioUrl;

        } catch (error) {
            console.error(`Voice generation failed for slide ${slideId}:`, error);
            throw new Error(`Voice generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Advanced Audio Player Methods with Prefetching and Caching

    /**
     * Play text with advanced chunking, prefetching, and smooth playback
     * @param text Full text to play
     * @param speakerId Speaker ID to use
     * @param config Player configuration (chunk size, prefetch, speed, gap)
     * @param callbacks Status and progress callbacks
     */
    async playTextWithAdvancedPlayer(
        text: string, 
        speakerId: string, 
        config?: AudioPlayerConfig,
        callbacks?: AudioPlayerCallbacks
    ): Promise<void> {
        try {
            await this.audioPlayer.play(text, speakerId, config, callbacks);
        } catch (error) {
            console.error('Advanced audio player failed:', error);
            throw new Error(`Audio playback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Stop current audio playback
     */
    stopAudioPlayback(): void {
        this.audioPlayer.stop();
    }

    /**
     * Pause current audio playback
     */
    pauseAudioPlayback(): void {
        this.audioPlayer.pause();
    }

    /**
     * Check if audio is currently playing
     */
    isAudioPlaying(): boolean {
        return this.audioPlayer.getIsPlaying();
    }

    /**
     * Get current playback progress
     */
    getAudioProgress(): { current: number; total: number } {
        return this.audioPlayer.getProgress();
    }

    /**
     * Cleanup audio player resources
     */
    disposeAudioPlayer(): void {
        this.audioPlayer.dispose();
    }

    // Audio Accumulator Methods (Batch Generation + Sequential Playback)

    /**
     * Generate all audio chunks for text (batch generation)
     */
    async generateAudioChunks(
        text: string,
        speakerId: string,
        callbacks?: AudioAccumulatorCallbacks
    ): Promise<AudioChunk[]> {
        try {
            return await this.audioAccumulator.generateAllChunks(text, speakerId, callbacks);
        } catch (error) {
            console.error('Audio chunk generation failed:', error);
            throw new Error(`Audio chunk generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Play all generated audio chunks sequentially
     */
    async playAccumulatedAudio(
        speed: number = 1.0,
        gap: number = 0.05,
        callbacks?: AudioAccumulatorCallbacks
    ): Promise<void> {
        try {
            await this.audioAccumulator.playAllChunks(speed, gap, callbacks);
        } catch (error) {
            console.error('Audio playback failed:', error);
            throw new Error(`Audio playback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Stop accumulated audio playback
     */
    stopAccumulatedAudio(): void {
        this.audioAccumulator.stop();
    }

    /**
     * Get generated audio chunks
     */
    getAudioChunks(): AudioChunk[] {
        return this.audioAccumulator.getChunks();
    }

    /**
     * Check if accumulated audio is playing
     */
    isAccumulatedAudioPlaying(): boolean {
        return this.audioAccumulator.isCurrentlyPlaying();
    }

    /**
     * Clear all accumulated audio chunks
     */
    clearAudioChunks(): void {
        this.audioAccumulator.clear();
    }
    
}




export default GenAudioServices;