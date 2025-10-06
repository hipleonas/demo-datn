import type { GenVideoRepositoryInterface } from "../repository/GenVideoRepositoryInterface";
import  { SpeakerEntity } from "../entity/SpeakerEntity";
import { AudioSlideEntity } from "../entity/AudioSlideEntity";
import { AudioChunkEntity } from "../entity/AudioChunkEntity";
import type { AudioAccumulatorCallbacksEntity } from "../entity/AudioAccumulatorCallbacksEntity";

class AudioServices implements GenVideoRepositoryInterface {
    
    // uploadAudioFile(audioFile: File): string {
    //     // Logic to upload audio file and return URL
    //     console.log("Uploading audio file:", audioFile.name);
    //     return "uploadedAudioUrl";
    // }

    private genVideoRepository: GenVideoRepositoryInterface;
    private readonly SPEAKERS_STORAGE_KEY = "gia-su-ai-speakers";
    private ttsServiceUrl: string = "http://localhost:5000";

    //*These services methods are currently not used*/
    // private audioPlayer: AudioPlayerService;
    // Properties for Audio Accumulator

    private readonly CHUNK_SIZE: number = 48;
    private synthesizeEndpoint: string;
    private baseUrl: string;


    private audioChunks: AudioChunkEntity[] = [];
    private currentAudioElement: HTMLAudioElement | null = null;
    private isPlayingAudio: boolean = false;
    private isPlaying: boolean = false;
    private currentPlayIndex: number = 0;
    private playbackSpeed: number = 1.0;
    private gapBetweenChunks: number = 0.05; // seconds

    
    constructor(genVideoRepository: GenVideoRepositoryInterface) {
        this.genVideoRepository = genVideoRepository;
        this.synthesizeEndpoint = "http://localhost:5000/synthesize";
        // this.preprocessEndpoint = "http://localhost:5000/preprocess";
        const url = new URL(this.synthesizeEndpoint);
        this.baseUrl = `${url.protocol}//${url.host}`;
    }

    //Video related methods
    async generateVideo(referenceImage: File, slides: AudioSlideEntity[]): Promise<void> {
        // Implement video generation logic here
        console.log("VideoServices: Generating video with reference image and slides:", referenceImage.name, slides);
        await this.genVideoRepository.generateVideo(referenceImage, slides);
        return;
    }

    //Inside the audio service we will implment
    /**
        + Constructor
        + Function implementation
        + A single Repository acts like a define function  
    */
    validateAudioFile(audioFile: File): boolean {
        if (!audioFile) {
            throw new Error("No audio file provided");
        }
        const validTypes = ["audio/mpeg", "audio/wav", "audio/mp3", "audio/m4a", "audio/ogg", "audio/webm"];
        
        return validTypes.includes(audioFile.type);
    }

    createAudioLocalUrl(audioFile: File): string{
        if (!audioFile) {
            throw new Error("No audio file provided");
        }

        if (!this.validateAudioFile(audioFile)) {
            throw new Error("Invalid audio file");
        }

        const url = URL.createObjectURL(audioFile);
        return url;
    }

