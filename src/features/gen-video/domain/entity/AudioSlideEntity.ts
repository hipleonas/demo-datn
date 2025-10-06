// class AudioSlideEntity {
//     id: number;
//     text: string | null;
//     audioUrl: string | null;
//     imageUrl: string | null;

//     constructor(id: number, text: string | null, audioUrl: string | null, imageUrl: string | null) {
//         this.id = id;
//         this.text = text;
//         this.audioUrl = audioUrl;
//         this.imageUrl = imageUrl;
//     }

//     getId(): number {
//         return this.id;
//     }

//     getText(): string | null {
//         return this.text;
//     }

//     getAudioUrl(): string | null {
//         return this.audioUrl;
//     }

//     getImageUrl(): string | null {
//         return this.imageUrl;
//     }

//     setId(id: number): void {
//         this.id = id;
//     }

//     setText(text: string): void {
//         this.text = text;
//     }

//     setAudioUrl(audioUrl: string): void {
//         this.audioUrl = audioUrl;
//     }

//     setImageUrl(imageUrl: string): void {
//         this.imageUrl = imageUrl;
//     }




import { AudioChunkEntity } from "./AudioChunkEntity";
class AudioSlideEntity {
    id: number;
    slideNumber: number;
    imageUrl: string | null;
    inputText: string | null;
    audioUrl: string | null;
    normalAudioUrl: string | null;
    isGenerating: boolean;
    //TTS audio url

    //@New state: Chunking state

    audioStatus: string;
    // audioChunks: any[];
    audioChunks: AudioChunkEntity[];

    generationProgress: {current: number, total: number};
    isAudioPlaying: boolean;
    playbackProgress: {current: number, total: number};
    playbackSpeed: number;
    playbackGap: number;

    //@New state: TTS state
    /*
    Trong mỗi state audio id ta cần cung cấp những gì
    AudioAccumulator: 
    */

    constructor(
        id: number, 
        slideNumber: number, 
        imageUrl: string | null = null, 
        inputText: string | null = '', 
        audioUrl: string | null = null, //This is tts audio url
        normalAudioUrl: string | null = null,
        
        isGenerating: boolean = false,

        //@New state: Chunking state
        audioStatus: string = '',
        // audioChunks: any[] = [],
        audioChunks: AudioChunkEntity[] = [],
        generationProgress: {current: number, total: number} = {current: 0, total: 0},
        isAudioPlaying: boolean = false,
        playbackProgress: {current: number, total: number} = {current: 0, total: 0},
        playbackSpeed: number = 1.0,
        playbackGap: number = 0.05,

    ) {
        this.id = id;
        this.slideNumber = slideNumber;
        this.imageUrl = imageUrl;
        this.inputText = inputText;
        this.audioUrl = audioUrl;
        this.normalAudioUrl = normalAudioUrl;
        this.isGenerating = isGenerating;

        //@New state: Chunking state
        this.audioStatus = audioStatus;
        // this.audioChunks = audioChunks;
        this.audioChunks = audioChunks;
        this.generationProgress = generationProgress;
        this.isAudioPlaying = isAudioPlaying;
        this.playbackProgress = playbackProgress;
        this.playbackSpeed = playbackSpeed;
        this.playbackGap = playbackGap;
            
    }

    // Getters
    getId(): number {
        return this.id;
    }

    getSlideNumber(): number {
        return this.slideNumber;
    }

    getImageUrl(): string | null {
        return this.imageUrl;
    }

    getInputText(): string | null {
        return this.inputText;
    }

    getAudioUrl(): string | null {
        return this.audioUrl;
    }

    getNormalAudioUrl(): string | null {
        return this.normalAudioUrl;
    }

    getIsGenerating(): boolean {
        return this.isGenerating;
    }

    //@Chunking getter methods
    getAudioStatus(): string {
        return this.audioStatus
    }

    // getAudioChunks(): any[] {
    //     return this.audioChunks;
    // }
    getAudioChunks(): AudioChunkEntity[] {
        return this.audioChunks;
    }

    getGenerationProgress(): {current: number, total: number} {
        return this.generationProgress;
    }

    getIsAudioPlaying() : boolean {
        return this.isAudioPlaying;
    }

    getPlaybackProgress(): {current: number, total: number} {
        return this.playbackProgress;
    }

    getPlaybackSpeed(): number {
        return this.playbackSpeed;
    }

    getPlaybackGap(): number {
        return this.playbackGap;
    }



    // Setters
    setId(id: number): void {
        this.id = id;
    }

    setSlideNumber(slideNumber: number): void {
        this.slideNumber = slideNumber;
    }

    setImageUrl(imageUrl: string): void {
        this.imageUrl = imageUrl;
    }

    setInputText(inputText: string): void {
        this.inputText = inputText;
    }

    setAudioUrl(audioUrl: string | null): void {
        this.audioUrl = audioUrl;
    }

    setNormalAudioUrl(normalAudioUrl: string | null): void {
        this.normalAudioUrl = normalAudioUrl;
    }

    setIsGenerating(isGenerating: boolean): void {
        this.isGenerating = isGenerating;
    }

    //@Chunking setter methods

    setAudioStatus(audioStatus: string): void {
        this.audioStatus = audioStatus;
    }
    
    // setAudioChunks(audioChunks:any[] | ((prevChunks: any[]) => any[])) : void {
    //     if (typeof audioChunks === "function"){
    //         this.audioChunks = audioChunks(this.audioChunks);
    //     }else{
    //         this.audioChunks = audioChunks;
    //     }
    //     // this.audioChunks = audioChunks;
    // }
    setAudioChunks = (chunks: AudioChunkEntity[] | ((prev: AudioChunkEntity[]) => AudioChunkEntity[])): void => {
        if (typeof chunks === 'function') {
            this.audioChunks = chunks(this.audioChunks);
        } else {
            this.audioChunks = chunks;
        }
    };

    setGenerationProgress(generationProgress: {current: number, total: number}): void {
        this.generationProgress = generationProgress;
    }

    setIsAudioPlaying(isAudioPlaying: boolean): void {
        this.isAudioPlaying = isAudioPlaying;
    }

    setPlaybackProgress(playbackProgress: {current:number, total: number}) : void {
        this.playbackProgress = playbackProgress;
    }

    setPlaybackSpeed(playbackSpeed: number): void {
        this.playbackSpeed = playbackSpeed;
    }
    
    setPlaybackGap(playbackGap: number): void {
        this.playbackGap = playbackGap;
    }

}


export { AudioSlideEntity };