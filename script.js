let currentSlideIndex = 0;
let slides = [];
let videoElements = {};
let currentVideoElement = null;
const transitionDuration = 300; // Transition duration in milliseconds
let loadedTracks = []; // To store loaded tracks from JSON files
let currentTrackIndex = 0; // To keep track of the current track index
let socket;
let currentSongListFile = null; // To store the current song list file
let isLoadingSongs = false; // Loading state for songs
let isTransitioning = false; // Transition state for slides

document.addEventListener('DOMContentLoaded', () => {
    initializeWebSocket();
    loadSongLists(); // 加载歌曲列表

    // 添加按钮事件监听器
    document.getElementById('up-button').addEventListener('click', throttle((event) => {
        event.stopPropagation(); // 阻止事件冒泡
        handlePreviousTrack();
    }, 500));

    document.getElementById('down-button').addEventListener('click', throttle((event) => {
        event.stopPropagation(); // 阻止事件冒泡
        handleNextTrack();
    }, 500));

    document.getElementById('left-button').addEventListener('click', throttle((event) => {
        event.stopPropagation(); // 阻止事件冒泡
        handlePreviousSlide();
    }, 500));

    document.getElementById('right-button').addEventListener('click', throttle((event) => {
        event.stopPropagation(); // 阻止事件冒泡
        handleNextSlide();
    }, 500));

    // 添加单击事件监听器到整个body，但排除按钮和选择框
    document.body.addEventListener('click', throttle((event) => {
        const isButton = event.target.nodeName === 'BUTTON';
        const isSelect = event.target.nodeName === 'SELECT';
        if (!isButton && !isSelect) {
            handleNextSlide();
        }
    }, 500));
});

function initializeWebSocket() {
    socket = new WebSocket('ws://localhost:8080');

    socket.onopen = () => {
        console.log('WebSocket connection established');
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const newState = data.state;
        if (data.type === 'init' || data.type === 'update') {
            if (newState.currentSongListFile !== currentSongListFile) {
                currentSongListFile = newState.currentSongListFile;
                loadSongs(currentSongListFile);
            }
            if (newState.currentTrackIndex !== currentTrackIndex) {
                currentTrackIndex = newState.currentTrackIndex;
                loadTrack(loadedTracks[currentTrackIndex]);
            }
            if (newState.currentSlideIndex !== currentSlideIndex) {
                showSlide(newState.currentSlideIndex);
            }
        }
    };

    socket.onclose = () => {
        console.log('WebSocket connection closed');
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

function loadSelectedTrack() {
    const trackListSelector = document.getElementById('trackListSelector');
    const selectedTrackIndex = trackListSelector.value;

    const selectedTrack = loadedTracks[selectedTrackIndex];
    if (selectedTrack) {
        currentTrackIndex = selectedTrackIndex; // 更新当前歌曲索引
        loadTrack(selectedTrack); // 加载选择的歌曲
        updateTrackListSelector(); // 更新歌曲选择器显示
        sendUpdate({ currentSongListFile, currentTrackIndex, currentSlideIndex }); // 发送更新消息
    }
    trackListSelector.blur();  // 失去焦点
}

function handleNextSlide() {
    if (isTransitioning) return;
    currentSlideIndex = (currentSlideIndex + 1) % slides.length;
    showSlide(currentSlideIndex);
}

function handlePreviousSlide() {
    if (isTransitioning) return;
    currentSlideIndex = (currentSlideIndex - 1 + slides.length) % slides.length;
    showSlide(currentSlideIndex);
}

function handleNextTrack() {
    currentTrackIndex = (currentTrackIndex + 1) % loadedTracks.length;
    loadTrack(loadedTracks[currentTrackIndex]);
    updateTrackListSelector();
}

function handlePreviousTrack() {
    currentTrackIndex = (currentTrackIndex - 1 + loadedTracks.length) % loadedTracks.length;
    loadTrack(loadedTracks[currentTrackIndex]);
    updateTrackListSelector();
}

function sendUpdate(state) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'update', state }));
    }
}

function loadSongLists() {
    fetch('songlist.json')
        .then(response => response.json())
        .then(data => {
            const songListSelector = document.getElementById('songListSelector');
            
            // 清空现有选项
            songListSelector.innerHTML = "";

            data.songlists.forEach((songlist, index) => {
                const option = document.createElement('option');
                option.value = songlist.file;
                option.textContent = songlist.displayText;
                songListSelector.appendChild(option);
                console.log('Track List Created');
            });

            // Load the first song list by default
            if (data.songlists.length > 0) {
                currentSongListFile = data.songlists[0].file; // 更新currentSongListFile
                loadSongs(data.songlists[0].file);
            }
        })
        .catch(error => console.error('Error loading song lists:', error));
}

function loadSongs(songsFile) {
    if (isLoadingSongs) return;
    isLoadingSongs = true;

    fetch(songsFile)
        .then(response => response.json())
        .then(data => {
            const trackListSelector = document.getElementById('trackListSelector');
            trackListSelector.innerHTML = ""; // Clear previous options

            // Load each song JSON file listed in the songsFile
            loadedTracks = []; // Clear previously loaded tracks
            let promises = data.songs.map(songFile => fetch(songFile).then(response => response.json()));

            Promise.all(promises).then(songDataArray => {
                songDataArray.forEach((songData, index) => {
                    loadedTracks.push(songData);
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = songData.title;
                    trackListSelector.appendChild(option);
                });

                if (loadedTracks.length > 0) {
                    // Preserve current track and slide indices if possible
                    currentTrackIndex = Math.min(currentTrackIndex, loadedTracks.length - 1);
                    loadTrack(loadedTracks[currentTrackIndex]);
                    updateTrackListSelector();
                }
                isLoadingSongs = false;
            }).catch(error => {
                console.error('Error loading song data:', error);
                isLoadingSongs = false;
            });
        })
        .catch(error => {
            console.error('Error loading songs:', error);
            isLoadingSongs = false;
        });
}