    loadSpeakersFromStorage(): SpeakerEntity[] {
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

    saveSpeakersToStorage(speakers: SpeakerEntity[]) : void {
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


    async handleRegisterSpeaker(audioFile: File, speakerName: string): Promise<{ success: boolean; message: string; SpeakerEntity?: SpeakerEntity }> {
        try {
            if(!audioFile) {
                throw new Error("Audio file is required");
            }
            if (!speakerName || !speakerName.trim()) {
                throw new Error("Speaker name is required");
            }

            if (!this.validateAudioFile(audioFile)) {
                throw new Error("Invalid audio file");
            }

            //Local CHECKS & Prep
            const currentSpeakers = this.loadSpeakersFromStorage();
            const speakerId = speakerName.trim().toLowerCase();
            const foundDuplicate = currentSpeakers.find(spk => 
                spk.getAudioFileName() && spk.getAudioFileName().toLowerCase() === speakerName.trim().toLowerCase()
            );

            if (foundDuplicate) {
                throw new Error(`Speaker name "${speakerName}" already exists`);
            }
            //const promptText = "Xin chào, tôi muốn vui lòng được trải nghiệm dịch vụ tạo sinh giọng của hệ thống gia sư AI. Tôi đã xác nhận và đồng ý với các điều khoản và quy định pháp lí của dịch vụ này.";
            const promptText = "Xin chào, tôi rất mong muốn được thử tính năng tạo giọng nói tự động của hệ thống gia sư trí tuệ nhân tạo. Tôi hiểu rằng đây là một dịch vụ cần sự đồng thuận về mặt pháp lí, và tôi đã đọc kỹ cũng như đồng ý với tất cả các điều khoản sử dụng. Việc xác nhận này đồng nghĩa với việc tôi tự nguyện tham gia và hoàn toàn chịu trách nhiệm với dữ liệu mình cung cấp cho hệ thống.";
            const formData  = new FormData();
            formData.append('audio_file', audioFile);
            formData.append('speaker_id', speakerId);
            formData.append('prompt_text', promptText);

            //Working with database and api call from the backend

            const response = await fetch(`${this.ttsServiceUrl}/register`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown API error' }));
                // Throw a specific error from the backend.
                throw new Error(`Backend registration failed: ${errorData.error || response.statusText}`);
            }

            //Save locally after successful backend registration

            const localUrl = this.createAudioLocalUrl(audioFile);
            if (!localUrl) {
                console.warn("Speaker registered on backend, but failed to create local URL.");
                throw new Error("Failed to create audio local URL.");
            }

            const newSpeaker = new SpeakerEntity (
                speakerId,
                speakerName.trim(),
                localUrl,
                promptText
            );

            currentSpeakers.push(newSpeaker);

            this.saveSpeakersToStorage(currentSpeakers);

            return {
                success: true,
                message: "Speaker registered successfully"
            }


        }
        catch (error) {
            console.error("Failed to register speaker in service: ", error instanceof Error ? error.message : "Unknown error");
            // Re-throw the error so the controller can catch it and format the final response.
            throw new Error(error instanceof Error ? error.message : "Unknown error");

        }
    }


    getSpeakerList() : SpeakerEntity[] {
        try {
            const speakers = this.loadSpeakersFromStorage();
            if(speakers.length === 0 ){
                console.log("No speakers found in local storage");
                return [];
            }

            return speakers;

        }
        catch(error) {
            console.error("Failed to get speaker list in service: ", error instanceof Error ? error.message : "Unknown error");
            throw new Error("Failed to get speaker list in service: " + error);
        }
    }

    //@New method: TTS Method for generated audio chunks

    //@Audio Accumulator methods

    splitTextIntoChunks(fullText: string, chunkSize: number): string[] {
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

    async generateChunk(text: string, speakerId: string): Promise<string> {
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
            console.log(`Backend returned URL: ${audioUrl}`);
            
            if (audioUrl.startsWith('/')) {
                audioUrl = `${this.baseUrl}${audioUrl}`;
            }
            
            console.log(`Full audio URL for speaker ${speakerId}: ${audioUrl}`);
            return audioUrl;
        } catch (error) {
            console.error('Error generating audio chunk:', error);
            throw error;
        }
    }

    async generateAllChunks(
        fullText: string,
        speakerId: string,
        callbacks?: AudioAccumulatorCallbacksEntity
    ): Promise<AudioChunkEntity[]> {
        try {
            // Split text into chunks
            const textChunks = this.splitTextIntoChunks(fullText, this.CHUNK_SIZE);
            console.log(`Split text into ${textChunks.length} chunks`);

            // Initialize chunk objects
            this.audioChunks = textChunks.map((text, index) => 
                new AudioChunkEntity(index, text, '', 'pending')
            );

            // Generate each chunk sequentially
            for (let i = 0; i < textChunks.length; i++) {
                this.audioChunks[i].setChunkStatus('generating');
                
                try {
                    console.log(`Generating chunk ${i + 1}/${textChunks.length}`);
                    const audioUrl = await this.generateChunk(textChunks[i], speakerId);
                    
                    this.audioChunks[i].setChunkAudioUrl(audioUrl);
                    this.audioChunks[i].setChunkStatus('ready');
                    
                    console.log(`Chunk ${i + 1} ready: ${audioUrl}`);
                    callbacks?.onChunkGenerated?.(this.audioChunks[i], i + 1, textChunks.length);
                    
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    this.audioChunks[i].setChunkStatus('error');
                    this.audioChunks[i].setChunkError(errorMsg);
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

    async playAllChunks(
        speed: number = 1.0,
        gap: number = 0.05,
        callbacks?: AudioAccumulatorCallbacksEntity
    ): Promise<void> {
        if (this.isPlaying) {
            console.warn('Already playing');
            return;
        }

        const readyChunks = this.audioChunks.filter(chunk => chunk.getChunkStatus() === 'ready');
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
    async playNextChunk(callbacks?: AudioAccumulatorCallbacksEntity): Promise<void> {
        if (!this.isPlayingAudio) {
            return;
        }

        // Find next ready chunk
        while (this.currentPlayIndex < this.audioChunks.length) {
            const chunk = this.audioChunks[this.currentPlayIndex];
            
            if (chunk.getChunkStatus() === 'ready') {
                try {
                    console.log(`Playing chunk ${this.currentPlayIndex + 1}/${this.audioChunks.length}`);
                    callbacks?.onPlaybackProgress?.(this.currentPlayIndex + 1, this.audioChunks.length);
                    
                    await this.playChunk(chunk);
                    
                    // Wait for gap between chunks
                    if (this.gapBetweenChunks > 0 && this.isPlayingAudio) {
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
        if (this.isPlayingAudio) {
            console.log('Playback complete');
            this.isPlayingAudio = false;
            callbacks?.onPlaybackComplete?.();
        }
    }

    /**
     * Play a single chunk
     */
    playChunk(chunk: AudioChunkEntity): Promise<void> {
        return new Promise((resolve, reject) => {
            const audio = new Audio(chunk.getChunkAudioUrl());
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
    stop(): void {
        this.isPlayingAudio = false;
        
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
    getChunks(): AudioChunkEntity[] {
        return this.audioChunks;
    }

    /**
     * Get playback status
     */
    isCurrentlyPlaying(): boolean {
        return this.isPlayingAudio;
    }

    /**
     * Clear all chunks
     */
    clear(): void {
        this.stop();
        this.audioChunks = [];
    }

    /**
     * Stop playback (alias for stop method)
     */
    stopPlayback(): void {
        this.stop();
    }

    /**
     * Concatenate multiple audio files into one
     */
    async concatenateAudioFiles(audioUrls: string[]): Promise<string> {
        try {
            if (audioUrls.length === 0) {
                throw new Error("No audio files to concatenate");
            }

            if (audioUrls.length === 1) {
                return audioUrls[0];
            }

            console.log(`Concatenating ${audioUrls.length} audio files`);
            console.log('Audio URLs to concatenate:', audioUrls);

            // Create audio context for concatenation
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const audioBuffers: AudioBuffer[] = [];

            // Load all audio files
            for (const url of audioUrls) {
                try {
                    console.log(`Fetching audio from: ${url}`);
                    const response = await fetch(url);
                    
                    if (!response.ok) {
                        console.error(`HTTP error! status: ${response.status} for URL: ${url}`);
                        continue;
                    }
                    
                    const arrayBuffer = await response.arrayBuffer();
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    audioBuffers.push(audioBuffer);
                    console.log(`Successfully loaded audio from: ${url}`);
                } catch (error) {
                    console.error(`Failed to load audio from ${url}:`, error);
                    // Continue with other files
                }
            }

            if (audioBuffers.length === 0) {
                throw new Error("No valid audio files could be loaded");
            }

            // Calculate total length
            const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
            
            // Create concatenated buffer
            const concatenatedBuffer = audioContext.createBuffer(
                audioBuffers[0].numberOfChannels,
                totalLength,
                audioBuffers[0].sampleRate
            );

            // Copy audio data
            let offset = 0;
            for (const buffer of audioBuffers) {
                for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
                    const sourceData = buffer.getChannelData(channel);
                    const destData = concatenatedBuffer.getChannelData(channel);
                    destData.set(sourceData, offset);
                }
                offset += buffer.length;
            }

            // Convert to WAV and create blob
            const wavBlob = this.audioBufferToWav(concatenatedBuffer);
            const concatenatedUrl = URL.createObjectURL(wavBlob);

            console.log(`Successfully concatenated ${audioBuffers.length} audio files`);
            return concatenatedUrl;

        } catch (error) {
            console.error('Error concatenating audio files:', error);
            throw error;
        }
    }

    /**
     * Convert AudioBuffer to WAV blob
     */
    private audioBufferToWav(buffer: AudioBuffer): Blob {
        const length = buffer.length;
        const numberOfChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
        const view = new DataView(arrayBuffer);

        // WAV header
        const writeString = (offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        const writeUint32 = (offset: number, value: number) => {
            view.setUint32(offset, value, true);
        };

        const writeUint16 = (offset: number, value: number) => {
            view.setUint16(offset, value, true);
        };

        writeString(0, 'RIFF');
        writeUint32(4, 36 + length * numberOfChannels * 2);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        writeUint32(16, 16);
        writeUint16(20, 1);
        writeUint16(22, numberOfChannels);
        writeUint32(24, sampleRate);
        writeUint32(28, sampleRate * numberOfChannels * 2);
        writeUint16(32, numberOfChannels * 2);
        writeUint16(34, 16);
        writeString(36, 'data');
        writeUint32(40, length * numberOfChannels * 2);

        // Convert audio data
        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
                view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                offset += 2;
            }
        }

        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }

    /**
     * Auto-concatenate and upload audio chunks for a slide
     */
    async autoConcatenateAndUploadAudioChunks(slideId: number, audioChunks: AudioChunkEntity[]): Promise<{success: boolean, audioUrl?: string, message: string}> {
        try {
            const readyChunks = audioChunks.filter(chunk => chunk.getChunkStatus() === 'ready');
            
            if (readyChunks.length === 0) {
                const message = `No ready audio chunks for slide ${slideId}`;
                console.log(message);
                return { success: false, message };
            }

            console.log(`Auto-concatenating ${readyChunks.length} audio chunks for slide ${slideId}`);

            // Sort chunks by index to maintain order
            const sortedChunks = readyChunks.sort((a, b) => a.getChunkIndex() - b.getChunkIndex());
            const audioUrls = sortedChunks.map(chunk => chunk.getChunkAudioUrl());

            // Concatenate audio files
            const concatenatedUrl = await this.concatenateAudioFiles(audioUrls);
            
            console.log(`Successfully concatenated audio for slide ${slideId}: ${concatenatedUrl}`);
            return { success: true, audioUrl: concatenatedUrl, message: 'Audio concatenated successfully' };

        } catch (error) {
            const message = `Error auto-concatenating audio for slide ${slideId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(message, error);
            return { success: false, message };
        }
    }

    /**
     * Merge audio files from temp directory and create a single audio file
     * This function specifically handles merging audio files that are stored in temp directory
     */
    async mergeAudioFromTempDirectory(audioUrls: string[], slideId: number): Promise<{success: boolean, audioUrl?: string, message: string}> {
        try {
            if (audioUrls.length === 0) {
                return { success: false, message: 'No audio files to merge' };
            }

            console.log(`Merging ${audioUrls.length} audio files from temp directory for slide ${slideId}`);

            // Filter out invalid URLs
            const validUrls = audioUrls.filter(url => url && url.trim() !== '');
            
            if (validUrls.length === 0) {
                return { success: false, message: 'No valid audio URLs found' };
            }

            // Concatenate audio files
            const mergedUrl = await this.concatenateAudioFiles(validUrls);
            
            console.log(`Successfully merged audio from temp directory for slide ${slideId}: ${mergedUrl}`);
            return { 
                success: true, 
                audioUrl: mergedUrl, 
                message: `Successfully merged ${validUrls.length} audio files from temp directory` 
            };

        } catch (error) {
            const message = `Error merging audio from temp directory for slide ${slideId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(message, error);
            return { success: false, message };
        }
    }

}

export default AudioServices;

