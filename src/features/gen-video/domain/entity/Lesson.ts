import { AudioSlideEntity } from './AudioSlideEntity';

class Lesson {
    id: string;
    audioSlides: AudioSlideEntity[];
    referenceImageUrl: string;

    constructor(id: string, audioSlides: AudioSlideEntity[], referenceImageUrl: string) {
        this.id = id;
        this.audioSlides = audioSlides;
        this.referenceImageUrl = referenceImageUrl;
    }

    getId(): string {
        return this.id;
    }

    getAudioSlides(): AudioSlideEntity[] {
        return this.audioSlides;
    }

    getReferenceImageUrl(): string {
        return this.referenceImageUrl;
    }


    setId(id: string): void {
        this.id = id;
    }

    setAudioSlides(audioSlides: AudioSlideEntity[]): void {
        this.audioSlides = audioSlides;
    }

    setReferenceImageUrl(referenceImageUrl: string): void {
        this.referenceImageUrl = referenceImageUrl; 
    }
}


export { Lesson };