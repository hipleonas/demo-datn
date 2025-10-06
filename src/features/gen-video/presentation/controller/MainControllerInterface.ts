import type { AudioSlideEntity } from "../../domain/entity/AudioSlideEntity";
import type { SpeakerEntity } from "../../domain/entity/SpeakerEntity";
import type { AudioChunkEntity } from "../../domain/entity/AudioChunkEntity";
import type { AudioAccumulatorCallbacksEntity } from "../../domain/entity/AudioAccumulatorCallbacksEntity";

import type { UploadState } from "../model/UploadState";

interface MainControllerInterface {
    //1. NON-SERVICE METHODS
    //1.1 Handle Upload Files
    handleReferenceImageUpload(imageFile: File | null): UploadState;
    handleReferenceVoiceUpload(audioFile: File | null): UploadState;
    handleSlideUpload(slideFile: File | null): UploadState;
    extractUploadedSlides(slideFile: File | null): Promise<AudioSlideEntity[]>;
    //1.2 Handle Validate Files Extension
    handleValidateImageFile(imageFile: File| null) : boolean;
    handleValidateAudioFile(audioFile: File| null) : boolean;
    handleValidateSlideFile(slideFile: File| null) : boolean;
    handleCreateAudioLocalUrl(audioFile:File): string | null;
    
    // handleGetSpeakerList?(): SpeakerEntity[];
    // handleGetSpeakerById?(SpeakerId: string) : SpeakerEntity | null;


    //2. SERVICE METHODS
    generateVoiceForSlide(text: String, speakerId: string): void;
    handleGenerateVideo(referenceImage: File, slides: AudioSlideEntity[]) : void;
    
    /*@New method: Speaker registration*/
    handleRegisterSpeaker(audioFile: File, SpeakerEntityName: string): Promise<{ success: boolean; message: string; SpeakerEntity?: SpeakerEntity }>;
    handleGetSpeakerList(): SpeakerEntity[];

    /*@New method: handle Generated Audio Chunks */
    handleGeneratedAudioChunks(text: string,speakerId: string, callbacks?: AudioAccumulatorCallbacksEntity) : Promise<{success: boolean, message : string; chunks ? : AudioChunkEntity[]}> ;

    /*@New method: Auto-concatenate and upload audio */
    handleAutoConcatenateAndUploadAudio(slideId: number, audioChunks: AudioChunkEntity[]): Promise<{success: boolean, message: string, audioUrl?: string}>;

    /*@New method: Merge audio from temp directory */
    handleMergeAudioFromTempDirectory(slideId: number, audioUrls: string[]): Promise<{success: boolean, message: string, audioUrl?: string}>;


}

export type {MainControllerInterface};

