import type { GenVideoRepositoryInterface } from "../../domain/repository/GenVideoRepositoryInterface";
import type { AudioSlideEntity } from "../../domain/entity/AudioSlideEntity";
import type EchomimicV2API from "../datasource/api/EchomimicV2API";
import type OcrApi from "../datasource/api/OcrApi";

//import type ZipVoiceAPI from "../datasource/api/ZipVoiceAPI";


class GenVideoRepositoryImpl implements GenVideoRepositoryInterface {
    
    private echomimicApi : EchomimicV2API;
    private ocrApi : OcrApi;
    // private zipVoiceAPI: ZipVoiceAPI;

    constructor(echomimicApi: EchomimicV2API, ocrApi: OcrApi) {
        this.echomimicApi = echomimicApi;
        this.ocrApi = ocrApi;
        // this.zipVoiceAPI = zipVoiceAPI;
    }

    async generateVideo(referenceImage: File, slides: AudioSlideEntity[]): Promise<void> {
        // Implement the actual video generation logic here, e.g., call an API or use a library
        console.log("GenVideoRepositoryImpl: Generating video with reference image and slides:", referenceImage.name, slides);
        
        // Create Lip-sync video using referenceImage and audio
        await this.echomimicApi.generateVideo(referenceImage, slides[0].audioUrl ? slides[0].audioUrl : ""); // Assuming using the first slide's audio for demo


        // Create Clickable video using slide images
        const slideUrls = slides.map(slide => slide.imageUrl ? slide.imageUrl : ""); 
        await this.ocrApi.createClickableObject(slideUrls); 

        return new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // // Audio methods implementation
    // validateAudioFile(audioFile: File): boolean {
    //     if (!audioFile) {
    //         throw new Error("No audio file provided");
    //     }
    //     const validTypes = ["audio/mpeg", "audio/wav", "audio/mp3", "audio/m4a", "audio/ogg", "audio/webm"];
    //     return validTypes.includes(audioFile.type);
    // }

    // async handleRegisterSpeaker(
    //     audioFile: File, 
    //     speakerName: string
    // ): Promise<{ success: boolean; message: string; SpeakerEntity?: SpeakerEntity }> {
    //     // This would typically delegate to a service layer
    //     throw new Error("Method not implemented in repository layer");
    // }

    // createAudioLocalUrl(audioFile: File): string {
    //     if (!audioFile) {
    //         throw new Error("No audio file provided");
    //     }
    //     if (!this.validateAudioFile(audioFile)) {
    //         throw new Error("Invalid audio file");
    //     }
    //     return URL.createObjectURL(audioFile);
    // }

    // loadSpeakersFromStorage(): SpeakerEntity[] {
    //     // This would typically delegate to a service layer
    //     throw new Error("Method not implemented in repository layer");
    // }

    // saveSpeakersToStorage(speakers: SpeakerEntity[]): void {
    //     // This would typically delegate to a service layer
    //     throw new Error("Method not implemented in repository layer");
    // }

    // getSpeakerList(): SpeakerEntity[] {
    //     // This would typically delegate to a service layer
    //     throw new Error("Method not implemented in repository layer");
    // }

    // // Audio Accumulator methods - these would typically delegate to service layer
    // splitTextIntoChunks?(fullText: string, chunkSize: number): string[] {
    //     throw new Error("Method not implemented in repository layer");
    // }

    // generateChunk?(text: string, speakerId: string): Promise<string> {
    //     throw new Error("Method not implemented in repository layer");
    // }

    // generateAllChunks?(fullText: string, speakerId: string, callbacks?: AudioAccumulatorCallbacksEntity): Promise<AudioChunkEntity[]> {
    //     throw new Error("Method not implemented in repository layer");
    // }

    // playAllChunks?(speed: number, gap: number, callbacks?: AudioAccumulatorCallbacksEntity): Promise<void> {
    //     throw new Error("Method not implemented in repository layer");
    // }

    // playNextChunk?(callbacks?: AudioAccumulatorCallbacksEntity): Promise<void> {
    //     throw new Error("Method not implemented in repository layer");
    // }

    // playChunk?(chunk: AudioChunkEntity): Promise<void> {
    //     throw new Error("Method not implemented in repository layer");
    // }

    // stopPlayback(): void {
    //     throw new Error("Method not implemented in repository layer");
    // }

    // clear(): void {
    //     throw new Error("Method not implemented in repository layer");
    // }

}

export { GenVideoRepositoryImpl };