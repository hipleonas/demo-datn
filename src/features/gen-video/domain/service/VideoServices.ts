import type { AudioSlideEntity } from "../entity/AudioSlideEntity";
import type { GenVideoRepositoryInterface } from "../repository/GenVideoRepositoryInterface";


class VideoServices{

    private genVideoRepository: GenVideoRepositoryInterface;

    constructor(genVideoRepository: GenVideoRepositoryInterface) {
        this.genVideoRepository = genVideoRepository;
    }

    async generateVideo(referenceImage: File, slides: AudioSlideEntity[]): Promise<void> {
        // Implement video generation logic here
        console.log("VideoServices: Generating video with reference image and slides:", referenceImage.name, slides);
        await this.genVideoRepository.generateVideo(referenceImage, slides);
        return;
    }
}

export default VideoServices;