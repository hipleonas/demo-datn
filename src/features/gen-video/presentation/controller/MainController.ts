// INTERNAL MODULES
import AudioServices from "../../domain/service/AudioServices";
import type { MainControllerInterface } from "./MainControllerInterface";
import {AudioSlideEntity} from "../../domain/entity/AudioSlideEntity";
import type { UploadState } from "../model/UploadState";

// EXTERNAL MODULES
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min?url";
import type { SpeakerEntity } from "../../domain/entity/SpeakerEntity";
import type { AudioChunkEntity } from "../../domain/entity/AudioChunkEntity";
import type { AudioAccumulatorCallbacksEntity } from "../../domain/entity/AudioAccumulatorCallbacksEntity";

// 👇 bắt buộc: trỏ workerSrc về file worker cục bộ
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;


/*
MainController Implementation

This class implements MainControllerInterface to provide concrete implementation
for file upload handling and validation logic. The interface ensures consistency
and enables easy testing and future extensibility.

*/
class MainController implements MainControllerInterface {
    /* handleImageUpload(imageFile: File): string {
        // Logic to handle image upload
        console.log("Handling image upload:", imageFile.name);
        // In a real implementation, this would upload to a service
        return URL.createObjectURL(imageFile);
    } */
    audioService: AudioServices;

    constructor() {
        // Initialize AudioServices with a mock repository for now
        // In a real implementation, you would inject the actual repository
        this.audioService = new AudioServices({
            generateVideo: async (_audioFile: File, _slides: AudioSlideEntity[]) => {
                console.log("Mock repository: generateVideo called");
            },
            validateAudioFile: (_audioFile: File) => {
                return true; // Mock validation
            },
            handleRegisterSpeaker: async (_audioFile: File, _speakerName: string) => {
                return { success: false, message: "Mock repository method" };
            },
            createAudioLocalUrl: (audioFile: File) => {
                return URL.createObjectURL(audioFile);
            },
            loadSpeakersFromStorage: () => {
                return [];
            },
            saveSpeakersToStorage: (_speakers: SpeakerEntity[]) => {
                console.log("Mock repository: saveSpeakersToStorage called");
            },
            getSpeakerList: () => {
                return [];
            },
            stopPlayback: () => {
                console.log("Mock repository: stopPlayback called");
            },
            clear: () => {
                console.log("Mock repository: clear called");
            }
        });

        
    }

    

    
    handleReferenceImageUpload(imageFile: File | null): UploadState {
        if (!imageFile) {
            throw new Error("No image file selected");
        }

        // Start validate image file
        let isValidExtension: boolean = true;

        const maxSizeInMB = 10; // 10MB limit
        const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
        
        if (imageFile.size > maxSizeInBytes) {
            isValidExtension = false;
        }

        const allowedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        isValidExtension = allowedFormats.includes(imageFile.type);
        // End validate image file

        if (!isValidExtension) {
            return {
                fileObj: null,
                preview: null,
                validExtension: false,
                error: 'Định dạng file âm thanh không hợp lệ. Chỉ chấp nhận MP3, WAV, M4A, OGG, WEBM'
            };
        }

        return {
            fileObj: imageFile,
            preview: URL.createObjectURL(imageFile),
            validExtension: true,
            error: null
        };
    }


    /* handleRAudioUpload(audioFile: File): string {
        // Logic to handle voice registration audio upload
        console.log("Handling audio upload:", audioFile.name);
        // In a real implementation, this would process the audio for speaker ID
        return URL.createObjectURL(audioFile);
    } */
    handleReferenceVoiceUpload(audioFile: File | null): UploadState {
        if (!audioFile) {
            throw new Error("No voice file selected");
        }

        // Start validate audio file
        let isValidExtension: boolean = true;

        const maxSizeInMB = 20; 
        const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
        
        if (audioFile.size > maxSizeInBytes) {
            isValidExtension = false;
        }

        const allowedFormats = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/webm'];
        isValidExtension = allowedFormats.includes(audioFile.type);
        // End validate audio file

        if (!isValidExtension) {
            return {
                fileObj: null,
                preview: null,
                validExtension: false,
                error: 'Định dạng file âm thanh không hợp lệ. Chỉ chấp nhận MP3, WAV, M4A, OGG, WEBM'
            };
        }

        return {
            fileObj: audioFile,
            preview: URL.createObjectURL(audioFile),
            validExtension: true,
            error: null
        };
    }


