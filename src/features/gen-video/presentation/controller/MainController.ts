import GenAudioServices from "../../domain/service/GenAudioServices";
import {SpeakerEntity} from "../../domain/entity/SpeakerEntity";
import type { AudioPlayerConfig, AudioPlayerCallbacks } from "../../domain/service/AudioPlayerService";
import type { AudioChunk, AudioAccumulatorCallbacks } from "../../domain/service/GenAudioServices";
///mnt/d/DATN-GIA-SU-AI/backend/tts_service

class MainController {
    private audioService: GenAudioServices;

    constructor () {
        this.audioService = new GenAudioServices();
    }

    public validateAudioFile(image:File) : boolean {
        try{
            return this.audioService.validateAudioFile(image);
        }
        catch(error) {
            console.error("Error validating image:", error);
            return false;
        }
    }
    public handleCreateAudioLocalUrl(audioFile: File) : string | null{
        try {
            if (!this.audioService.validateAudioFile(audioFile)) {
                throw new Error("Invalid audio file provided");
            }

            return this.audioService.createAudioLocalUrl(audioFile);


        }
        catch(error) {
            console.error("Error creating audio local url:", error);
            return "";
        }

    }

    public async handleRegisterSpeakerEntity(audioFile: File, SpeakerEntityName: string): Promise<SpeakerEntity | null> {

        try {
            if (!audioFile){
                throw new Error("Invalid audio file provided");
            }
            if (!SpeakerEntityName || !SpeakerEntityName.trim()) {
                throw new Error("SpeakerEntity name is required and cannot be empty");
            }

            console.log("Controller: Validation passed");
            const ans = this.audioService.registerSpeaker(audioFile, SpeakerEntityName);

            if (ans) {
                console.log("Controller: Local SpeakerEntity registration successful");
                
                // Register with backend TTS service
                try {
                    const backendSuccess = await this.audioService.registerSpeakerWithBackend(
                        ans.getId(), 
                        audioFile, 
                        ans.getFixedPromptInput()
                    );
                    
                    if (backendSuccess) {
                        console.log("Controller: Backend SpeakerEntity registration successful");
                    } else {
                        console.warn("Controller: Backend SpeakerEntity registration failed, but local registration succeeded");
                    }
                } catch (backendError) {
                    console.warn("Controller: Backend registration failed:", backendError);
                    // Don't fail the entire registration if backend fails
                }
            }
            else{
                console.error("Controller: SpeakerEntity registration failed");
            }
            return ans;
            
        }
        catch(error) {
            console.error("Controller: SpeakerEntity registration failed:", error);
            console.error("Error details:", {
                message: error instanceof Error ? error.message : 'Unknown error',
                audioFileName: audioFile?.name || 'N/A',
                SpeakerEntityName: SpeakerEntityName || 'N/A'
            });
            return null;        
        }
    }

    public async registerSpeakerEntity(audioFile: File, SpeakerEntityName: string): Promise<{ success: boolean; message: string; SpeakerEntity?: SpeakerEntity }> {
        try {
            const result = await this.handleRegisterSpeakerEntity(audioFile, SpeakerEntityName);
            console.log("Controller: SpeakerEntity registration result:", result);
            if (result) {
                return {
                    success: true,
                    message: `SpeakerEntity "${result.getAudioFileName()}" đã được đăng ký thành công với ID`,
                    SpeakerEntity: result
                };
            } else {
                return {
                    success: false,
                    message: "Đăng ký SpeakerEntity ID thất bại"
                }
            }
        }
        catch(error) {
            console.error("Lỗi đăng kí SpeakerEntity: ", error);
            return {
                success : false,
                message: error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định"
            }
        }

    }

    public handleGetSpeakerEntitys(): SpeakerEntity[] {
        try {
            return this.audioService.getSpeakerList();
        } catch(error) {
            console.error("Failed to get SpeakerEntity list:", error);
            return [];
        }
    }


    public handleGetSpeakerEntityById(SpeakerEntityId: string): SpeakerEntity | null {
        try {
            if (!SpeakerEntityId.trim()) {
                throw new Error("SpeakerEntity Id is required");
            }
            return this.audioService.getSpeakerById(SpeakerEntityId);
        }
        catch(error) {
            console.error("Failed to get SpeakerEntity by id:", error);
            return null;
        }
    }

    public handleDeleteSpeakerEntity(SpeakerEntityId: string): boolean {
        try {
            if (!SpeakerEntityId || !SpeakerEntityId.trim()) {
                throw new Error("SpeakerEntity Id is required");
            }
            return this.audioService.deleteSpeaker(SpeakerEntityId);
        }
        catch(error) {
            console.error("Failed to delete SpeakerEntity:", error);
            return false;
        }
    }

