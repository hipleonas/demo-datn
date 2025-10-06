import type { SpeakerEntity } from "../entity/SpeakerEntity";
import type { AudioChunkEntity } from "../entity/AudioChunkEntity";
import type { AudioAccumulatorCallbacksEntity } from "../entity/AudioAccumulatorCallbacksEntity";
interface GenVideoRepositoryInterface {
    //Video related methods
    generateVideo(referenceImage: File, slides: any[]): Promise<void>;
    

    //Audio methods
    validateAudioFile(audioFile: File): boolean;
    handleRegisterSpeaker(
        audioFile: File, 
        speakerName: string
    ): Promise<{ success: boolean; message: string; SpeakerEntity?: SpeakerEntity }>;
    createAudioLocalUrl(audioFile: File): string;
    loadSpeakersFromStorage(): SpeakerEntity[];
    saveSpeakersToStorage(speakers: SpeakerEntity[]): void;
    getSpeakerList(): SpeakerEntity[];

    //Repository which define all of the methods that will be used in the folder feature

    //@Audio Accumulatro methods

    splitTextIntoChunks?(fullText: string, chunkSize: number): string[];
    generateChunk?(text: string, speakerId: string): Promise<string>;
    generateAllChunks?(fullText: string, speakerId: string, callbacks?: AudioAccumulatorCallbacksEntity): Promise<AudioChunkEntity[]>;
    playAllChunks?(speed: number, gap: number, callbacks?: AudioAccumulatorCallbacksEntity): Promise<void>;
    playNextChunk?(callbacks?: AudioAccumulatorCallbacksEntity):Promise<void>;
    playChunk?(chunk:AudioChunkEntity): Promise<void>;
    stopPlayback():void;//<=> stop();
    clear(): void;// <=> Clear() all chunks;

    //Preprocess methods

    







    


    







}

export type { GenVideoRepositoryInterface };