    handleSlideUpload(slideFile: File | null): UploadState {
        if (!slideFile) {
            throw new Error("No slide file selected");
        }

        let isValidExtension : boolean = true;
        
        // Start validate slide file
        const maxsizeInMB = 20;
        const maxSizeInBytes = maxsizeInMB * 1024 * 1024;
        if (slideFile.size > maxSizeInBytes) {
            isValidExtension = false;
        }

        const allowedFormats = [
            'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
            'application/vnd.ms-powerpoint', // .ppt
            'application/pdf' // .pdf
        ];
        
        // Also check file extension as fallback
        const fileName = slideFile.name.toLowerCase();
        const hasValidExtension = fileName.endsWith('.pptx') || fileName.endsWith('.ppt') || fileName.endsWith('.pdf');

        isValidExtension = (allowedFormats.includes(slideFile.type) || hasValidExtension);

        // End validate slide file

        if (!isValidExtension) {
            return {
                fileObj: null,
                preview: null,
                validExtension: false,
                error: 'Định dạng file không hợp lệ. Chỉ chấp nhận .pptx, .ppt, .pdf'
            };
        }

        return{
            fileObj: slideFile,
            preview: null,
            validExtension: true,
            error: null
        };
    }

    async extractUploadedSlides(slideFile: File | null): Promise<AudioSlideEntity[]> {
        if (!slideFile) {
            throw new Error("No slide file selected");
        }

        const arrayBuffer = await slideFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        const extractedSlides: AudioSlideEntity[] = [];
        for (let i = 0; i < pdf.numPages; i++) {
            const slide = await pdf.getPage(i + 1);

            // viewport để render
            const viewport = slide.getViewport({ scale: 1.5 });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d")!;
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            // render page ra canvas
            await slide.render({ canvasContext: context, viewport, canvas }).promise;

            // convert canvas -> blob
            const blob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, "image/png")
            );

            let previewUrl: string = "";
            if (blob) {
                previewUrl = URL.createObjectURL(blob); // object URL để hiển thị
            }

