// Variables globales
let model = null;
let video = null;
let canvas = null;
let ctx = null;
let isDetecting = false;
let detectionInterval = null;
let startTime = null;
let alertSound = null;

// Estados del conductor
const DRIVER_STATES = {
    AWAKE: 'awake',
    SLEEPY: 'sleepy', 
    ASLEEP: 'asleep',
    UNKNOWN: 'unknown'
};

// Configuración del modelo Teachable Machine
const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/iH_13-Je9/';

// Inicialización cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    setupEventListeners();
    loadModel();
    createAlertSound();
});

function initializeElements() {
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
}

function setupEventListeners() {
    document.getElementById('startBtn').addEventListener('click', startDetection);
    document.getElementById('stopBtn').addEventListener('click', stopDetection);
    document.getElementById('captureBtn').addEventListener('click', capturePhoto);
    document.getElementById('brakeBtn').addEventListener('click', emergencyBrake);
    document.getElementById('analyzeBtn').addEventListener('click', analyzeDriver);
    document.getElementById('emergencyBrake').addEventListener('click', emergencyBrake);
}

// Cargar modelo de Teachable Machine
async function loadModel() {
    try {
        showAnalysisEffect('Cargando modelo de IA...');
        
        // Simulación de carga del modelo (en producción usarías el modelo real)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        model = {
            predict: async (imageData) => {
                // Simulación de predicción del modelo
                const random = Math.random();
                if (random < 0.3) {
                    return [{ className: 'Ojos Cerrados', probability: 0.8 }];
                } else {
                    return [{ className: 'Ojos Abiertos', probability: 0.9 }];
                }
            }
        };
        
        hideAnalysisEffect();
        updateStatus('Modelo cargado correctamente', 'awake');
        enableControls();
        
    } catch (error) {
        console.error('Error cargando modelo:', error);
        updateStatus('Error cargando modelo', 'unknown');
        hideAnalysisEffect();
    }
}

// Iniciar detección
async function startDetection() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: 640, 
                height: 480,
                facingMode: 'user'
            } 
        });
        
        video.srcObject = stream;
        video.play();
        
        isDetecting = true;
        startTime = Date.now();
        
        // Actualizar controles
        document.getElementById('startBtn').disabled = true;
        document.getElementById('stopBtn').disabled = false;
        document.getElementById('captureBtn').disabled = false;
        document.getElementById('brakeBtn').disabled = false;
        document.getElementById('analyzeBtn').disabled = false;
        
        // Iniciar detección en tiempo real
        startRealTimeDetection();
        updateActiveTime();
        
        updateStatus('Detección iniciada', 'awake');
        
    } catch (error) {
        console.error('Error accediendo a la cámara:', error);
        updateStatus('Error accediendo a la cámara', 'unknown');
    }
}

// Detener detección
function stopDetection() {
    isDetecting = false;
    
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
    
    if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }
    
    // Actualizar controles
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('captureBtn').disabled = true;
    document.getElementById('brakeBtn').disabled = true;
    document.getElementById('analyzeBtn').disabled = true;
    
    updateStatus('Detección detenida', 'unknown');
    hideAlert();
}

// Detección en tiempo real
function startRealTimeDetection() {
    detectionInterval = setInterval(async () => {
        if (!isDetecting || !model) return;
        
        try {
            const prediction = await predictDriverState();
            handleDriverState(prediction);
        } catch (error) {
            console.error('Error en detección:', error);
        }
    }, 1000); // Detectar cada segundo
}

// Predecir estado del conductor
async function predictDriverState() {
    if (!video || !model) return null;
    
    // Capturar frame del video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    
    // Simular predicción del modelo
    const prediction = await model.predict(imageData);
    
    return prediction;
}

// Manejar estado del conductor
function handleDriverState(prediction) {
    if (!prediction || prediction.length === 0) return;
    
    const result = prediction[0];
    const isEyesClosed = result.className === 'Ojos Cerrados';
    const confidence = result.probability;
    
    let driverState;
    let statusText;
    
    if (isEyesClosed && confidence > 0.7) {
        driverState = DRIVER_STATES.ASLEEP;
        statusText = 'CONDUCTOR DORMIDO';
        showAlert();
        playAlertSound();
    } else if (isEyesClosed && confidence > 0.4) {
        driverState = DRIVER_STATES.SLEEPY;
        statusText = 'CONDUCTOR SOMNOLIENTO';
    } else {
        driverState = DRIVER_STATES.AWAKE;
        statusText = 'CONDUCTOR DESPIERTO';
        hideAlert();
    }
    
    updateDriverStatus(driverState, statusText, confidence);
}

