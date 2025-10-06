import React, {useState, useRef, useEffect, useCallback} from 'react';
import { FaMicrophone, FaUpload, FaImage, FaMusic, FaCheckCircle, FaExclamationCircle, FaPlay, FaPause, FaFilePowerpoint } from 'react-icons/fa';
import MainController from '../controller/MainController';
import type { MainControllerInterface } from '../controller/MainControllerInterface';
import type { UploadState } from '../model/UploadState';
import './static/style.css';
import type { AudioSlideEntity } from '../../domain/entity/AudioSlideEntity';
import type { AudioChunkEntity } from '../../domain/entity/AudioChunkEntity';
import type { AudioAccumulatorCallbacksEntity } from '../../domain/entity/AudioAccumulatorCallbacksEntity';


const MainPage: React.FC = () => {
    const [voiceUpload, setVoiceUpload] = useState<UploadState>({
        fileObj: null,
        preview: null,
        validExtension: false,
        error: null
    });
    const [imageUpload, setImageUpload] = useState<UploadState>({
        fileObj: null,
        preview: null,
        validExtension: false,
        error: null
    });

    const [slideUpload, setSlideUpload] = useState<UploadState>({
        fileObj: null,
        preview: null,
        validExtension: false,
        error: null
    });
    

    const [slides, setSlides] = useState<AudioSlideEntity[]>([]);
    //@New state: Create use state for slide
    const [isProcessingSlides, setIsProcessingSlides] = useState(false);
   
   
    /*@New state: Speaker Registration*/
    const [speakerOptions, setSpeakerOptions] = useState<{id: string, name: string}[]>([
        {id: 'deafult', name : 'Chọn giọng người nói...'}
    ]);
    const [currentSelectedSpeaker, setCurrentSelectedSpeaker] = useState('default');
    const [speakerName, setSpeakerName] = useState("");
    const [isRegistering, setIsRegistering] = useState(false);
    const [registerMessage, setRegisterMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);


    /*@New state: Advanced audio player state (Ussing accumulator approach@*/
    
    //Handle audio playing when pressing the playbutton when an audio is uploaded
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [isAudioSlidePlaying, setIsAudioSlidePlaying] = useState<{[key: number]: boolean}>({});
    const [isNormalAudioSlidePlaying, setIsNormalAudioSlidePlaying] = useState<{[key: number]: boolean}>({});

    const audioRef = useRef<HTMLAudioElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);
    const slideInputRef = useRef<HTMLInputElement>(null);
    //@New stateCreate 2 more useRefs one for upload audio in a single slide and the other one to play the audio
    // const audioSlideInputRef = useRef<HTMLInputElement>(null);
    // const audioSlideRef = useRef<HTMLAudioElement>(null); // No longer needed - using individual audio elements with IDs


    const controller: MainControllerInterface = new MainController();
    const ttsCommand = "Xin chào, tôi rất mong muốn được thử tính năng tạo giọng nói tự động của hệ thống gia sư trí tuệ nhân tạo. Tôi hiểu rằng đây là một dịch vụ cần sự đồng thuận về mặt pháp lí, và tôi đã đọc kỹ cũng như đồng ý với tất cả các điều khoản sử dụng. Việc xác nhận này đồng nghĩa với việc tôi tự nguyện tham gia và hoàn toàn chịu trách nhiệm với dữ liệu mình cung cấp cho hệ thống.";

    //Setup controller



    const handleReferenceVoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {

        
        // const result = controller.handleReferenceVoiceUpload(e.target.files?.[0] || null);
        // setVoiceUpload(result);

        const voiceFile = e.target.files?.[0] || null;
        if (!voiceFile) {
            console.error("No voice file selected");
            return;
        }
        const result = controller.handleReferenceVoiceUpload(voiceFile);
        setVoiceUpload(result);
    };


    const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        // const result = controller.handleReferenceImageUpload(event.target.files?.[0] || null);
        // setImageUpload(result);
        const imageFile = e.target.files?.[0] || null;
        if (!imageFile) {
            console.error("No image file selected");
            return;
        }

        const result = controller.handleReferenceImageUpload(imageFile);

        setImageUpload(result);
    }
    const handleRegisterSpeaker = async () => {

        if (!voiceUpload.fileObj) {
            setRegisterMessage({
                type: 'error',
                text : 'Vui lòng tải lên file âm thanh để đăng kí ID Người Nói'
            });

            return;
        }
        setIsRegistering(true);
        setRegisterMessage(null);

        try {
            console.log("Bắt đầu đăng kí người nói...");
            console.log(`Người nói: ${speakerName}`);
            console.log(`File âm thanh: ${voiceUpload.fileObj?.name}`);

            const register_ans = await controller.handleRegisterSpeaker(voiceUpload.fileObj, speakerName || voiceUpload.fileObj.name);

            console.log("Kết quả đăng kí: ", register_ans);

            if (register_ans.success) {
                setRegisterMessage({
                    type: 'success',
                    text: register_ans.message
                });
                deleteAudio();
                setSpeakerName('');
                console.log("Đăng kí Người Nói thành công");
            } else{
                setRegisterMessage({
                    type : 'error',
                    text : register_ans.message
                });

                console.log('Đăng kí người nói thất bại');
            }
        }
        catch(error) {
            console.error("MainPage: Exception during speaker registration:", error);
            setRegisterMessage({
                type : 'error',
                text : error instanceof Error ? error.message : "Đã xảy ra lỗi khi đăng ký Speaker ID"
            });
        }
        finally {
            setIsRegistering(false);
        }
    }

    const handleSlideUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const slideFile = e.target.files?.[0] || null;

        const result = controller.handleSlideUpload(slideFile);
        setIsProcessingSlides(true);
        setSlideUpload(result);

        if (result.validExtension) {
            const extractedSlides = await controller.extractUploadedSlides(slideFile);
            setSlides(extractedSlides);
            setIsProcessingSlides(false);
        }
    }

    const handleSlideAudioUpload = (slideId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    
        const audioFile = e.target.files?.[0];
        if (!audioFile) return;

        console.log(`Uploading audio for slide ${slideId}: ${audioFile.name}`);
        // Validate audio file
        if (!controller.handleValidateAudioFile(audioFile)) {
            console.error("Invalid audio file");
            return;
        }
        // Create local URL for the uploaded audio
        const audioUrl = controller.handleCreateAudioLocalUrl(audioFile);
        
        if (!audioUrl) {
            console.error("Failed to create audio URL");
            return;
        }
        
        // Update slide with uploaded audio
        setSlides(prevSlides => 
            prevSlides.map(slide => {
                if (slide.getId() === slideId) {
                    slide.setNormalAudioUrl(audioUrl);
                }
                return slide;
            })
        );
        
        // Reset the file input to allow uploading the same file again
        e.target.value = '';
        console.log(`Audio uploaded for slide ${slideId}`);

    }

    const toggleAudioPlayback = () => {

        if (audioRef.current) {
            if (isAudioPlaying) {
                audioRef.current.pause();
            }else{
                audioRef.current.play();
            }
            setIsAudioPlaying(!isAudioPlaying);
        }
    }

    const toggleAudioSlidePlayback = (slideId: number) => {
        const audioElement = document.getElementById(`audio-${slideId}`) as HTMLAudioElement;
        if (audioElement) {
            if (isAudioSlidePlaying[slideId]) {
                audioElement.pause();
            } else {
                // Pause all other slides first
                Object.keys(isAudioSlidePlaying).forEach(id => {
                    const otherAudio = document.getElementById(`audio-${id}`) as HTMLAudioElement;
                    if (otherAudio && parseInt(id) !== slideId) {
                        otherAudio.pause();
                    }
                });
                audioElement.play();
            }
            setIsAudioSlidePlaying(prev => ({
                ...prev,
                [slideId]: !prev[slideId]
            }));
        }
    }

    const toggleNormalAudioSlidePlayback = (slideId: number) => {
        const audioElement = document.getElementById(`normal-audio-${slideId}`) as HTMLAudioElement;
        if (audioElement) {
            if (isNormalAudioSlidePlaying[slideId]) {
                audioElement.pause();
            } else {
                // Pause all other slides first
                Object.keys(isNormalAudioSlidePlaying).forEach(id => {
                    const otherAudio = document.getElementById(`normal-audio-${id}`) as HTMLAudioElement;
                    if (otherAudio && parseInt(id) !== slideId) {
                        otherAudio.pause();
                    }
                });
                audioElement.play();
            }
            setIsNormalAudioSlidePlaying(prev => ({
                ...prev,
                [slideId]: !prev[slideId]
            }));
        }
    }

    const deleteImage = () => {

        setImageUpload({
            fileObj: null,
            preview: null,
            validExtension: false,
            error: null
        });
        if(imageInputRef.current) {
            imageInputRef.current.value = '';
        }
    }

    const deleteAudio = () => {
        setVoiceUpload({
            fileObj: null,
            preview: null,
            validExtension: false,
            error: null
        });
        setIsAudioPlaying(false);
        if (audioInputRef.current) {
            audioInputRef.current.value = '';
        }
    };

    const deleteSlide = () => {
        setSlideUpload({
            fileObj: null,
            preview: null,
            validExtension: false,
            error: null
        });
        setSlides([]);
        setIsProcessingSlides(false);

        if (slideInputRef.current) {
            slideInputRef.current.value = '';
        }
    };

    const deleteNormalSlideAudio = (slideId: number) => {
        setSlides(prevSlides => 
            prevSlides.map(slide => {
                if (slide.getId() === slideId) {
                    slide.setNormalAudioUrl(null);
                }
                return slide;
            })
        );
        
        // Reset the file input to allow re-uploading the same file
        const fileInput = document.getElementById(`audio-upload-${slideId}`) as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }
    }

    const deleteSlideAudio = (slideId: number) => {
        setSlides(prevSlides => 
            prevSlides.map(slide => {
                if (slide.getId() === slideId) {
                    slide.setAudioUrl(null);
                }
                return slide;
            })
        );
    }

    const updateSlideText = (slideId: number, text: string) => {
        setSlides(prevSlides => 
            prevSlides.map(slide => {
                if (slide.getId() === slideId) {
                    slide.setInputText(text);
                }
                return slide;
            })
        );
    }

    //Use Effect to load speaker from storage
    const loadSpeakers = useCallback(()=> {
        console.log("=== Nạp người nói lên danh sách ===");
        const speakers = controller.handleGetSpeakerList();
        console.log("Số lượng người nói: ", speakers.length);

        const options = [
            { id: 'default', name: 'Chọn speaker...' },
            ...speakers.map(speaker => {
                console.log("Processing speaker:", speaker.getId(), speaker.getAudioFileName());
                return {
                    id: speaker.getId(),
                    name: speaker.getAudioFileName()
                };
            })
        ];
        setSpeakerOptions(options);
        
        // Auto-select first available speaker if none selected
        if (speakers.length > 0 && currentSelectedSpeaker === 'default') {
            setCurrentSelectedSpeaker(speakers[0].getId());
        }
        
        console.log("=== Toàn bộ Danh sách đã được nạp ===");

    },[currentSelectedSpeaker])
    useEffect(()=> {
        loadSpeakers();

    },[loadSpeakers, registerMessage]);

    //=====================================Chunknig Audio in each slide==================================//
    const handleSlideGenerateAudioChunks = async (slideId: number) => {
        const slide = slides.find(s => s.getId() === slideId);

        if (!slide) {
            console.error("No slide found");
            return;
        }

        if(!slide.getInputText()?.trim()){
            console.error("Input text field is empty");
            return;
        }

        //Dont need speakaer id anymore so this code can be commeted
        // if (!slide.getSpeakerId() || slide.getSpeakerId() === 'default') {
        //     console.error("No speaker selected for audio generation. Please select a speaker");
        //     return;
        // }

        setSlides(prevSlides => 
            prevSlides.map(s => {
                if (s.getId() === slideId) {
                    s.setIsGenerating(true);
                }
                return s;
            })
        );

        slide.setIsGenerating(true);
        slide.setAudioStatus("Đang tạo chunk");
        slide.setAudioChunks([]);
        slide.setGenerationProgress({
            current: 0,
            total: 0
        });

        try {
            const callbacks: AudioAccumulatorCallbacksEntity = {
                onChunkGenerated: (chunk: AudioChunkEntity, current: number, total: number) => {
                    console.log(`Chunk ${current}/${total} đã được tạo:`, chunk);
                    slide.setGenerationProgress({current, total});
                    slide.setAudioStatus(`Đang tạo chunk ${current}/${total}...`);
                    slide.setAudioChunks(prevChunks =>{
                        const newChunks = [...prevChunks];
                        newChunks[chunk.getChunkIndex()] = chunk;
                        return newChunks;
                    })
                },
                onGenerationComplete: async (chunks: AudioChunkEntity[]) => {
                    console.log('Toàn bộ các chunk đã được tạo:', chunks);
                    slide.setAudioStatus(`Hoàn tất! Đã tạo ${chunks.length} audio chunks`);
                    slide.setAudioChunks(chunks);
                    
                    // Auto-concatenate and upload audio from temp directory
                    try {
                        console.log(`Tự động gộp audio từ temp directory cho slide ${slideId}...`);
                        slide.setAudioStatus('Đang gộp audio từ temp directory...');
                        
                        // Extract audio URLs from chunks (these come from temp directory)
                        const audioUrls = chunks
                            .filter(chunk => chunk.getChunkStatus() === 'ready')
                            .sort((a, b) => a.getChunkIndex() - b.getChunkIndex())
                            .map(chunk => chunk.getChunkAudioUrl());
                        
                        if (audioUrls.length === 0) {
                            slide.setAudioStatus('Không có audio chunks sẵn sàng để gộp');
                            return;
                        }
                        
                        const result = await controller.handleMergeAudioFromTempDirectory(slideId, audioUrls);
                        
                        if (result.success && result.audioUrl) {
                            // Update slide with merged audio from temp directory
                            slide.setAudioUrl(result.audioUrl);
                            slide.setAudioStatus(`Hoàn thành! Audio đã được gộp từ temp directory và load trực tiếp lên giao diện`);
                            console.log(`Audio đã được gộp từ temp directory và load trực tiếp cho slide ${slideId}: ${result.audioUrl}`);
                            
                            // Force re-render by updating slides state
                            setSlides(prevSlides => 
                                prevSlides.map(s => {
                                    if (s.getId() === slideId) {
                                        s.setAudioUrl(result.audioUrl || null);
                                        s.setAudioStatus(`Hoàn thành! Audio đã được gộp từ temp directory và load trực tiếp lên giao diện`);
                                    }
                                    return s;
                                })
                            );
                        } else {
                            slide.setAudioStatus(`Lỗi gộp audio từ temp directory: ${result.message}`);
                            console.error(`Failed to merge audio from temp directory for slide ${slideId}: ${result.message}`);
                        }
                    } catch (error) {
                        console.error(`Error merging audio from temp directory for slide ${slideId}:`, error);
                        slide.setAudioStatus(`Lỗi gộp audio từ temp directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                },
                onError: (error: string) => {
                    console.error('Chunk generation error:', error);
                    slide.setAudioStatus(`Lỗi: ${error}`);
                }
            };

            // Validate speaker selection
            if (currentSelectedSpeaker === 'default' || !currentSelectedSpeaker) {
                slide.setAudioStatus('Vui lòng chọn giọng nói trước khi tạo audio');
                slide.setIsGenerating(false);
                return;
            }

            const result = await controller.handleGeneratedAudioChunks(
                slide.getInputText() || '',
                currentSelectedSpeaker, // Use the selected speaker
                callbacks
            );

            if(result.success) {
                console.log('Đã tạo sinh audio thành công:', result.message);
                slide.setAudioStatus('Hoàn thành tạo audio');
            }else{
                slide.setAudioStatus(`Lỗi: ${result.message}`);
            }
        }

        catch(error) {
            console.error("Lỗi tạo chunk:", error);
            slide.setAudioStatus(`Lỗi: ${error instanceof Error ? error.message : 'Unknown error'}`);

        }
        finally {
            slide.setIsGenerating(false);
            // Force re-render by updating slides state
            setSlides(prevSlides => [...prevSlides]);
        }

    }
    //===================================================================================================//




    return (

        <div className = "main-page">
            <div className = "container">
                <header className= "header">
                    <h1 className = "title">Hệ thống tạo sinh video và âm thanh từ hình ảnh và audio</h1>
                    <p className = "subtitle">Nhập ảnh để tạo sinh video hoặc nhập audio.wav để tạo sinh giọng nói</p>

                </header>

                <div className = "upload-section">
                    {/* Component 1: Image Upload */}
                    <div className = "upload-card">
                        <div className = "card-header">
                            <FaImage className="card-icon" />
                            <h2>Tải lên hình ảnh</h2>
                            <p>Chọn một hình ảnh để sử dụng trong video của bạn</p>
                        </div>

                        <div className = "upload-area">
                            { !imageUpload.preview ? (
                                <div className = "upload-dropzone"
                                    onClick = {() => imageInputRef.current?.click()}
                                >
                                    <FaUpload className="upload-icon" />
                                    <p className="upload-text">Nhấp để chọn hình ảnh</p>
                                    <p className="upload-hint">JPG, PNG, WEBP (tối đa 10MB)</p>
                                </div>   
                            ):(
                                <div className = "preview-container">
                                    <img 
                                        src = {imageUpload.preview}
                                        alt = "Preview"
                                        className = "image-preview"
                                    />
                                    <div className="preview-overlay">

                                        <button 
                                            className="remove-btn"
                                            onClick={deleteImage}
                                        >   X
                                        </button>
                                    </div>
                                    <div className="file-info">
                                        <FaCheckCircle className="success-icon" />
                                        <span>{imageUpload.fileObj?.name}</span>
                                    </div>

                                    
                                </div>
                            )}

                            <input
                                ref = {imageInputRef}
                                type = "file"
                                accept = "image/jpeg,image/jpg,image/png,image/webp"
                                onChange = {handleReferenceImageUpload}
                                className = "hidden-input"                        
                            />
                        </div>

                        {imageUpload.error && (
                            <div className="error-message">
                                <FaExclamationCircle className="error-icon" />
                                {imageUpload.error}
                            </div>
                        )}
                    </div>

                    {/* Component 2: Audio Upload for Voice Registration */}
                    <div className = "upload-card">
                        <div className = "card-header">
                            <FaMusic className="card-icon" />
                            <h2>Đăng ký giọng nói (Speaker ID)</h2>
                            <p>Tải lên file âm thanh giọng nói để tạo Speaker ID</p>
                        </div>

                        <div className = "sample-text">
                            <h3>Nội dung cần đọc (khoảng 15-25 giây):</h3>
                            <div className="text-content">
                                "{ttsCommand}"
                            </div>
                        </div>

                        <div className = "upload-area">
                            {!voiceUpload.preview ? (
                                <div className = "upload-dropzone"
                                    onClick = {() => audioInputRef.current?.click()}
                                >
                                    <FaMusic className="upload-icon" />
                                    <p className="upload-text">Nhấp để chọn file âm thanh</p>
                                    <p className="upload-hint">MP3, WAV, M4A, OGG (tối đa 20MB, ~15-25 giây)</p>
                                </div>
                            ) : (
                                <div className = "preview-container">
                                    <div className = "audio-container">
                                        <audio
                                            ref = {audioRef}
                                            src = {voiceUpload.preview}
                                            onEnded = {() => setIsAudioPlaying(false)}
                                        />

                                        <div className = "audi0-player">
                                            <button
                                                className = "play-btn"
                                                onClick = {toggleAudioPlayback}
                                            >
                                                {isAudioPlaying ? <FaPause /> : <FaPlay />}

                                            </button>

                                            <div className="audio-info">
                                                <FaMusic className="audio-icon" />
                                                <span>Audio đã sẵn sàng</span>
                                            </div>
                                        </div>

                                    </div>

                                    <div className = "preview-overlay">
                                        <button
                                            className = "remove-btn"
                                            onClick = {deleteAudio}
                                        > 
                                            X
                                        </button>
                                    </div>

                                    <div className="file-info">
                                        <FaCheckCircle className="success-icon" />
                                        <span>{voiceUpload.fileObj?.name}</span>
                                    </div>
                                </div>

                            
                            )}

                            <input
                                ref = {audioInputRef}
                                type = "file"
                                accept = "audio/mpeg,audio/wav,audio/mp4,audio/ogg"
                                onChange = {handleReferenceVoiceUpload}
                                className = "hidden-input"
                            />

                        </div>
                        {voiceUpload.error && (
                            <div className="error-message">
                                <FaExclamationCircle className="error-icon" />
                                {voiceUpload.error}
                            </div>
                        )}
                        {/*Speaker Registration */}

                        {voiceUpload.validExtension && (
                            <div className = "speaker-registration">
                                <h3>Đăng ký Speaker ID</h3>
                                <div className = "registration-form">
                                    <div className="input-group">
                                        <label htmlFor="speaker-name">Tên Speaker (tùy chọn):</label>
                                        <input
                                            id="speaker-name"
                                            type="text"
                                            value={speakerName}
                                            onChange={(e) => setSpeakerName(e.target.value)}
                                            placeholder="Nhập tên speaker hoặc để trống để dùng tên file"
                                            className="speaker-name-input"
                                            disabled={isRegistering}
                                        />
                                        <small className="input-hint">
                                            Chỉ chấp nhận chữ cái, số và dấu gạch dưới. Để trống sẽ dùng tên file.
                                        </small>
                                    </div>
                                    
                                    <button
                                        onClick={handleRegisterSpeaker}
                                        disabled={isRegistering || !voiceUpload.fileObj}
                                        className={`register-speaker-btn ${isRegistering ? 'registering' : ''}`}
                                    >
                                        {isRegistering ? (
                                            <>
                                                <div className="spinner"></div>
                                                Đang đăng ký...
                                            </>
                                        ) : (
                                            <>
                                                <FaMicrophone />
                                                Đăng ký Speaker
                                            </>
                                        )}
                                    </button>
                                </div>

                                {registerMessage && (
                                    <div className={`registration-message ${registerMessage.type}`}>
                                        {registerMessage.type === 'success' ? (
                                            <FaCheckCircle className="message-icon" />
                                        ) : (
                                            <FaExclamationCircle className="message-icon" />
                                        )}
                                        {registerMessage.text}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Component 3: Slide Management */}

                    <div className="slide-management-section">
                        <div className="upload-card">
                            <div className="card-header">
                                <FaFilePowerpoint className="card-icon" />
                                <h2>Quản lý Slides</h2>
                                <p>Tải file định dạng powerpoint (.pptx, .ppt, .pdf) và quản lý nội dung</p>
                            </div>

                            <div className="upload-area">
                                {slides.length === 0 && !isProcessingSlides ? (
                                    <div 
                                        className="upload-dropzone"
                                        onClick={() => slideInputRef.current?.click()}
                                    >
                                        <FaFilePowerpoint className="upload-icon" />
                                        <p className="upload-text">Nhấp để chọn file powerpoint</p>
                                        <p className="upload-hint">.pptx, .ppt, .pdf (tối đa 20MB)</p>
                                    </div>
                                ) : isProcessingSlides ? (
                                    <div className="processing-slides">
                                        <div className="spinner-large"></div>
                                        <p className="processing-text">Đang xử lý file PDF...</p>
                                        <p className="processing-hint">Đang extract từng trang thành hình ảnh...</p>
                                        <p className="processing-hint">Quá trình này có thể mất vài phút với file lớn</p>
                                    </div>
                                ) : (
                                    <div className="slides-uploaded-info">
                                        <div className="file-info">
                                            <FaCheckCircle className="success-icon" />
                                            <span>{slideUpload.fileObj?.name} - {slides.length} slides</span>
                                            <button 
                                                className="remove-btn"
                                                onClick={deleteSlide}
                                            >
                                                X
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <input
                                    ref={slideInputRef}
                                    type="file"
                                    accept=".pptx,.ppt,.pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint,application/pdf"
                                    onChange={handleSlideUpload}
                                    className="hidden-input"
                                />

                                {slideUpload.error && (
                                    <div className="error-message">
                                        <FaExclamationCircle className="error-icon" />
                                        {slideUpload.error}
                                    </div>
                                )}
                            </div>


                            {/* Slides Table */}
                            {slides.length > 0 && (
                                <div>
                                    {/* Speaker Selection */}
                                    <div className="speaker-selection">
                                        <h3>Lựa chọn giọng nói</h3>
                                        <select 
                                            className="speaker-select"
                                            value = {currentSelectedSpeaker}
                                            onChange = {(e) => setCurrentSelectedSpeaker(e.target.value)}
                                        >
                                            {speakerOptions.map(speaker => (
                                                <option key={speaker.id} value={speaker.id}>
                                                    {speaker.name}
                                                </option>
                                            ))}
                                        </select>
                                        
                                    </div>
                                    <div className="slides-table-container">
                                        <h3>Danh sách Slides</h3>
                                        <div className="slides-table">
                                            <div className="table-header">
                                                <div className="col-image">Hình ảnh</div>
                                                <div className="col-text">Nội dung</div>
                                                <div className="col-voice">Tạo giọng nói</div>
                                                <div className="col-audio">Upload Audio</div>
                                            </div>
                                        
                                            {slides.map((slide) => (
                                                <div key={slide.getId()} className="table-row">
                                                    {/* Cột 1: Hình ảnh Slide */}
                                                    <div className="col-image">
                                                        <img 
                                                            src={slide.getImageUrl() || `https:via.placeholder.com/100x70/6B7280/FFFFFF?text=Slide+${slide.getId()}`} 
                                                            alt={`Slide ${slide.getId()}`}
                                                            className="slide-thumbnail"
                                                            onLoad={() => {
                                                                console.log(`Successfully loaded image for slide ${slide.getId()}`);
                                                            }}
                                                        />
                                                        <span className="slide-number">#{slide.getId()}</span>
                                                    </div>

                                                    {/* Cột 2: Input text */}
                                                    <div className="col-text">
                                                        <textarea
                                                            value = {slide.getInputText() || ''}
                                                            onChange = {(e) => updateSlideText(slide.getId(), e.target.value)}
                                                            placeholder="Nhập nội dung cho slide"
                                                            className="slide-text-input"
                                                            rows={5}
                                                        />
                                                    </div>

                                                    {/* Cột 3: Generate Voice với Speaker Selection */}
                                                    <div className="col-voice">
                                                        <div className="voice-controls">                                            
                                                            <button
                                                                onClick = {() => handleSlideGenerateAudioChunks(slide.getId())}
                                                                disabled = {slide.getIsGenerating() || slide.getIsAudioPlaying() || !slide.getInputText()?.trim() || currentSelectedSpeaker === 'default' } 
                                                                className = 'generated-voice-btn'
                                                            >
                                                                <FaMicrophone /> {" "}
                                                                {slide.getIsGenerating() ? 'Đang tạo...' : 'Tạo giọng nói'}
                                                            </button>

                                                            {/* Audio Status Display */}
                                                            {/* {slide.getAudioChunks().length > 0 && (
                                                                <div className="audio-status-info">
                                                                    <small className="audio-status-text">
                                                                        {slide.getAudioStatus() || `Đã tạo ${slide.getAudioChunks().length} chunks`}
                                                                    </small>
                                                                    {slide.getGenerationProgress() && (
                                                                        <div className="progress-bar">
                                                                            <div 
                                                                                className="progress-fill"
                                                                                style={{
                                                                                    width: `${(slide.getGenerationProgress().current / slide.getGenerationProgress().total) * 100}%`
                                                                                }}
                                                                            ></div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )} */}
                                                            {slide.getAudioUrl() && slide.getAudioChunks().length > 0 && (
                                                                <>
                                                                <div className="audio-status-info">
                                                                    <small className="audio-status-text">
                                                                        {slide.getAudioStatus() || `Đã tạo ${slide.getAudioChunks().length} chunks`}
                                                                    </small>
                                                                    {slide.getGenerationProgress() && (
                                                                        <div className="progress-bar">
                                                                            <div 
                                                                                className="progress-fill"
                                                                                style={{
                                                                                    width: `${(slide.getGenerationProgress().current / slide.getGenerationProgress().total) * 100}%`
                                                                                }}
                                                                            ></div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className = "audio-container">
                                                                    <audio 
                                                                        id={`audio-${slide.getId()}`}
                                                                        src = {slide.getAudioUrl() || undefined}
                                                                        onEnded = {() => setIsAudioSlidePlaying(prev => ({...prev, [slide.getId()]: false}))}
                                                                    />
                                                                    <div className = "audio-player">
                                                                        <button className = "play-btn"
                                                                            onClick = {() => toggleAudioSlidePlayback(slide.getId())}
                                                                        >
                                                                            {isAudioSlidePlaying[slide.getId()] ? <FaPause /> : <FaPlay />}
                                                                        </button>
                                                                    </div>
                                                                    <div className = "preview-overlay">
                                                                        <button
                                                                            className = "remove-btn"
                                                                            onClick = {() =>deleteSlideAudio(slide.getId())}
                                                                        > 
                                                                            X
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                </>
                                                            )}

                                                            {/*Upload Audio for each slide section*/}
                                                            <input
                                                                type = "file"
                                                                accept = "audio/*"
                                                                onChange = {(e) => handleSlideAudioUpload(slide.getId(), e)}
                                                                className="hidden-input"
                                                                id={`audio-upload-${slide.getId()}`}
                                                            />
                                                            <label 
                                                                htmlFor={`audio-upload-${slide.getId()}`}
                                                                className="audio-upload-btn"
                                                            >
                                                                <FaUpload />
                                                                Upload Audio
                                                            </label>          
                                                        </div>
                                                    </div>

                                                    {/* Cột 4: Upload Audio */}
                                                    <div className="col-audio">
                                                        {slide.getNormalAudioUrl() && (
                                                            
                                                            <div className = "audio-container">
                                                                <audio 
                                                                    id={`normal-audio-${slide.getId()}`}
                                                                    src = {slide.getNormalAudioUrl() || undefined}
                                                                    onEnded = {() => setIsNormalAudioSlidePlaying(prev => ({...prev, [slide.getId()]: false}))}
                                                                />
                                                                <div className = "audio-player">
                                                                    <button className = "play-btn"
                                                                        onClick = {() => toggleNormalAudioSlidePlayback(slide.getId())}
                                                                    >
                                                                        {isNormalAudioSlidePlaying[slide.getId()] ? <FaPause /> : <FaPlay />}
                                                                    </button>
                                                                </div>
                                                                <div className = "preview-overlay">
                                                                    <button
                                                                        className = "remove-btn"
                                                                        onClick = {() =>deleteNormalSlideAudio(slide.getId())}
                                                                    > 
                                                                        X
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
     
                </div>
            </div>
        </div>
    )
}

export default MainPage;