            const slideEntity = new AudioSlideEntity(
                (i+1),                          // ID
                (i+1),                          // Slide number
                previewUrl,                     // Image url
                '',                             // Input text
                null,
                null,
                false                           // Is generating
            );
            extractedSlides.push(slideEntity);
        }
        return extractedSlides;
    }

    
    handleValidateImageFile(imageFile: File | null): boolean {
        if (!imageFile) {
            throw new Error("No image file selected");
        }
        const maxSizeInMB = 10;
        const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
        if (imageFile.size > maxSizeInBytes) {
            return false;
        }
        const allowedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        return allowedFormats.includes(imageFile.type);
    }

    handleValidateAudioFile(audioFile: File | null): boolean {
        if (!audioFile) {
            throw new Error("No audio file selected");
        }
        const maxSizeInMB = 20;
        const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
        if (audioFile.size > maxSizeInBytes) {
            return false;
        }
        const allowedFormats = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/webm'];
        return allowedFormats.includes(audioFile.type);
    }

    handleValidateSlideFile(slideFile: File | null): boolean {
        if (!slideFile) {
            throw new Error("No slide file selected");
        }
        const maxsizeInMB = 20;
        const maxSizeInBytes = maxsizeInMB * 1024 * 1024;
        if (slideFile.size > maxSizeInBytes) {
            return false;
        }
        const allowedFormats = [
            'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
            'application/vnd.ms-powerpoint', // .ppt
            'application/pdf' // .pdf
        ];
        const fileName = slideFile.name.toLowerCase();
        const hasValidExtension = fileName.endsWith('.pptx') || fileName.endsWith('.ppt') || fileName.endsWith('.pdf');
        return allowedFormats.includes(slideFile.type) || hasValidExtension;
    }

    //@New method : create Local url for audio file
    handleCreateAudioLocalUrl(audioFile: File ): string | null {
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


    generateVoiceForSlide(text: String, speakerId: string): void {
        // Call TTS-AI-SERVICE to generate voice for the slide
        console.log("Generating voice for text:", text, "with speaker ID:", speakerId); // Delete when code is implemented
        return; 
    }

    handleGenerateVideo(referenceImage: File, slides: AudioSlideEntity[]) : void {
        // Call VIDEO-GENERATION-SERVICE to generate video
        console.log("Generating video with reference image and slides:", referenceImage.name, slides); // Delete when code is implemented
        
        return; 
    }

    /*@New method implementation@*/
    public async handleRegisterSpeaker(audioFile: File, speakerName: string): Promise<{ success: boolean; message: string; SpeakerEntity?: SpeakerEntity }> {
    
        try {
            if (!audioFile) {
                return {
                    success: false,
                    message: "Audio file is required",
                };
            }

            if (!speakerName || !speakerName.trim()) {
                return {
                    success: false,
                    message: "Speaker name is required"
                };
            }

            console.log('Gọi Audio Service');
            const result = await this.audioService.handleRegisterSpeaker(audioFile, speakerName);

            return result;
        
        }
        catch(error){
            console.error("Failed to register speaker: ", error);
            return {
                success: false,
                message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi đăng ký Speaker ID"
            }
        }
    }

    handleGetSpeakerList() : SpeakerEntity[] {
        return this.audioService.getSpeakerList();
    }

    //TTS Service method

    async handleGeneratedAudioChunks(text: string, speakerId: string, callbacks?: AudioAccumulatorCallbacksEntity): Promise<{success: boolean, message: string; chunks?: AudioChunkEntity[]}> {
        try {
            const chunks = await this.audioService.generateAllChunks(text, speakerId, callbacks);
            return {
                success: true,
                message: "Audio chunks generated successfully",
                chunks: chunks
            };
        }
        catch(error) {
            console.error("Failed to generate audio chunks:", error);
            return {
                success: false,
                message: error instanceof Error ? error.message : "Failed to generate audio chunks"
            };
        }
    }

    /**
     * Auto-concatenate audio chunks and upload to slide
     */
    async handleAutoConcatenateAndUploadAudio(slideId: number, audioChunks: AudioChunkEntity[]): Promise<{success: boolean, message: string, audioUrl?: string}> {
        try {
            console.log(`Auto-concatenating audio for slide ${slideId} with ${audioChunks.length} chunks`);
            
            const result = await this.audioService.autoConcatenateAndUploadAudioChunks(slideId, audioChunks);
            
            return {
                success: result.success,
                message: result.message,
                audioUrl: result.audioUrl
            };
        } catch (error) {
            console.error(`Failed to auto-concatenate audio for slide ${slideId}:`, error);
            return {
                success: false,
                message: error instanceof Error ? error.message : "Failed to concatenate audio chunks"
            };
        }
    }

    /**
     * Merge audio files from temp directory
     */
    async handleMergeAudioFromTempDirectory(slideId: number, audioUrls: string[]): Promise<{success: boolean, message: string, audioUrl?: string}> {
        try {
            console.log(`Merging audio from temp directory for slide ${slideId} with ${audioUrls.length} URLs`);
            
            const result = await this.audioService.mergeAudioFromTempDirectory(audioUrls, slideId);
            
            return {
                success: result.success,
                message: result.message,
                audioUrl: result.audioUrl
            };
        } catch (error) {
            console.error(`Failed to merge audio from temp directory for slide ${slideId}:`, error);
            return {
                success: false,
                message: error instanceof Error ? error.message : "Failed to merge audio from temp directory"
            };
        }
    }


    
}

export default MainController;