// Actualizar estado del conductor
function updateDriverStatus(state, text, confidence) {
    const statusLight = document.querySelector('.status-light');
    const statusText = document.getElementById('statusText');
    const driverStatus = document.getElementById('driverStatus');
    const confidenceElement = document.getElementById('confidence');
    
    // Actualizar indicador visual
    statusLight.className = 'status-light ' + state;
    statusText.textContent = text;
    driverStatus.textContent = text;
    driverStatus.className = 'driver-' + state;
    confidenceElement.textContent = Math.round(confidence * 100) + '%';
    
    // Actualizar colores según estado
    if (state === DRIVER_STATES.ASLEEP) {
        statusLight.style.background = '#f44336';
    } else if (state === DRIVER_STATES.SLEEPY) {
        statusLight.style.background = '#ff9800';
    } else {
        statusLight.style.background = '#4CAF50';
    }
}

// Mostrar alerta de emergencia
function showAlert() {
    const alertBox = document.getElementById('alertBox');
    alertBox.classList.remove('hidden');
    
    // Efecto de sonido visual
    createSoundWaveEffect();
}

// Ocultar alerta
function hideAlert() {
    const alertBox = document.getElementById('alertBox');
    alertBox.classList.add('hidden');
}

// Crear efecto de ondas de sonido
function createSoundWaveEffect() {
    const cameraContainer = document.querySelector('.camera-container');
    const soundWave = document.createElement('div');
    soundWave.className = 'sound-wave';
    cameraContainer.appendChild(soundWave);
    
    setTimeout(() => {
        soundWave.remove();
    }, 1000);
}

// Tomar foto/video
function capturePhoto() {
    if (!video || !isDetecting) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    // Crear enlace de descarga
    const link = document.createElement('a');
    link.download = 'captura_somnolencia_' + new Date().getTime() + '.jpg';
    link.href = canvas.toDataURL('image/jpeg', 0.9);
    link.click();
    
    showAnalysisEffect('Foto capturada y guardada');
    setTimeout(hideAnalysisEffect, 2000);
}

// Análisis manual
function analyzeDriver() {
    if (!isDetecting) return;
    
    showAnalysisEffect('Analizando estado del conductor...');
    
    setTimeout(async () => {
        const prediction = await predictDriverState();
        if (prediction) {
            handleDriverState(prediction);
        }
        hideAnalysisEffect();
    }, 2000);
}

// Frenado de emergencia
function emergencyBrake() {
    showAnalysisEffect('¡FRENANDO VEHÍCULO!');
    
    // Simular frenado
    setTimeout(() => {
        hideAnalysisEffect();
        updateStatus('Frenado de emergencia activado', 'asleep');
    }, 3000);
}

// Crear sonido de alerta
function createAlertSound() {
    // Crear contexto de audio para generar sonido de alerta
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    alertSound = {
        play: () => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        }
    };
}

// Reproducir sonido de alerta
function playAlertSound() {
    if (alertSound) {
        alertSound.play();
    }
}

// Mostrar efecto de análisis
function showAnalysisEffect(message = 'Analizando...') {
    const effect = document.getElementById('analysisEffect');
    const text = effect.querySelector('p');
    text.textContent = message;
    effect.classList.remove('hidden');
}

// Ocultar efecto de análisis
function hideAnalysisEffect() {
    const effect = document.getElementById('analysisEffect');
    effect.classList.add('hidden');
}

// Actualizar estado general
function updateStatus(message, state) {
    const statusText = document.getElementById('statusText');
    statusText.textContent = message;
    
    const statusLight = document.querySelector('.status-light');
    statusLight.className = 'status-light ' + state;
}

// Habilitar controles
function enableControls() {
    document.getElementById('startBtn').disabled = false;
}

// Actualizar tiempo activo
function updateActiveTime() {
    if (!isDetecting || !startTime) return;
    
    const now = Date.now();
    const elapsed = Math.floor((now - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('activeTime').textContent = timeString;
    
    if (isDetecting) {
        setTimeout(updateActiveTime, 1000);
    }
}

// Manejar errores globales
window.addEventListener('error', function(e) {
    console.error('Error global:', e.error);
    updateStatus('Error en la aplicación', 'unknown');
});

// Manejar cuando la página se oculta/muestra
document.addEventListener('visibilitychange', function() {
    if (document.hidden && isDetecting) {
        updateStatus('Aplicación en segundo plano', 'sleepy');
    } else if (!document.hidden && isDetecting) {
        updateStatus('Detección activa', 'awake');
    }
});
