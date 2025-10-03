class SlideEntity {
    id : string ;
    slideNumber : number ;
    imageUrl : string ;
    generatedText : string ;
    speakerId: string ;
    audioUrl : string ;
    isGenerating: boolean;

    //Add new fields for audio chunks and generation progress 
    audioStatus: string;
    audioChunks: any[];
    generationProgress: {current: number, total: number};
    isAudioPlaying: boolean;
    playbackProgress: {current: number, total: number};
    playbackSpeed: number;
    playbackGap: number;
    // ==================================


    constructor (
        id : string,
        slideNumber: number, 
        imageUrl: string, 
        generatedText: string = '', 
        speakerId: string = '', 
        audioUrl: string = '',
        isGenerating: boolean = false,
        //Add new fields for audio chunks and generation progress 
        audioStatus: string = '',
        audioChunks: any[] = [],
        generationProgress: {current: number, total: number} = {current: 0, total: 0},
        isAudioPlaying: boolean = false,
        playbackProgress: {current: number, total: number} = {current: 0, total: 0},
        playbackSpeed: number = 1.0,
        playbackGap: number = 0.05,
        // ==================================
    ) {
        this.id = id;
        this.slideNumber = slideNumber;
        this.imageUrl = imageUrl;
        this.generatedText = generatedText;
        this.speakerId = speakerId;
        this.audioUrl = audioUrl;
        this.isGenerating = isGenerating;

        //Add new fields for audio chunks and generation progress 
        this.audioStatus = audioStatus;
        this.audioChunks = audioChunks;
        this.generationProgress = generationProgress;
        this.isAudioPlaying = isAudioPlaying;
        this.playbackProgress = playbackProgress;
        this.playbackSpeed = playbackSpeed;
        this.playbackGap = playbackGap;

        // ==================================

    }

    getId(): string {
        return this.id;
    }

    getSlideNumber(): number   {
        return this.slideNumber;
    }

    getImageUrl(): string  {
        return this.imageUrl;
    }

    getInputText(): string   {
        return this.generatedText;
    }

    getSpeakerId(): string   {
        return this.speakerId;
    }

    getAudioUrl(): string   {
        return this.audioUrl;
    }

    getIsGenerating(): boolean {
        return this.isGenerating;
    }

    getAudioStatus(): string {
        return this.audioStatus;
    }

    getAudioChunks(): any[] {
        return this.audioChunks;
    }

    getGenerationProgress(): {current: number, total: number} {
        return this.generationProgress;
    }

    getIsAudioPlaying(): boolean {
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
    setId(id: string): void {
        this.id = id;
    }

    setSlideNumber(slideNumber: number): void {
        this.slideNumber = slideNumber;
    }

    setImageUrl(imageUrl: string): void {
        this.imageUrl = imageUrl;
    }

    setInputText(inputText: string): void {
        this.generatedText = inputText;
    }

    setSpeakerId(speakerId: string): void {
        this.speakerId = speakerId;
    }

    setAudioUrl(audioUrl: string  ): void {
        this.audioUrl = audioUrl;
    }

    setIsGenerating(isGenerating: boolean): void {
        this.isGenerating = isGenerating;
    }

    setAudioStatus(audioStatus: string): void {
        this.audioStatus = audioStatus;
    }
    
    setAudioChunks(audioChunks:any[] | ((prevChunks: any[]) => any[])) : void {
        if (typeof audioChunks === "function"){
            this.audioChunks = audioChunks(this.audioChunks);
        }else{
            this.audioChunks = audioChunks;
        }
        // this.audioChunks = audioChunks;
    }

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
    //const [playbackProgress, setPlaybackProgress] = useState<{current: number, total: number}>({current: 0, total: 0});
    // const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    // const [playbackGap, setPlaybackGap] = useState(0.05);


}

export {SlideEntity};