function loadTrack(song) {
    slides = [];
    const contentDiv = document.getElementById('content');
    const videosContainer = document.getElementById('videos-container');
    
    // Stop and remove previous video elements
    for (const videoKey in videoElements) {
        if (videoElements[videoKey]) {
            videoElements[videoKey].pause(); // Stop the video
            videosContainer.removeChild(videoElements[videoKey]); // Remove from DOM
        }
    }
    
    videoElements = {};
    currentVideoElement = null;

    song.slides.forEach((slide, index) => {
        slides.push({
            ...slide,
            id: 'slide' + (slides.length + index + 1),
            background: song.background,
        });

        if (!videoElements[song.background]) {
            const video = document.createElement('video');
            video.src = song.background;
            video.className = 'background-video';
            video.autoplay = false;
            video.loop = true;
            video.muted = true;
            videoElements[song.background] = video;
            videosContainer.appendChild(video);
        }
    });

    while (contentDiv.firstChild) {
        contentDiv.removeChild(contentDiv.firstChild);
    }

    slides.forEach(slide => {
        const slideDiv = document.createElement('div');
        slideDiv.id = slide.id;
        slideDiv.className = 'slide';
        slideDiv.dataset.background = slide.background;

        const title = document.createElement('h2');
        title.className = 'title';
        title.innerHTML = slide.title;

        const lyricsContainer = document.createElement('div');
        lyricsContainer.className = 'lyrics-container';

        const lyrics = document.createElement('p');
        lyrics.className = 'lyrics';
        lyrics.innerHTML = slide.lyrics;

        slideDiv.appendChild(title);
        lyricsContainer.appendChild(lyrics);
        slideDiv.appendChild(lyricsContainer);
        contentDiv.appendChild(slideDiv);
    });

    currentSlideIndex = 0; // Reset slide index
    showSlide(currentSlideIndex);
    updateSlideNavigation();
    sendUpdate({ currentSongListFile, currentTrackIndex, currentSlideIndex }); // Sync state after loading track
}


function showSlide(index) {
    if (isTransitioning) return;
    isTransitioning = true;

    const allSlides = document.getElementsByClassName('slide');
    const previousSlide = document.querySelector('.slide.active');
    const nextSlide = allSlides[index];

    if (previousSlide) {
        previousSlide.classList.remove('active');
        previousSlide.classList.add('fade-out');
        previousSlide.addEventListener('transitionend', function onTransitionEnd() {
            previousSlide.classList.remove('fade-out');
            previousSlide.style.display = 'none';
            previousSlide.removeEventListener('transitionend', onTransitionEnd);
        });
    }

    if (nextSlide) {
        nextSlide.style.display = 'flex';
        setTimeout(() => {
            nextSlide.classList.add('active');
        }, 20); // Delay to ensure CSS changes are applied
    }

    const newBackground = nextSlide.dataset.background;
    if (currentVideoElement) {
        currentVideoElement.pause();
        currentVideoElement.style.display = 'none';
    }
    currentVideoElement = videoElements[newBackground];
    if (currentVideoElement) {
        currentVideoElement.style.display = 'block';
        currentVideoElement.play();
    }

    currentSlideIndex = index;
    sendUpdate({ currentSongListFile, currentTrackIndex, currentSlideIndex }); // Sync state after showing slide

    setTimeout(() => {
        isTransitioning = false;
    }, transitionDuration);

    updateSlideNavigation(); // Update slide navigation
}

function updateSlideNavigation() {
    const navigationDiv = document.getElementById('slide-navigation');
    navigationDiv.innerHTML = ''; // 清空现有的导航内容

    slides.forEach((slide, index) => {
        const slideButton = document.createElement('button'); // 改为button元素
        slideButton.className = 'slide-nav-button';
        slideButton.innerText = slide.title;
        slideButton.style.margin = '0 5px';
        slideButton.style.cursor = 'pointer';
        slideButton.style.padding = '5px 10px';
        slideButton.style.borderRadius = '5px';

        // 设置当前活动的幻灯片按钮的样式，并禁用其点击事件
        if (index === currentSlideIndex) {
            slideButton.classList.add('active-slide-nav-button');
            slideButton.disabled = true; // 禁用当前幻灯片的按钮
            slideButton.style.cursor = 'default'; // 鼠标指针设为默认状态
        } else {
            // 为非活动幻灯片按钮添加点击事件监听器
            slideButton.addEventListener('click', () => {
                showSlide(index); // 切换到相应的幻灯片
            });
        }

        navigationDiv.appendChild(slideButton);
    });
}



function loadSelectedSongs() {
    const selector = document.getElementById('songListSelector');
    const selectedFile = selector.value;
    console.log(`Selected song list: ${selectedFile}`);
    currentSongListFile = selectedFile; // Update currentSongListFile
    loadSongs(selectedFile);
    selector.blur();  // 失去焦点
    sendUpdate({ currentSongListFile, currentTrackIndex, currentSlideIndex }); // Sync state after loading song list
}

document.addEventListener('keydown', throttle(function(event) {
    if (event.key === 'ArrowRight') {
        handleNextSlide();
    } else if (event.key === 'ArrowLeft') {
        handlePreviousSlide();
    } else if (event.key === 'ArrowUp') {
        handlePreviousTrack();
    } else if (event.key === 'ArrowDown') {
        handleNextTrack();
    }
}, 500));

function updateTrackListSelector() {
    const trackListSelector = document.getElementById('trackListSelector');
    trackListSelector.value = currentTrackIndex;
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

