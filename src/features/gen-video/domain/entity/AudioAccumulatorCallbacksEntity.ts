import {AudioChunkEntity} from "./AudioChunkEntity";

interface AudioAccumulatorCallbacksEntity {
    onChunkGenerated?: (chunk: AudioChunkEntity, index: number, total: number) => void;
    onGenerationComplete?: (chunks: AudioChunkEntity[]) => void;
    onPlaybackProgress?: (currentIndex: number, total: number) => void;
    onPlaybackComplete?: () => void;
    onError?: (error: string) => void;
}

export type {AudioAccumulatorCallbacksEntity};