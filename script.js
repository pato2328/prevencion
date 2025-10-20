// Variables globales
let model = null;
let video = null;
let canvas = null;
let ctx = null;
let isDetecting = false;
let detectionInterval = null;
let startTime = null;
let alertSound = null;
let alertConfig = {
    email: '',
    driverName: '',
    vehicleInfo: ''
};
let alertsSent = 0;
let lastAlertTime = 0;

// Estados del conductor
const DRIVER_STATES = {
    AWAKE: 'awake',
    SLEEPY: 'sleepy', 
    ASLEEP: 'asleep',
    UNKNOWN: 'unknown'
};

// Configuración del modelo Teachable Machine
const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/iH_13-Je9/';

// Configuración de Formspree
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mrbykegq';

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
    document.getElementById('saveConfigBtn').addEventListener('click', saveAlertConfig);
    document.getElementById('testAlertBtn').addEventListener('click', sendTestAlert);
    document.getElementById('diagnoseBtn').addEventListener('click', diagnoseEmailSystem);
    
    // Cargar configuración guardada
    loadAlertConfig();
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
    hideAutoDetectionIndicator();
}

// Detección en tiempo real
function startRealTimeDetection() {
    // Detectar cada 500ms para mayor sensibilidad
    detectionInterval = setInterval(async () => {
        if (!isDetecting || !model) return;
        
        try {
            const prediction = await predictDriverState();
            handleDriverState(prediction);
        } catch (error) {
            console.error('Error en detección:', error);
        }
    }, 500); // Detectar cada 500ms para mayor sensibilidad
    
    // Mostrar indicador de detección automática
    showAutoDetectionIndicator();
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
        
        // Actualizar indicador de detección automática
        updateAutoDetectionIndicator(true);
        
        // Enviar alerta por email si está configurado
        sendEmailAlertWithFallback(driverState, confidence);
        
    } else if (isEyesClosed && confidence > 0.4) {
        driverState = DRIVER_STATES.SLEEPY;
        statusText = 'CONDUCTOR SOMNOLIENTO';
        updateAutoDetectionIndicator(false);
    } else {
        driverState = DRIVER_STATES.AWAKE;
        statusText = 'CONDUCTOR DESPIERTO';
        hideAlert();
        updateAutoDetectionIndicator(false);
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

// ===== FUNCIONES DE CONFIGURACIÓN DE ALERTAS =====

// Guardar configuración de alertas
function saveAlertConfig() {
    const email = document.getElementById('emailInput').value.trim();
    const driverName = document.getElementById('driverName').value.trim();
    const vehicleInfo = document.getElementById('vehicleInfo').value.trim();
    
    if (!email || !driverName) {
        alert('Por favor, completa al menos el email y el nombre del conductor');
        return;
    }
    
    alertConfig = {
        email: email,
        driverName: driverName,
        vehicleInfo: vehicleInfo
    };
    
    // Guardar en localStorage
    localStorage.setItem('alertConfig', JSON.stringify(alertConfig));
    
    showAnalysisEffect('Configuración guardada correctamente');
    setTimeout(hideAnalysisEffect, 2000);
}

// Cargar configuración de alertas
function loadAlertConfig() {
    const saved = localStorage.getItem('alertConfig');
    if (saved) {
        alertConfig = JSON.parse(saved);
        document.getElementById('emailInput').value = alertConfig.email || '';
        document.getElementById('driverName').value = alertConfig.driverName || '';
        document.getElementById('vehicleInfo').value = alertConfig.vehicleInfo || '';
    }
}

// Enviar alerta por email usando Formspree
async function sendEmailAlert(driverState, confidence) {
    // Reducir tiempo de espera entre alertas a 10 segundos para mayor sensibilidad
    const now = Date.now();
    if (now - lastAlertTime < 10000) {
        console.log('Alerta bloqueada: muy reciente (esperando 10 segundos)');
        return;
    }
    
    if (!alertConfig.email) {
        console.log('No hay email configurado para alertas');
        showAnalysisEffect('⚠️ Configura tu email para recibir alertas');
        setTimeout(hideAnalysisEffect, 3000);
        return;
    }
    
    try {
        const timestamp = new Date().toLocaleString('es-ES');
        const confidencePercent = Math.round(confidence * 100);
        
        // Formspree requiere FormData con campos específicos
        const formData = new FormData();
        formData.append('_subject', `🚨 ALERTA CRÍTICA - CONDUCTOR DORMIDO DETECTADO`);
        formData.append('_replyto', alertConfig.email);
        formData.append('_cc', alertConfig.email);
        
        // Campos principales para el email
        formData.append('nombre_conductor', alertConfig.driverName || 'Conductor No Identificado');
        formData.append('vehiculo', alertConfig.vehicleInfo || 'No especificado');
        formData.append('tipo_alerta', 'DETECCIÓN DE OJOS CERRADOS');
        formData.append('nivel_confianza', `${confidencePercent}%`);
        formData.append('fecha_hora', timestamp);
        formData.append('ubicacion', 'Sistema de Detección de Somnolencia');
        
        // Mensaje principal
        const mensajePrincipal = `🚨 ALERTA DE SEGURIDAD VIAL 🚨

Se ha detectado que el conductor ${alertConfig.driverName || 'No Identificado'} tiene los ojos cerrados con una confianza del ${confidencePercent}%.

INFORMACIÓN DE LA DETECCIÓN:
- Conductor: ${alertConfig.driverName || 'No Identificado'}
- Vehículo: ${alertConfig.vehicleInfo || 'No especificado'}
- Confianza: ${confidencePercent}%
- Fecha y Hora: ${timestamp}
- Tipo: DETECCIÓN DE OJOS CERRADOS

⚠️ ACCIÓN INMEDIATA REQUERIDA ⚠️
Este conductor puede estar experimentando somnolencia o fatiga al volante, lo que representa un grave riesgo de accidente.

ACCIONES RECOMENDADAS:
1. Contactar al conductor INMEDIATAMENTE
2. Sugerir parada de descanso URGENTE
3. Verificar estado físico del conductor
4. Si es necesario, activar protocolo de emergencia

Sistema: PREVENCIÓN - Detector de Somnolencia
Navegador: ${navigator.userAgent}
URL: ${window.location.href}

Esta es una alerta automática del sistema de detección de somnolencia.`;
        
        formData.append('mensaje', mensajePrincipal);
        formData.append('acciones_emergencia', '1. Contactar al conductor inmediatamente\n2. Sugerir parada de descanso\n3. Verificar estado físico del conductor\n4. Si es necesario, activar protocolo de emergencia');
        
        console.log('📧 Enviando alerta de email automática...', {
            email: alertConfig.email,
            driverName: alertConfig.driverName,
            confidence: confidencePercent,
            timestamp: timestamp
        });
        
        const response = await fetch(FORMSPREE_ENDPOINT, {
            method: 'POST',
            body: formData
        });
        
        console.log('📡 Respuesta del servidor Formspree:', response.status, response.statusText);
        
        if (response.ok) {
            alertsSent++;
            lastAlertTime = now;
            updateAlertsCounter();
            
            console.log('✅ Alerta de email enviada correctamente a:', alertConfig.email);
            showAnalysisEffect('✅ Alerta enviada por email');
            setTimeout(hideAnalysisEffect, 2000);
            
            // Mostrar notificación visual adicional
            showEmailNotification();
            
        } else {
            const errorText = await response.text();
            console.error('❌ Error enviando alerta de email:', response.status, errorText);
            showAnalysisEffect('❌ Error enviando email. Usando método alternativo...');
            
            // Intentar método alternativo inmediatamente
            setTimeout(() => {
                sendEmailViaMailto(driverState, confidence);
            }, 1000);
        }
        
    } catch (error) {
        console.error('❌ Error de red enviando alerta de email:', error);
        showAnalysisEffect('❌ Error de conexión. Usando método alternativo...');
        
        // Usar método alternativo en caso de error
        setTimeout(() => {
            sendEmailViaMailto(driverState, confidence);
        }, 1000);
    }
}

// Mostrar notificación visual de email enviado
function showEmailNotification() {
    const notification = document.createElement('div');
    notification.className = 'email-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">📧</span>
            <span class="notification-text">Alerta enviada por email</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animar la notificación
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Actualizar contador de alertas
function updateAlertsCounter() {
    document.getElementById('alertsSent').textContent = alertsSent;
}

// ===== FUNCIONES ADICIONALES DE ALERTAS =====

// Enviar alerta de prueba
function sendTestAlert() {
    if (!alertConfig.email) {
        alert('Por favor, configura primero el email de emergencia');
        return;
    }
    
    console.log('🧪 Enviando alerta de prueba...');
    showAnalysisEffect('🧪 Enviando alerta de prueba...');
    
    // Forzar envío ignorando el tiempo de espera para pruebas
    const originalLastAlertTime = lastAlertTime;
    lastAlertTime = 0;
    
    sendEmailAlert(DRIVER_STATES.ASLEEP, 0.85).finally(() => {
        lastAlertTime = originalLastAlertTime;
    });
}

// Función de diagnóstico del sistema de email
function diagnoseEmailSystem() {
    console.log('🔍 DIAGNÓSTICO DEL SISTEMA DE EMAIL');
    console.log('=====================================');
    console.log('Configuración actual:', alertConfig);
    console.log('Endpoint Formspree:', FORMSPREE_ENDPOINT);
    console.log('Navegador:', navigator.userAgent);
    console.log('URL actual:', window.location.href);
    console.log('Conexión a internet:', navigator.onLine ? '✅ Conectado' : '❌ Sin conexión');
    console.log('Última alerta enviada:', new Date(lastAlertTime).toLocaleString());
    console.log('Total de alertas enviadas:', alertsSent);
    
    // Probar conectividad con Formspree
    testFormspreeConnection();
}

// Probar conexión con Formspree
async function testFormspreeConnection() {
    try {
        console.log('🌐 Probando conexión con Formspree...');
        
        const testData = new FormData();
        testData.append('_subject', 'Test de Conexión - Sistema PREVENCIÓN');
        testData.append('message', 'Esta es una prueba de conexión del sistema de detección de somnolencia.');
        testData.append('timestamp', new Date().toISOString());
        
        const response = await fetch(FORMSPREE_ENDPOINT, {
            method: 'POST',
            body: testData
        });
        
        console.log('Respuesta de prueba:', response.status, response.statusText);
        
        if (response.ok) {
            console.log('✅ Conexión con Formspree exitosa');
            showAnalysisEffect('✅ Conexión con Formspree exitosa');
        } else {
            console.log('❌ Error en conexión con Formspree:', response.status);
            showAnalysisEffect('❌ Error en conexión con Formspree');
        }
        
    } catch (error) {
        console.error('❌ Error de red:', error);
        showAnalysisEffect('❌ Error de red al conectar con Formspree');
    }
    
    setTimeout(hideAnalysisEffect, 3000);
}

// Exportar configuración de alertas
function exportAlertConfig() {
    const config = {
        ...alertConfig,
        exportDate: new Date().toISOString(),
        alertsSent: alertsSent
    };
    
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'configuracion_alertas_somnolencia.json';
    link.click();
}

// Mostrar indicador de detección automática
function showAutoDetectionIndicator() {
    // Remover indicador existente si hay uno
    hideAutoDetectionIndicator();
    
    const indicator = document.createElement('div');
    indicator.id = 'autoDetectionIndicator';
    indicator.className = 'auto-detection-indicator';
    indicator.innerHTML = '🔍 DETECCIÓN AUTOMÁTICA ACTIVA';
    
    document.body.appendChild(indicator);
}

// Ocultar indicador de detección automática
function hideAutoDetectionIndicator() {
    const indicator = document.getElementById('autoDetectionIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// Actualizar indicador de detección automática
function updateAutoDetectionIndicator(isAlert = false) {
    const indicator = document.getElementById('autoDetectionIndicator');
    if (indicator) {
        if (isAlert) {
            indicator.classList.add('active');
            indicator.innerHTML = '🚨 ALERTA DETECTADA - ENVIANDO EMAIL';
        } else {
            indicator.classList.remove('active');
            indicator.innerHTML = '🔍 DETECCIÓN AUTOMÁTICA ACTIVA';
        }
    }
}

// Método alternativo de envío de email usando mailto
function sendEmailViaMailto(driverState, confidence) {
    const timestamp = new Date().toLocaleString('es-ES');
    const confidencePercent = Math.round(confidence * 100);
    
    const subject = `🚨 ALERTA DE SOMNOLENCIA - ${alertConfig.driverName}`;
    const body = `
ALERTA DE SEGURIDAD VIAL - SISTEMA PREVENCIÓN

INFORMACIÓN DEL CONDUCTOR:
- Nombre: ${alertConfig.driverName}
- Vehículo: ${alertConfig.vehicleInfo || 'No especificado'}

DETECCIÓN:
- Tipo: DETECCIÓN DE OJOS CERRADOS
- Confianza: ${confidencePercent}%
- Timestamp: ${timestamp}
- Ubicación: Sistema de Detección de Somnolencia

MENSAJE DE EMERGENCIA:
Se ha detectado que el conductor ${alertConfig.driverName} tiene los ojos cerrados con una confianza del ${confidencePercent}%. Esto puede indicar somnolencia o fatiga al volante.

ACCIONES RECOMENDADAS:
1. Contactar al conductor inmediatamente
2. Sugerir parada de descanso
3. Verificar estado físico del conductor
4. Si es necesario, activar protocolo de emergencia

INFORMACIÓN DEL SISTEMA:
- Sistema: PREVENCIÓN - Detector de Somnolencia
- Navegador: ${navigator.userAgent}
- URL: ${window.location.href}

Esta es una alerta automática del sistema de detección de somnolencia.
    `.trim();
    
    const mailtoUrl = `mailto:${alertConfig.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Crear enlace temporal y hacer clic
    const link = document.createElement('a');
    link.href = mailtoUrl;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('📧 Abriendo cliente de email con mailto');
    showAnalysisEffect('📧 Abriendo cliente de email...');
    setTimeout(hideAnalysisEffect, 3000);
}

// Función mejorada de envío de email con fallback
async function sendEmailAlertWithFallback(driverState, confidence) {
    console.log('📧 Intentando envío de email...');
    
    // Primero intentar con Formspree
    try {
        await sendEmailAlert(driverState, confidence);
        return; // Si funciona, salir
    } catch (error) {
        console.log('❌ Formspree falló, intentando método alternativo...');
    }
    
    // Si Formspree falla, usar mailto como respaldo
    if (alertConfig.email) {
        sendEmailViaMailto(driverState, confidence);
        alertsSent++;
        updateAlertsCounter();
    }
}
