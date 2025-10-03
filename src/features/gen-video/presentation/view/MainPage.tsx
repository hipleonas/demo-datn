import React, {useState, useRef} from 'react';
import { FaUpload, FaMusic, FaCheckCircle, FaExclamationCircle, FaPlay, FaPause, FaTimes, FaFilePowerpoint, FaMicrophone, FaVolumeUp } from 'react-icons/fa';
import {SlideEntity} from '../../domain/entity/SlideEntity';
import './static/style.css';
import MainController from '../controller/MainController';

interface UploadState {
    fileObj: File | null;
    localUrl: string|  null;
    validExtension: boolean;
    error: string | null;
};

const MainPage: React.FC = () => {
    const [voiceUpload, setVoiceUpload] = useState<UploadState>({
        fileObj: null,
        localUrl: null,
        validExtension: false,
        error: null,
    });
    const [slideUpload, setSlideUpload] = useState<UploadState>({
        fileObj: null,
        localUrl: null,
        validExtension: false,
        error: null,
    });
   
    const [slides, setSlides] = useState<SlideEntity[]>([]);
    const [isProcessingSlides, setIsProcessingSlides] = useState(false);
    const [speakerOptions, setSpeakerOptions] = useState<{id: string, name: string}[]>([
        { id: 'default', name: 'Chọn speaker...' }
    ]);

    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [speakerName , setSpeakerName] = useState("");
    const [isRegistering, setIsRegistering] = useState(false);
    const [registerMessage, setRegisterMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
    
    // Advanced audio player state (Accumulator approach)
    const [testText, setTestText] = useState("");
    const [selectedTestSpeaker, setSelectedTestSpeaker] = useState("default");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isTestAudioPlaying, setIsTestAudioPlaying] = useState(false);
    const [audioStatus, setAudioStatus] = useState("Sẵn sàng");
    const [audioChunks, setAudioChunks] = useState<any[]>([]);
    const [generationProgress, setGenerationProgress] = useState<{current: number, total: number}>({current: 0, total: 0});
    const [playbackProgress, setPlaybackProgress] = useState<{current: number, total: number}>({current: 0, total: 0});
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [playbackGap, setPlaybackGap] = useState(0.05);
   
    //PRevent component re-render
    const audioInputRef = useRef<HTMLInputElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const slideInputRef = useRef<HTMLInputElement>(null);
    //Define controller
    const controller = new MainController();
    //Handle Upload

    const handleVoiceUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const voiceFile = event.target.files?.[0] || null;
        if (!voiceFile) {

            throw new Error("No voice file selected");
        }
        const isValid = controller.validateAudioFile(voiceFile);
        if (!isValid) {
            setVoiceUpload({
                fileObj: null,
                localUrl: null,
                validExtension: false,
                error: "Định dạng file âm thanh không hợp lệ. Chỉ chấp nhận MP3, WAV, M4A, OGG"
            });
            return;
        }
        const localUrl = controller.handleCreateAudioLocalUrl(voiceFile);
        setVoiceUpload({
            fileObj: voiceFile,
            localUrl: localUrl,
            validExtension: true,
            error: null,
        });
    }

    const handleRegisterSpeaker = async () => {
        if (!voiceUpload.fileObj) {
            setRegisterMessage({
                type : 'error',
                text : "Vui lòng tải lên file âm thanh để đăng ký Speaker ID"
            });
            return;
        }
        setIsRegistering(true);
        setRegisterMessage(null);
        
        try {
            console.log("MainPage: Starting speaker registration...");
            console.log(`Speaker name: "${speakerName}"`);
            console.log(`Audio file: ${voiceUpload.fileObj?.name}`);
            
            const register_result = await controller.registerSpeakerEntity(voiceUpload.fileObj, speakerName || voiceUpload.fileObj.name);
            
            console.log("Registration result:", register_result);
            
            if (register_result.success) {
                setRegisterMessage({
                    type: 'success',
                    text: register_result.message
                });
                deleteAudio();
                setSpeakerName('');
                console.log("MainPage: Speaker registration successful");
            } else {
                setRegisterMessage({
                    type: 'error',
                    text: register_result.message
                });
                console.log("MainPage: Speaker registration failed:", register_result.message);
            }
        }
        catch (error) {
            console.error("MainPage: Exception during speaker registration:", error);
            setRegisterMessage({
                type : 'error',
                text : error instanceof Error ? error.message : "Đã xảy ra lỗi khi đăng ký Speaker ID"
            });
        } finally {
            setIsRegistering(false); //Thao tác cuối cùng
        }
    }
    const handleSlideUpload = async(event: React.ChangeEvent<HTMLInputElement>) => {
        const slideFile = event.target.files?.[0] || null;

        if (!slideFile) {
            throw new Error("No slide file selected");
        }

        const isValidExtension = controller.validateSlideFile(slideFile);
        
        if (!isValidExtension) {
            setSlideUpload({
                fileObj: null,
                localUrl: null,
                validExtension: false,
                error: 'Định dạng file không hợp lệ. Chỉ chấp nhận .pptx, .ppt, .pdf'
            });
            return;
        }

        // Set loading state
        setIsProcessingSlides(true);
        setSlideUpload({
            fileObj: slideFile,
            localUrl: null,
            validExtension: true,
            error: null
        });

        try {
            // Process the actual slide file
            const extractedSlides = await controller.handleProcessPDF(slideFile);
            setSlides(extractedSlides || []);
        } catch (error) {
            console.error('Error processing slide file:', error);
            setSlideUpload({
                fileObj: null,
                localUrl: null,
                validExtension: false,
                error: error instanceof Error ? error.message : 'Có lỗi xảy ra khi xử lý file slide'
            });
            setSlides([]);
        } finally {
            setIsProcessingSlides(false);
        }
    }

    const deleteAudio = () => {
        setVoiceUpload({
            fileObj: null,
            localUrl: null,
            validExtension: false,
            error: null,
        });

        if (audioInputRef.current) {
            audioInputRef.current.value = '';
        }
    }
    const ttsCommand = "Xin chào, tôi muốn vui lòng được trải nghiệm dịch vụ tạo sinh giọng của hệ thống gia sư AI. Tôi đã xác nhận và đồng ý với các điều khoản và quy định pháp lí của dịch vụ này.";
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

    const deleteSlide = () => {
        setSlideUpload({
            fileObj: null,
            localUrl: null,
            validExtension: false,
            error: null
        });
        setSlides([]);
        setIsProcessingSlides(false);

        if (slideInputRef.current) {
            slideInputRef.current.value = '';
        }
    };

    // Helper functions for slide management
    const updateSlideText = (slideId: string, text: string) => {
        setSlides(prevSlides => 
            prevSlides.map(slide => {
                if (slide.getId() === slideId) {
                    slide.setInputText(text);
                }
                return slide;
            })
        );
        
    };


    const updateSlideSpeaker = (slideId: string, speakerId: string) => {
        setSlides(prevSlides => 
            prevSlides.map(slide => {
                if (slide.getId() === slideId) {
                    slide.setSpeakerId(speakerId);
                }
                return slide;
            })
        );

    };
    
    //=====================Chunknig Audio in each slide==================================================//
    const handleSlideGenerateAudioChunks = async (slideId: string) => {
        const slide = slides.find(s => s.getId() === slideId);
        if (!slide) {
            console.error("No slide found");
            return;
        }

        if (!slide.getInputText().trim()) {
            console.error("Input text field is empty, please enter text to generate audio chunks");
            return ;
        }

        if (!slide.getSpeakerId() || slide.getSpeakerId() === 'default') {
            console.error("No speaker selected for audio generation. Please select a speaker");
            return;
        }

        setSlides(prevSlides => 
            prevSlides.map(s => {
                if (s.getId() === slideId) {
                    s.setIsGenerating(true);
                }
                return s;
            })
        );
        slide.setIsGenerating(true);
        slide.setAudioStatus("Đang tạo audio chunks...");
        slide.setAudioChunks([]);
        slide.setGenerationProgress({current: 0, total: 0});

        try {
            const result = await controller.handleGenerateAudioChunks(
                slide.getInputText(),
                slide.getSpeakerId(),
                {
                    onChunkGenerated: (chunk, current, total) => {
                        console.log(`Chunk ${current}/${total} generated:`, chunk);
                        slide.setGenerationProgress({ current, total });
                        slide.setAudioStatus(`Đang tạo chunk ${current}/${total}...`);
                        
                        // Update chunks in state
                        slide.setAudioChunks(prevChunks => {
                            const newChunks = [...prevChunks];
                            newChunks[chunk.index] = chunk;
                            return newChunks;
                        });

                    },
                    onGenerationComplete: (chunks) => {
                        console.log('All chunks generated:', chunks);
                        slide.setAudioStatus(`Hoàn tất! Đã tạo ${chunks.length} audio chunks`);
                        slide.setAudioChunks(chunks);
                    },
                    onError: (error) => {
                        console.error('Chunk generation error:', error);
                        slide.setAudioStatus(`Lỗi: ${error}`);
                    }
                }                
            )

            if (result.success) {
                console.log('Generation successful:', result.message);
            } else {
                slide.setAudioStatus(`Lỗi: ${result.message}`);
            }

        }
        catch (error) {
            console.error("Failed to generate audio chunks:", error);
            slide.setAudioStatus(`Lỗi: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            slide.setIsGenerating(false);
        }

    }

    const handleSlidePlayAccumulatedAudio = async (slideId: string) => {
        const slide = slides.find(s => s.getId() === slideId);
        if (!slide) {
            console.error("No slide found");
            return;
        }
        if(slide.getAudioChunks().length === 0) {
            console.error("There isn't any chunks to play");
            return;
        }
        slide.setIsGenerating(true);
        slide.setAudioStatus("Đang phát audio...");
        slide.setGenerationProgress({ current: 0, total: slide.getAudioChunks().length });

        try {
            await controller.handlePlayAccumulatedAudio(
                slide.getPlaybackSpeed(),
                slide.getPlaybackGap(),
                {
                    onPlaybackProgress: (current, total) => {
                        console.log(`Playing chunk ${current}/${total}`);
                        slide.setPlaybackProgress({ current, total });
                        slide.setAudioStatus(`Đang phát chunk ${current}/${total}...`);
                    },
                    onPlaybackComplete: () => {
                        console.log('Playback complete');
                        slide.setAudioStatus("Phát hoàn tất!");
                        slide.setIsAudioPlaying(false);
                        slide.setPlaybackProgress({ current: 0, total: 0 });
                    },
                    onError: (error) => {
                        console.error('Playback error:', error);
                        slide.setAudioStatus(`Lỗi phát: ${error}`);
                        slide.setIsAudioPlaying(false);
                    }
                }
            );

        }

        catch(error){
            console.error("Failed to play audio:", error);
            slide.setAudioStatus(`Lỗi: ${error instanceof Error ? error.message : 'Unknown error'}`);
            slide.setIsAudioPlaying(false);
        }




        
    }

    const handleSlideStopAccumulatedAudio = (slideId: string) => {
        const slide = slides.find(s => s.getId() === slideId);
        if (!slide) {
            console.error("No slide found");
            return;
        }
        
        controller.handleStopAccumulatedAudio();
        slide.setIsAudioPlaying(false);
        slide.setAudioStatus("Đã dừng lại");
        slide.setPlaybackProgress({ current: 0, total: 0 });
    };

    const handleSlideClearAudioChunks = (slideId: string) => {
        const slide = slides.find(s => s.getId() === slideId);
        if (!slide) {
            console.error("No slide found");
            return;
        }
        controller.handleClearAudioChunks();
        slide.setAudioChunks([]);
        slide.setGenerationProgress({ current: 0, total: 0 });
        slide.setPlaybackProgress({ current: 0, total: 0 });
        slide.setAudioStatus("Đã xóa tất cả chunks");
    };

    // Play individual chunk using HTML5 Audio
    const playSlideIndividualChunk = (slideId: string, chunk: any) => {
        const slide = slides.find(s => s.getId() === slideId);
        if (!slide) {
            console.error("No slide found");
            return;
        }
        if (!chunk || !chunk.audioUrl) {
            console.error("No audio URL for this chunk");
            return;
        }

        console.log(`Playing individual chunk: ${chunk.audioUrl}`);
        
        // Create and play audio element
        const audio = new Audio(chunk.audioUrl);
        audio.playbackRate = playbackSpeed;
        
        slide.setIsAudioPlaying(true);
        slide.setAudioStatus(`Đang phát chunk #${chunk.index + 1}...`);
        
        audio.onended = () => {
            slide.setIsAudioPlaying(false);
            slide.setAudioStatus(`Đã phát xong chunk #${chunk.index + 1}`);
        };
        
        audio.onerror = (error) => {
            console.error('Error playing audio:', error);
            slide.setIsAudioPlaying(false);
            slide.setAudioStatus(`Lỗi phát chunk #${chunk.index + 1}`);
        };
        
        audio.play().catch(error => {
            console.error('Failed to play audio:', error);
            slide.setIsAudioPlaying(false);
            slide.setAudioStatus(`Không thể phát chunk #${chunk.index + 1}`);
        });
    };
    //=====================================================================================================//

    

    const handleSlideAudioUpload = (slideId: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const audioFile = event.target.files?.[0];
        if (!audioFile) return;

        console.log(`Uploading audio for slide ${slideId}: ${audioFile.name}`);
        
        // Validate audio file
        if (!controller.validateAudioFile(audioFile)) {
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
                    slide.setAudioUrl(audioUrl);
                }
                return slide;
            })
        );

        console.log(`Audio uploaded for slide ${slideId}`);
    };

    // Load speakers when component mounts or when a new speaker is registered
    const loadSpeakers = React.useCallback(() => {
        console.log("=== LOADING SPEAKERS ===");
        const speakers = controller.handleGetSpeakerEntitys();
        console.log("Raw speakers from controller:", speakers);
        console.log("Number of speakers found:", speakers.length);
        
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
        console.log("Final speaker options:", options);
        console.log("Setting speaker options state...");
        setSpeakerOptions(options);
        console.log("=== SPEAKERS LOADED ===");
    }, []);

    React.useEffect(() => {
        loadSpeakers();
    }, [loadSpeakers, registerMessage]); // Reload when a speaker is registered

    // Advanced Audio Player Handlers (Accumulator Approach)
    
    // Step 1: Generate all audio chunks
    const handleGenerateAudioChunks = async () => {
        if (!testText.trim()) {
            setAudioStatus("Lỗi: Vui lòng nhập văn bản");
            return;
        }
        
        if (!selectedTestSpeaker || selectedTestSpeaker === 'default') {
            setAudioStatus("Lỗi: Vui lòng chọn speaker");
            return;
        }

        setIsGenerating(true);
        setAudioStatus("Đang tạo audio chunks...");
        setAudioChunks([]);
        setGenerationProgress({ current: 0, total: 0 });

        try {
            const result = await controller.handleGenerateAudioChunks(
                testText,
                selectedTestSpeaker,
                {
                    onChunkGenerated: (chunk, current, total) => {
                        console.log(`Chunk ${current}/${total} generated:`, chunk);
                        setGenerationProgress({ current, total });
                        setAudioStatus(`Đang tạo chunk ${current}/${total}...`);
                        
                        // Update chunks in state
                        setAudioChunks(prev => {
                            const newChunks = [...prev];
                            newChunks[chunk.index] = chunk;
                            return newChunks;
                        });
                    },
                    onGenerationComplete: (chunks) => {
                        console.log('All chunks generated:', chunks);
                        setAudioStatus(`Hoàn tất! Đã tạo ${chunks.length} audio chunks`);
                        setAudioChunks(chunks);
                    },
                    onError: (error) => {
                        console.error('Chunk generation error:', error);
                        setAudioStatus(`Lỗi: ${error}`);
                    }
                }
            );

            if (result.success) {
                console.log('Generation successful:', result.message);
            } else {
                setAudioStatus(`Lỗi: ${result.message}`);
            }
        } catch (error) {
            console.error("Failed to generate audio chunks:", error);
            setAudioStatus(`Lỗi: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsGenerating(false);
        }
    };

    // Step 2: Play all generated chunks
    const handlePlayAccumulatedAudio = async () => {
        if (audioChunks.length === 0) {
            setAudioStatus("Lỗi: Chưa có audio chunks nào được tạo");
            return;
        }

        setIsTestAudioPlaying(true);
        setAudioStatus("Đang phát audio...");
        setPlaybackProgress({ current: 0, total: audioChunks.length });

        try {
            await controller.handlePlayAccumulatedAudio(
                playbackSpeed,
                playbackGap,
                {
                    onPlaybackProgress: (current, total) => {
                        console.log(`Playing chunk ${current}/${total}`);
                        setPlaybackProgress({ current, total });
                        setAudioStatus(`Đang phát chunk ${current}/${total}...`);
                    },
                    onPlaybackComplete: () => {
                        console.log('Playback complete');
                        setAudioStatus("Phát hoàn tất!");
                        setIsTestAudioPlaying(false);
                        setPlaybackProgress({ current: 0, total: 0 });
                    },
                    onError: (error) => {
                        console.error('Playback error:', error);
                        setAudioStatus(`Lỗi phát: ${error}`);
                        setIsTestAudioPlaying(false);
                    }
                }
            );
        } catch (error) {
            console.error("Failed to play audio:", error);
            setAudioStatus(`Lỗi: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setIsTestAudioPlaying(false);
        }
    };

    const handleStopAccumulatedAudio = () => {
        controller.handleStopAccumulatedAudio();
        setIsTestAudioPlaying(false);
        setAudioStatus("Đã dừng lại");
        setPlaybackProgress({ current: 0, total: 0 });
    };

    const handleClearAudioChunks = () => {
        controller.handleClearAudioChunks();
        setAudioChunks([]);
        setGenerationProgress({ current: 0, total: 0 });
        setPlaybackProgress({ current: 0, total: 0 });
        setAudioStatus("Đã xóa tất cả chunks");
    };

    // Play individual chunk using HTML5 Audio
    const playIndividualChunk = (chunk: any) => {
        if (!chunk || !chunk.audioUrl) {
            console.error("No audio URL for this chunk");
            return;
        }

        console.log(`Playing individual chunk: ${chunk.audioUrl}`);
        
        // Create and play audio element
        const audio = new Audio(chunk.audioUrl);
        audio.playbackRate = playbackSpeed;
        
        setIsTestAudioPlaying(true);
        setAudioStatus(`Đang phát chunk #${chunk.index + 1}...`);
        
        audio.onended = () => {
            setIsTestAudioPlaying(false);
            setAudioStatus(`Đã phát xong chunk #${chunk.index + 1}`);
        };
        
        audio.onerror = (error) => {
            console.error('Error playing audio:', error);
            setIsTestAudioPlaying(false);
            setAudioStatus(`Lỗi phát chunk #${chunk.index + 1}`);
        };
        
        audio.play().catch(error => {
            console.error('Failed to play audio:', error);
            setIsTestAudioPlaying(false);
            setAudioStatus(`Không thể phát chunk #${chunk.index + 1}`);
        });
    };

    return (
        <div className = "main-page">
            <div className = "container">
                <header className = "header">
                    <h1 className = "title">Hệ thống tạo sinh video và âm thanh </h1>
                    <p className = "subtitle">Nhập ảnh để tạo sinh video hoặc nhập audio.wav để tạo sinh giọng nói</p>
                </header>

                <div className = "upload-section">
                    {/* Component 1: Image Upload */}
                    {/* <div className = "upload-card">
                        <div className = "card-header">
                            <FaImage className="card-icon" />
                            <h2>Tải lên hình ảnh</h2>
                            <p>Chọn một hình ảnh để sử dụng trong video của bạn</p>
                        </div>

                        <div className = "upload-area">
                            {!imageUpload.localUrl ?(
                                <div className = "upload-dropzone" onClick = {() => imageInputRef.current?.click()}>
                                    <FaUpload className="upload-icon" />
                                    <p className="upload-text">Nhấp để chọn hình ảnh</p>
                                    <p className="upload-hint">JPG, PNG, WEBP (tối đa 10MB)</p>
                                </div>

                            ):(
                                <div className = "preview-container">
                                    <img 
                                        src = {imageUpload.localUrl}
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
                                onChange = {handleImageUpload}
                                className = "hidden-input"
                            />
                        </div>

                        {imageUpload.error && (
                            <div className="error-message">
                                <FaExclamationCircle className="error-icon" />
                                {imageUpload.error}
                            </div>
                        )}

                    </div> */}

                    {/* Component 2: Audio Upload for Voice Registration */}
                    <div className = "upload-card">
                        <div className="card-header">
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
                            {!voiceUpload.localUrl ?(
                                <div 
                                    className="upload-dropzone"
                                    onClick={() => audioInputRef.current?.click()}
                                >
                                    <FaMusic className="upload-icon" />
                                    <p className="upload-text">Nhấp để chọn file âm thanh</p>
                                    <p className="upload-hint">MP3, WAV, M4A, OGG (tối đa 20MB, ~15-25 giây)</p>
                                </div>

                            ):(
                                <div className ="preview-container">
                                    <div className = "audio-container">
                                        <audio
                                            ref = {audioRef}
                                            src = {voiceUpload.localUrl}
                                            onEnded = {() => setIsAudioPlaying(false)}
                                        />
                                        <div className="audio-player">
                                            <button 
                                                className="play-btn"
                                                onClick={toggleAudioPlayback}
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
                                onChange = {handleVoiceUpload}
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
                            <div className="speaker-registration">
                                <h3>Đăng ký Speaker ID</h3>
                                <div className="registration-form">
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

                    {/* Component 2.5: Advanced Audio Player Test */}
                    <div className="upload-card">
                        <div className="card-header">
                            <FaVolumeUp className="card-icon" />
                            <h2>Test Advanced Audio Player</h2>
                            <p>Kiểm tra khả năng phát audio với chunking và prefetching</p>
                        </div>

                        <div className="audio-player-test">
                            {/* Text Input */}
                            <div className="input-group">
                                <label htmlFor="test-text">Nhập văn bản để phát:</label>
                                <textarea
                                    id="test-text"
                                    value={testText}
                                    onChange={(e) => setTestText(e.target.value)}
                                    placeholder="Nhập văn bản dài để test tính năng chunking và prefetching..."
                                    className="test-text-input"
                                    rows={5}
                                    disabled={isTestAudioPlaying}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: '1px solid #d1d5db',
                                        fontSize: '14px',
                                        marginBottom: '15px'
                                    }}
                                />
                            </div>

                            {/* Speaker Selection */}
                            <div className="input-group" style={{ marginBottom: '15px' }}>
                                <label htmlFor="test-speaker">Chọn Speaker:</label>
                                <select
                                    id="test-speaker"
                                    value={selectedTestSpeaker}
                                    onChange={(e) => setSelectedTestSpeaker(e.target.value)}
                                    disabled={isTestAudioPlaying}
                                    className="speaker-select"
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: '1px solid #d1d5db',
                                        fontSize: '14px'
                                    }}
                                >
                                    {speakerOptions.map(speaker => (
                                        <option key={speaker.id} value={speaker.id}>
                                            {speaker.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Speed and Gap Controls */}
                            <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                                <div className="input-group" style={{ flex: 1 }}>
                                    <label htmlFor="speed-control">
                                        Tốc độ phát: {playbackSpeed.toFixed(2)}x
                                    </label>
                                    <input
                                        id="speed-control"
                                        type="range"
                                        min="0.5"
                                        max="2.0"
                                        step="0.1"
                                        value={playbackSpeed}
                                        onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                                        disabled={isTestAudioPlaying}
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                <div className="input-group" style={{ flex: 1 }}>
                                    <label htmlFor="gap-control">
                                        Khoảng cách chunk: {playbackGap.toFixed(2)}s
                                    </label>
                                    <input
                                        id="gap-control"
                                        type="range"
                                        min="0"
                                        max="0.5"
                                        step="0.05"
                                        value={playbackGap}
                                        onChange={(e) => setPlaybackGap(parseFloat(e.target.value))}
                                        disabled={isTestAudioPlaying}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>

                            {/* Generate/Play/Stop Controls */}
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
                                {/* Generate Button */}
                                <button
                                    onClick={handleGenerateAudioChunks}
                                    disabled={isGenerating || isTestAudioPlaying || !testText.trim() || selectedTestSpeaker === 'default'}
                                    className="register-speaker-btn"
                                    style={{
                                        flex: '1 1 45%',
                                        backgroundColor: isGenerating ? '#9ca3af' : '#3b82f6'
                                    }}
                                >
                                    <FaMicrophone style={{ marginRight: '8px' }} />
                                    {isGenerating ? 'Đang tạo...' : 'Tạo Audio Chunks'}
                                </button>

                                {/* Play Button */}
                                <button
                                    onClick={handlePlayAccumulatedAudio}
                                    disabled={isTestAudioPlaying || audioChunks.length === 0 || isGenerating}
                                    className="register-speaker-btn"
                                    style={{
                                        flex: '1 1 45%',
                                        backgroundColor: (isTestAudioPlaying || audioChunks.length === 0) ? '#9ca3af' : '#10b981'
                                    }}
                                >
                                    <FaPlay style={{ marginRight: '8px' }} />
                                    {isTestAudioPlaying ? 'Đang phát...' : `Phát Audio (${audioChunks.length})`}
                                </button>

                                {/* Stop Button */}
                                <button
                                    onClick={handleStopAccumulatedAudio}
                                    disabled={!isTestAudioPlaying}
                                    className="register-speaker-btn"
                                    style={{
                                        flex: '1 1 30%',
                                        backgroundColor: !isTestAudioPlaying ? '#9ca3af' : '#ef4444'
                                    }}
                                >
                                    <FaPause style={{ marginRight: '8px' }} />
                                    Dừng
                                </button>

                                {/* Clear Button */}
                                <button
                                    onClick={handleClearAudioChunks}
                                    disabled={audioChunks.length === 0 || isTestAudioPlaying || isGenerating}
                                    className="register-speaker-btn"
                                    style={{
                                        flex: '1 1 30%',
                                        backgroundColor: (audioChunks.length === 0 || isTestAudioPlaying) ? '#9ca3af' : '#f59e0b'
                                    }}
                                >
                                    <FaTimes style={{ marginRight: '8px' }} />
                                    Xóa
                                </button>
                            </div>

                            {/* Status Display */}
                            <div style={{
                                padding: '15px',
                                backgroundColor: '#f3f4f6',
                                borderRadius: '8px',
                                border: '1px solid #d1d5db',
                                marginBottom: '15px'
                            }}>
                                <div style={{ marginBottom: '8px' }}>
                                    <strong>Trạng thái:</strong> {audioStatus}
                                </div>
                                
                                {/* Generation Progress */}
                                {generationProgress.total > 0 && (
                                    <div style={{ marginBottom: '12px' }}>
                                        <strong>Tạo chunks:</strong> {generationProgress.current}/{generationProgress.total}
                                        <div style={{
                                            width: '100%',
                                            height: '8px',
                                            backgroundColor: '#e5e7eb',
                                            borderRadius: '4px',
                                            marginTop: '8px',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                width: `${(generationProgress.current / generationProgress.total) * 100}%`,
                                                height: '100%',
                                                backgroundColor: '#3b82f6',
                                                transition: 'width 0.3s ease'
                                            }} />
                                        </div>
                                    </div>
                                )}
                                
                                {/* Playback Progress */}
                                {playbackProgress.total > 0 && (
                                    <div>
                                        <strong>Phát:</strong> {playbackProgress.current}/{playbackProgress.total} chunks
                                        <div style={{
                                            width: '100%',
                                            height: '8px',
                                            backgroundColor: '#e5e7eb',
                                            borderRadius: '4px',
                                            marginTop: '8px',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                width: `${(playbackProgress.current / playbackProgress.total) * 100}%`,
                                                height: '100%',
                                                backgroundColor: '#10b981',
                                                transition: 'width 0.3s ease'
                                            }} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Audio Chunks Display */}
                            {audioChunks.length > 0 && (
                                <div style={{
                                    padding: '15px',
                                    backgroundColor: '#fff',
                                    borderRadius: '8px',
                                    border: '2px solid #3b82f6',
                                    marginBottom: '15px',
                                    maxHeight: '400px',
                                    overflowY: 'auto'
                                }}>
                                    <h4 style={{ marginTop: 0, marginBottom: '12px', color: '#3b82f6' }}>
                                        📋 Audio Chunks ({audioChunks.length})
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {audioChunks.map((chunk, index) => (
                                            <div 
                                                key={index}
                                                style={{
                                                    padding: '12px',
                                                    backgroundColor: chunk.status === 'ready' ? '#d1fae5' : 
                                                                   chunk.status === 'generating' ? '#fef3c7' :
                                                                   chunk.status === 'error' ? '#fee2e2' : '#f3f4f6',
                                                    borderRadius: '8px',
                                                    border: '2px solid ' + (chunk.status === 'ready' ? '#10b981' : 
                                                                           chunk.status === 'generating' ? '#f59e0b' :
                                                                           chunk.status === 'error' ? '#ef4444' : '#d1d5db'),
                                                    fontSize: '13px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px'
                                                }}
                                            >
                                                {/* Chunk Number */}
                                                <span style={{ 
                                                    fontWeight: 'bold', 
                                                    fontSize: '16px',
                                                    color: chunk.status === 'ready' ? '#10b981' : 
                                                          chunk.status === 'error' ? '#ef4444' : '#6b7280',
                                                    minWidth: '30px'
                                                }}>
                                                    #{index + 1}
                                                </span>
                                                
                                                {/* Status Badge */}
                                                <span style={{ 
                                                    fontSize: '10px',
                                                    padding: '3px 8px',
                                                    borderRadius: '4px',
                                                    backgroundColor: chunk.status === 'ready' ? '#10b981' :
                                                                   chunk.status === 'generating' ? '#f59e0b' :
                                                                   chunk.status === 'error' ? '#ef4444' : '#9ca3af',
                                                    color: 'white',
                                                    textTransform: 'uppercase',
                                                    fontWeight: 'bold',
                                                    minWidth: '80px',
                                                    textAlign: 'center'
                                                }}>
                                                    {chunk.status === 'ready' ? '✓ READY' :
                                                     chunk.status === 'generating' ? '⟳ GENERATING' :
                                                     chunk.status === 'error' ? '✗ ERROR' : '○ PENDING'}
                                                </span>
                                                
                                                {/* Text Content */}
                                                <span style={{ flex: 1, color: '#374151', fontSize: '13px', lineHeight: '1.4' }}>
                                                    {chunk.text.substring(0, 80)}{chunk.text.length > 80 ? '...' : ''}
                                                </span>
                                                
                                                {/* Individual Play Button */}
                                                {chunk.status === 'ready' && (
                                                    <button
                                                        onClick={() => playIndividualChunk(chunk)}
                                                        disabled={isTestAudioPlaying}
                                                        className="register-speaker-btn"
                                                        style={{
                                                            padding: '8px 16px',
                                                            fontSize: '13px',
                                                            backgroundColor: isTestAudioPlaying ? '#9ca3af' : '#10b981',
                                                            minWidth: '80px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '6px'
                                                        }}
                                                    >
                                                        <FaPlay style={{ fontSize: '11px' }} />
                                                        Play
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Info Box */}
                            
                        </div>
                    </div>

                    {/* Component 3: Slide upload and management */}
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
                                                        src={slide.getImageUrl()} 
                                                        alt={`Slide ${slide.getSlideNumber()}`}
                                                        className="slide-thumbnail"
                                                        onError={(e) => {
                                                            console.error(`Failed to load image for slide ${slide.getSlideNumber()}`);
                                                            const target = e.target as HTMLImageElement;
                                                            target.src = `https://via.placeholder.com/100x70/6B7280/FFFFFF?text=Slide+${slide.getSlideNumber()}`;
                                                        }}
                                                        onLoad={() => {
                                                            console.log(`Successfully loaded image for slide ${slide.getSlideNumber()}`);
                                                        }}
                                                    />
                                                    <span className="slide-number">#{slide.getSlideNumber()}</span>
                                                </div>

                                                {/* Cột 2: Input text */}
                                                <div className="col-text">
                                                    {/* <textarea
                                                        value={slide.getInputText()}
                                                        onChange={(e) => updateSlideText(slide.getId(), e.target.value)}
                                                        placeholder="Nhập nội dung cho slide này..."
                                                        className="slide-text-input"
                                                        rows={3}
                                                    /> */}
                                                    <textarea                            
                                                        className="slide-text-input"
                                                        value = {slide.getInputText()}
                                                        //Cập nhật văn bản lưu trữ cho slide cụ thể
                                                        onChange = {(e) => updateSlideText(slide.getId(), e.target.value)}
                                                        placeholder = "Nhập văn bản dài để test tính năng chunking"
                                                        rows = {3}
                                                    />
                                                </div>

                                                {/* Cột 3: Advanced Audio Player cho mỗi Slide - Modern UI */}
                                                <div className="col-voice" style={{ 
                                                    minWidth: '450px',
                                                    padding: '20px',
                                                    background: 'linear-gradient(145deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)',
                                                    borderRadius: '16px',
                                                    border: '1px solid rgba(139, 92, 246, 0.2)',
                                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                                                }}>
                                                    <div className="audio-player-test">
                                                        {/* Speaker Selection - Modern Design */}
                                                        <div className="input-group" style={{ marginBottom: '16px' }}>
                                                            <label style={{ 
                                                                color: '#e0e7ff', 
                                                                fontSize: '13px', 
                                                                fontWeight: '600',
                                                                marginBottom: '8px', 
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px'
                                                            }}>
                                                                🎙️ Speaker:
                                                            </label>
                                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <select
                                                            value={slide.getSpeakerId()}
                                                            onChange={(e) => updateSlideSpeaker(slide.getId(), e.target.value)}
                                                                    disabled={slide.getIsAudioPlaying()}
                                                            className="speaker-select"
                                                                    style={{
                                                                        flex: 1,
                                                                        padding: '10px 12px',
                                                                        borderRadius: '8px',
                                                                        border: '1px solid rgba(139, 92, 246, 0.3)',
                                                                        fontSize: '14px',
                                                                        backgroundColor: 'rgba(30, 30, 46, 0.5)',
                                                                        color: 'white',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                >
                                                                    {speakerOptions.map(speaker => (
                                                                    <option key={speaker.id} value={speaker.id}>
                                                                        {speaker.name}
                                                                    </option>
                                                                    ))}
                                                        </select>
                                                        <button 
                                                                    onClick={() => loadSpeakers()}
                                                            className="refresh-speakers-btn"
                                                                    style={{
                                                                        fontSize: '16px', 
                                                                        padding: '10px 12px',
                                                                        backgroundColor: 'rgba(139, 92, 246, 0.2)',
                                                                        border: '1px solid rgba(139, 92, 246, 0.3)',
                                                                        borderRadius: '8px',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                            title="Làm mới danh sách speakers"
                                                        >
                                                            🔄
                                                        </button>
                                                            </div>
                                                        </div>

                                                        {/* Speed and Gap Controls - Modern Sliders */}
                                                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                                                            <div className="input-group" style={{ 
                                                                flex: 1,
                                                                backgroundColor: 'rgba(30, 30, 46, 0.3)',
                                                                padding: '12px',
                                                                borderRadius: '10px',
                                                                border: '1px solid rgba(99, 102, 241, 0.2)'
                                                            }}>
                                                                <label style={{ 
                                                                    color: '#e0e7ff', 
                                                                    fontSize: '12px', 
                                                                    fontWeight: '600',
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    marginBottom: '6px' 
                                                                }}>
                                                                    <span>⚡ Tốc độ</span>
                                                                    <span style={{ color: '#818cf8' }}>{slide.getPlaybackSpeed().toFixed(1)}x</span>
                                                                </label>
                                                                <input
                                                                    type="range"
                                                                    min="0.5"
                                                                    max="2.0"
                                                                    step="0.1"
                                                                    value={slide.getPlaybackSpeed()}
                                                                    onChange={(e) => {
                                                                        setSlides(prevSlides => 
                                                                            prevSlides.map(s => {
                                                                                if (s.getId() === slide.getId()) {
                                                                                    s.setPlaybackSpeed(parseFloat(e.target.value));
                                                                                }
                                                                                return s;
                                                                            })
                                                                        );
                                                                    }}
                                                                    disabled={slide.getIsAudioPlaying()}
                                                                    className="modern-slider"
                                                                    style={{ width: '100%' }}
                                                                />
                                                            </div>

                                                            <div className="input-group" style={{ 
                                                                flex: 1,
                                                                backgroundColor: 'rgba(30, 30, 46, 0.3)',
                                                                padding: '12px',
                                                                borderRadius: '10px',
                                                                border: '1px solid rgba(99, 102, 241, 0.2)'
                                                            }}>
                                                                <label style={{ 
                                                                    color: '#e0e7ff', 
                                                                    fontSize: '12px', 
                                                                    fontWeight: '600',
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    marginBottom: '6px' 
                                                                }}>
                                                                    <span>⏱️ Gap</span>
                                                                    <span style={{ color: '#818cf8' }}>{slide.getPlaybackGap().toFixed(2)}s</span>
                                                                </label>
                                                                <input
                                                                    type="range"
                                                                    min="0"
                                                                    max="0.5"
                                                                    step="0.05"
                                                                    value={slide.getPlaybackGap()}
                                                                    onChange={(e) => {
                                                                        setSlides(prevSlides => 
                                                                            prevSlides.map(s => {
                                                                                if (s.getId() === slide.getId()) {
                                                                                    s.setPlaybackGap(parseFloat(e.target.value));
                                                                                }
                                                                                return s;
                                                                            })
                                                                        );
                                                                    }}
                                                                    disabled={slide.getIsAudioPlaying()}
                                                                    className="modern-slider"
                                                                    style={{ width: '100%' }}
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Generate/Play/Stop/Clear Controls - Modern Buttons */}
                                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                                            {/* Generate Button */}
                                                            <button
                                                                onClick={() => handleSlideGenerateAudioChunks(slide.getId())}
                                                                disabled={slide.getIsGenerating() || slide.getIsAudioPlaying() || !slide.getInputText().trim() || slide.getSpeakerId() === 'default'}
                                                                style={{
                                                                    flex: '1 1 calc(50% - 4px)',
                                                                    background: slide.getIsGenerating() || slide.getIsAudioPlaying() || !slide.getInputText().trim() || slide.getSpeakerId() === 'default'
                                                                        ? 'rgba(107, 114, 128, 0.5)'
                                                                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    borderRadius: '10px',
                                                                    padding: '12px 16px',
                                                                    fontSize: '13px',
                                                                    fontWeight: '600',
                                                                    cursor: slide.getIsGenerating() || slide.getIsAudioPlaying() || !slide.getInputText().trim() ? 'not-allowed' : 'pointer',
                                                                    transition: 'all 0.3s',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    gap: '6px',
                                                                    boxShadow: slide.getIsGenerating() ? 'none' : '0 4px 6px -1px rgba(102, 126, 234, 0.4)'
                                                                }}
                                                            >
                                                                <FaMicrophone />
                                                                {slide.getIsGenerating() ? 'Đang tạo...' : '🎵 Tạo Chunks'}
                                                            </button>

                                                            {/* Play Button */}
                                                            <button
                                                                onClick={() => handleSlidePlayAccumulatedAudio(slide.getId())}
                                                                disabled={slide.getIsAudioPlaying() || slide.getAudioChunks().length === 0 || slide.getIsGenerating()}
                                                                style={{
                                                                    flex: '1 1 calc(50% - 4px)',
                                                                    background: (slide.getIsAudioPlaying() || slide.getAudioChunks().length === 0 || slide.getIsGenerating())
                                                                        ? 'rgba(107, 114, 128, 0.5)'
                                                                        : 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    borderRadius: '10px',
                                                                    padding: '12px 16px',
                                                                    fontSize: '13px',
                                                                    fontWeight: '600',
                                                                    cursor: (slide.getIsAudioPlaying() || slide.getAudioChunks().length === 0) ? 'not-allowed' : 'pointer',
                                                                    transition: 'all 0.3s',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    gap: '6px',
                                                                    boxShadow: slide.getIsAudioPlaying() ? 'none' : '0 4px 6px -1px rgba(16, 185, 129, 0.4)'
                                                                }}
                                                            >
                                                                <FaPlay size={12} />
                                                                {slide.getIsAudioPlaying() ? '▶️ Đang phát...' : `▶️ Phát (${slide.getAudioChunks().length})`}
                                                            </button>

                                                            {/* Stop Button */}
                                                            <button
                                                                onClick={() => handleSlideStopAccumulatedAudio(slide.getId())}
                                                                disabled={!slide.getIsAudioPlaying()}
                                                                style={{
                                                                    flex: '1 1 calc(50% - 4px)',
                                                                    background: !slide.getIsAudioPlaying()
                                                                        ? 'rgba(107, 114, 128, 0.3)'
                                                                        : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                                                    color: 'white',
                                                                    border: '1px solid rgba(245, 87, 108, 0.3)',
                                                                    borderRadius: '10px',
                                                                    padding: '10px 14px',
                                                                    fontSize: '12px',
                                                                    fontWeight: '600',
                                                                    cursor: !slide.getIsAudioPlaying() ? 'not-allowed' : 'pointer',
                                                                    transition: 'all 0.3s',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    gap: '6px',
                                                                    opacity: !slide.getIsAudioPlaying() ? 0.5 : 1
                                                                }}
                                                            >
                                                                <FaPause size={11} />
                                                                ⏸️ Dừng
                                                            </button>

                                                            {/* Clear Button */}
                                                            <button
                                                                onClick={() => handleSlideClearAudioChunks(slide.getId())}
                                                                disabled={slide.getAudioChunks().length === 0 || slide.getIsAudioPlaying() || slide.getIsGenerating()}
                                                                style={{
                                                                    flex: '1 1 calc(50% - 4px)',
                                                                    background: (slide.getAudioChunks().length === 0 || slide.getIsAudioPlaying() || slide.getIsGenerating())
                                                                        ? 'rgba(107, 114, 128, 0.3)'
                                                                        : 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                                                                    color: 'white',
                                                                    border: '1px solid rgba(251, 191, 36, 0.3)',
                                                                    borderRadius: '10px',
                                                                    padding: '10px 14px',
                                                                    fontSize: '12px',
                                                                    fontWeight: '600',
                                                                    cursor: (slide.getAudioChunks().length === 0 || slide.getIsAudioPlaying()) ? 'not-allowed' : 'pointer',
                                                                    transition: 'all 0.3s',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    gap: '6px',
                                                                    opacity: (slide.getAudioChunks().length === 0 || slide.getIsAudioPlaying()) ? 0.5 : 1
                                                                }}
                                                            >
                                                                <FaTimes size={11} />
                                                                🗑️ Xóa
                                                            </button>
                                                        </div>

                                                        {/* Status Display - Modern Card */}
                                                        <div style={{
                                                            padding: '14px',
                                                            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
                                                            borderRadius: '12px',
                                                            border: '1px solid rgba(139, 92, 246, 0.25)',
                                                            marginBottom: '14px',
                                                            backdropFilter: 'blur(10px)'
                                                        }}>
                                                            <div style={{ 
                                                                marginBottom: '10px', 
                                                                color: '#e0e7ff', 
                                                                fontSize: '13px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '8px',
                                                                fontWeight: '600'
                                                            }}>
                                                                <span style={{ 
                                                                    width: '8px', 
                                                                    height: '8px', 
                                                                    borderRadius: '50%', 
                                                                    backgroundColor: slide.getIsGenerating() ? '#fbbf24' : slide.getIsAudioPlaying() ? '#10b981' : '#818cf8',
                                                                    animation: slide.getIsGenerating() || slide.getIsAudioPlaying() ? 'pulse 2s infinite' : 'none'
                                                                }} />
                                                                📊 {slide.getAudioStatus() || 'Sẵn sàng'}
                                                            </div>
                                                            
                                                            {/* Generation Progress - Modern */}
                                                            {slide.getGenerationProgress().total > 0 && (
                                                                <div style={{ marginBottom: '10px' }}>
                                                                    <div style={{ 
                                                                        color: '#c7d2fe', 
                                                                        fontSize: '11px', 
                                                                        marginBottom: '6px',
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        fontWeight: '500'
                                                                    }}>
                                                                        <span>🎨 Tạo chunks</span>
                                                                        <span style={{ color: '#818cf8' }}>{slide.getGenerationProgress().current}/{slide.getGenerationProgress().total}</span>
                                                                    </div>
                                                                    <div style={{
                                                                        width: '100%',
                                                                        height: '8px',
                                                                        backgroundColor: 'rgba(55, 65, 81, 0.5)',
                                                                        borderRadius: '10px',
                                                                        overflow: 'hidden',
                                                                        position: 'relative'
                                                                    }}>
                                                                        <div style={{
                                                                            width: `${(slide.getGenerationProgress().current / slide.getGenerationProgress().total) * 100}%`,
                                                                            height: '100%',
                                                                            background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                                                                            transition: 'width 0.3s ease',
                                                                            borderRadius: '10px',
                                                                            boxShadow: '0 0 10px rgba(102, 126, 234, 0.5)'
                                                                        }} />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            
                                                            {/* Playback Progress - Modern */}
                                                            {slide.getPlaybackProgress().total > 0 && (
                                                                <div>
                                                                    <div style={{ 
                                                                        color: '#c7d2fe', 
                                                                        fontSize: '11px', 
                                                                        marginBottom: '6px',
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        fontWeight: '500'
                                                                    }}>
                                                                        <span>▶️ Đang phát</span>
                                                                        <span style={{ color: '#34d399' }}>{slide.getPlaybackProgress().current}/{slide.getPlaybackProgress().total}</span>
                                                                    </div>
                                                                    <div style={{
                                                                        width: '100%',
                                                                        height: '8px',
                                                                        backgroundColor: 'rgba(55, 65, 81, 0.5)',
                                                                        borderRadius: '10px',
                                                                        overflow: 'hidden',
                                                                        position: 'relative'
                                                                    }}>
                                                                        <div style={{
                                                                            width: `${(slide.getPlaybackProgress().current / slide.getPlaybackProgress().total) * 100}%`,
                                                                            height: '100%',
                                                                            background: 'linear-gradient(90deg, #11998e 0%, #38ef7d 100%)',
                                                                            transition: 'width 0.3s ease',
                                                                            borderRadius: '10px',
                                                                            boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)'
                                                                        }} />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Individual Chunk List - Modern Pills */}
                                                        {slide.getAudioChunks().length > 0 && (
                                                            <div style={{
                                                                background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%)',
                                                                padding: '12px',
                                                                borderRadius: '12px',
                                                                border: '1px solid rgba(99, 102, 241, 0.2)'
                                                            }}>
                                                                <div style={{ 
                                                                    color: '#e0e7ff', 
                                                                    fontSize: '12px', 
                                                                    fontWeight: '600',
                                                                    marginBottom: '10px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px'
                                                                }}>
                                                                    🎵 Audio Chunks
                                                                    <span style={{ 
                                                                        backgroundColor: 'rgba(99, 102, 241, 0.3)',
                                                                        padding: '2px 8px',
                                                                        borderRadius: '12px',
                                                                        fontSize: '11px',
                                                                        color: '#c7d2fe'
                                                                    }}>
                                                                        {slide.getAudioChunks().length}
                                                                    </span>
                                                                </div>
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                                    {slide.getAudioChunks().map((chunk: any, idx: number) => (
                                                                        <button
                                                                            key={idx}
                                                                            onClick={() => playSlideIndividualChunk(slide.getId(), chunk)}
                                                                            disabled={slide.getIsAudioPlaying()}
                                                                            style={{
                                                                                padding: '6px 14px',
                                                                                background: slide.getIsAudioPlaying() 
                                                                                    ? 'rgba(75, 85, 99, 0.5)' 
                                                                                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                                                color: 'white',
                                                                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                                                                borderRadius: '20px',
                                                                                cursor: slide.getIsAudioPlaying() ? 'not-allowed' : 'pointer',
                                                                                fontSize: '11px',
                                                                                fontWeight: '600',
                                                                                transition: 'all 0.3s',
                                                                                boxShadow: slide.getIsAudioPlaying() ? 'none' : '0 2px 4px rgba(102, 126, 234, 0.3)',
                                                                                opacity: slide.getIsAudioPlaying() ? 0.6 : 1
                                                                            }}
                                                                            onMouseOver={(e) => {
                                                                                if (!slide.getIsAudioPlaying()) {
                                                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                                                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.4)';
                                                                                }
                                                                            }}
                                                                            onMouseOut={(e) => {
                                                                                if (!slide.getIsAudioPlaying()) {
                                                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(102, 126, 234, 0.3)';
                                                                                }
                                                                            }}
                                                                        >
                                                                            🎶 #{idx + 1}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Cột 4: Upload Audio */}
                                                <div className="col-audio">
                                                    <div className="audio-upload-container">
                                                        <input
                                                            type="file"
                                                            accept="audio/*"
                                                            onChange={(e) => handleSlideAudioUpload(slide.getId(), e)}
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
                                                        
                                                        {slide.getAudioUrl() && (
                                                            <div className="uploaded-audio-info">
                                                                <FaMusic className="audio-icon" />
                                                                <span>Audio đã tải</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
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