    //Slide validation 

    public validateSlideFile (slideFile: File): boolean {
        try{
            if(!slideFile) {
                console.error("No slide file provided");
                return false;
            }
            
            const validMimeTypes = [
                "application/pdf",
                "application/vnd.ms-powerpoint", // .ppt
                "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
            ];

            const validExtensions = [".pdf", ".ppt", ".pptx"];

            const fileExtension = slideFile.name.toLowerCase().substring(slideFile.name.lastIndexOf('.'));

            const isValidMimeType = validMimeTypes.includes(slideFile.type);
            const isValidExtension = validExtensions.includes(fileExtension);

            if (!isValidMimeType && !isValidExtension) {
                console.error(`Invalid slide file: ${slideFile.name}. Type: ${slideFile.type}, Extension: ${fileExtension}`);
                return false;
            }

            return true;
        
        }
        catch(error) {
            console.error("Failed to validate slide file:", error);
            return false;
        }
    }

    public async handleProcessPDF(slideFile: File): Promise<any[] | null>{
        try {
            const slides = await this.audioService.processPDF(slideFile);
            return slides;
        }
        catch(error) {
            console.error("Failed to process PDF:", error);
            return null;
        }
    }

    public async handleGetPDFInfo(slideFile: File) : Promise<any | null>{
        try {
            const pdfInfo =  await this.audioService.getPDFInfo(slideFile);
            console.log("PDF Info:", pdfInfo);;
            return pdfInfo;
        }
        catch(error) {
            console.error("Failed to get PDF info:", error);
            return null;
        }
    }

    //TTS Voice Generation Methods

    public async handleGenerateVoice(slideId: string, text: string, speakerId: string, options?: {
        speed?: number;
        gap?: number;
    }): Promise<{ success: boolean; message: string; audioUrl?: string }> {
        try {
            if (!text.trim()) {
                return {
                    success: false,
                    message: "Vui lòng nhập nội dung để tạo giọng nói"
                };
            }

            if (!speakerId || speakerId === 'default') {
                return {
                    success: false,
                    message: "Vui lòng chọn speaker để tạo giọng nói"
                };
            }

            console.log(`Controller: Generating voice for slide ${slideId}`);
            const audioUrl = await this.audioService.generateVoiceForSlide(slideId, text, speakerId, options);
            
            return {
                success: true,
                message: "Tạo giọng nói thành công",
                audioUrl: audioUrl
            };

        } catch (error) {
            console.error("Controller: Voice generation failed:", error);
            return {
                success: false,
                message: error instanceof Error ? error.message : "Có lỗi xảy ra khi tạo giọng nói"
            };
        }
    }

    public async handleSynthesizeText(text: string, speakerId: string, options?: {
        speed?: number;
        gap?: number;
    }): Promise<{ success: boolean; message: string; audioUrl?: string }> {
        try {
            if (!text.trim()) {
                return {
                    success: false,
                    message: "Vui lòng nhập nội dung để tổng hợp"
                };
            }

            if (!speakerId || speakerId === 'default') {
                return {
                    success: false,
                    message: "Vui lòng chọn speaker để tổng hợp"
                };
            }

            console.log(`Controller: Synthesizing text with speaker ${speakerId}`);
            const audioUrl = await this.audioService.synthesizeText(text, speakerId, options);
            
            return {
                success: true,
                message: "Tổng hợp giọng nói thành công",
                audioUrl: audioUrl
            };

        } catch (error) {
            console.error("Controller: Text synthesis failed:", error);
            return {
                success: false,
                message: error instanceof Error ? error.message : "Có lỗi xảy ra khi tổng hợp giọng nói"
            };
        }
    }

    public async handleSynthesizeTextStreaming(text: string, speakerId: string, options?: {
        speed?: number;
        gap?: number;
        chunkSize?: number;
        onProgress?: (chunk: number, total: number) => void;
        onChunkReady?: (audioUrl: string, chunk: number) => void;
    }): Promise<{ success: boolean; message: string; audioUrls?: string[] }> {
        try {
            if (!text.trim()) {
                return {
                    success: false,
                    message: "Vui lòng nhập nội dung để tổng hợp streaming"
                };
            }

            if (!speakerId || speakerId === 'default') {
                return {
                    success: false,
                    message: "Vui lòng chọn speaker để tổng hợp streaming"
                };
            }

            console.log(`Controller: Starting streaming synthesis with speaker ${speakerId}`);
            const audioUrls = await this.audioService.synthesizeTextStreaming(text, speakerId, options);
            
            return {
                success: true,
                message: `Tổng hợp streaming thành công: ${audioUrls.length} chunks`,
                audioUrls: audioUrls
            };

        } catch (error) {
            console.error("Controller: Streaming synthesis failed:", error);
            return {
                success: false,
                message: error instanceof Error ? error.message : "Có lỗi xảy ra khi tổng hợp streaming"
            };
        }
    }

    // Advanced Audio Player Methods

    /**
     * Play text with advanced audio player (chunking, prefetching, smooth playback)
     */
    public async handlePlayTextAdvanced(
        text: string,
        speakerId: string,
        config?: AudioPlayerConfig,
        callbacks?: AudioPlayerCallbacks
    ): Promise<{ success: boolean; message: string }> {
        try {
            if (!text.trim()) {
                return {
                    success: false,
                    message: "Vui lòng nhập nội dung để phát"
                };
            }

            if (!speakerId || speakerId === 'default') {
                return {
                    success: false,
                    message: "Vui lòng chọn speaker để phát"
                };
            }

            console.log(`Controller: Starting advanced audio playback with speaker ${speakerId}`);
            await this.audioService.playTextWithAdvancedPlayer(text, speakerId, config, callbacks);
            
            return {
                success: true,
                message: "Đã bắt đầu phát audio"
            };

        } catch (error) {
            console.error("Controller: Advanced audio playback failed:", error);
            return {
                success: false,
                message: error instanceof Error ? error.message : "Có lỗi xảy ra khi phát audio"
            };
        }
    }

    /**
     * Stop audio playback
     */
    public handleStopAudio(): void {
        this.audioService.stopAudioPlayback();
    }

    /**
     * Pause audio playback
     */
    public handlePauseAudio(): void {
        this.audioService.pauseAudioPlayback();
    }

    /**
     * Check if audio is playing
     */
    public handleIsAudioPlaying(): boolean {
        return this.audioService.isAudioPlaying();
    }

    /**
     * Get audio playback progress
     */
    public handleGetAudioProgress(): { current: number; total: number } {
        return this.audioService.getAudioProgress();
    }

    // Audio Accumulator Methods (Batch Generation + Sequential Playback)

    /**
     * Generate all audio chunks (batch generation)
     */
    public async handleGenerateAudioChunks(
        text: string,
        speakerId: string,
        callbacks?: AudioAccumulatorCallbacks
    ): Promise<{ success: boolean; message: string; chunks?: AudioChunk[] }> {
        try {
            if (!text.trim()) {
                return {
                    success: false,
                    message: "Vui lòng nhập nội dung để tạo audio"
                };
            }

            if (!speakerId || speakerId === 'default') {
                return {
                    success: false,
                    message: "Vui lòng chọn speaker để tạo audio"
                };
            }

            console.log(`Controller: Starting batch audio generation with speaker ${speakerId}`);
            const chunks = await this.audioService.generateAudioChunks(text, speakerId, callbacks);
            
            return {
                success: true,
                message: `Đã tạo ${chunks.length} audio chunks`,
                chunks: chunks
            };

        } catch (error) {
            console.error("Controller: Audio chunk generation failed:", error);
            return {
                success: false,
                message: error instanceof Error ? error.message : "Có lỗi xảy ra khi tạo audio"
            };
        }
    }

    /**
     * Play all accumulated audio chunks
     */
    public async handlePlayAccumulatedAudio(
        speed: number = 1.0,
        gap: number = 0.05,
        callbacks?: AudioAccumulatorCallbacks
    ): Promise<{ success: boolean; message: string }> {
        try {
            console.log(`Controller: Starting accumulated audio playback`);
            await this.audioService.playAccumulatedAudio(speed, gap, callbacks);
            
            return {
                success: true,
                message: "Đã bắt đầu phát audio"
            };

        } catch (error) {
            console.error("Controller: Audio playback failed:", error);
            return {
                success: false,
                message: error instanceof Error ? error.message : "Có lỗi xảy ra khi phát audio"
            };
        }
    }

    /**
     * Stop accumulated audio playback
     */
    public handleStopAccumulatedAudio(): void {
        this.audioService.stopAccumulatedAudio();
    }

    /**
     * Get generated audio chunks
     */
    public handleGetAudioChunks(): AudioChunk[] {
        return this.audioService.getAudioChunks();
    }

    /**
     * Check if accumulated audio is playing
     */
    public handleIsAccumulatedAudioPlaying(): boolean {
        return this.audioService.isAccumulatedAudioPlaying();
    }

    /**
     * Clear all audio chunks
     */
    public handleClearAudioChunks(): void {
        this.audioService.clearAudioChunks();
    }
}

export default MainController;