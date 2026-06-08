/**
 * Servicio de WebSocket para App de Mozos
 *
 * Maneja la conexión Socket.io para:
 * - Enviar nuevas órdenes
 * - Recibir confirmaciones
 * - Recibir notificaciones de órdenes listas
 */
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3001';

class SocketService {
    constructor() {
        this.socket = null;
        this.waiterId = null;
        this.listeners = new Map();
    }

    /**
     * Conectar al servidor
     */
    connect(waiterId) {
        this.waiterId = waiterId;

        this.socket = io(SOCKET_URL, {
            transports: ['websocket'],
            autoConnect: true
        });

        this.socket.on('connect', () => {
            console.log('✅ Conectado al servidor');

            // Registrarse como mozo
            this.socket.emit('register', {
                type: 'waiter',
                waiterId: this.waiterId
            });
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Desconectado del servidor');
        });

        // Escuchar eventos del servidor
        this.setupListeners();

        return this;
    }

    /**
     * Configurar listeners de eventos
     */
    setupListeners() {
        // Confirmación de orden enviada
        this.socket.on('order_confirmed', (data) => {
            this.emit('orderConfirmed', data);
        });

        // Error en orden
        this.socket.on('order_error', (data) => {
            this.emit('orderError', data);
        });

        // Cambio de estado de orden (¡La más importante!)
        this.socket.on('order_status_changed', (data) => {
            this.emit('orderStatusChanged', data);

            // Si está lista, mostrar alerta
            if (data.status === 'ready') {
                this.emit('orderReady', data);
            }
        });

        // Actualización de mesa
        this.socket.on('table_status_changed', (data) => {
            this.emit('tableStatusChanged', data);
        });
    }

    /**
     * Enviar nueva orden
     */
    sendOrder(orderData) {
        return new Promise((resolve, reject) => {
            if (!this.socket?.connected) {
                reject(new Error('No conectado al servidor'));
                return;
            }

            // Agregar ID del mozo
            const order = {
                ...orderData,
                waiterId: this.waiterId
            };

            this.socket.emit('new_order', order);

            // Esperar confirmación (timeout 10s)
            const timeout = setTimeout(() => {
                reject(new Error('Timeout esperando confirmación'));
            }, 10000);

            this.once('orderConfirmed', (data) => {
                clearTimeout(timeout);
                resolve(data);
            });

            this.once('orderError', (data) => {
                clearTimeout(timeout);
                reject(new Error(data.message));
            });
        });
    }

    /**
     * Suscribirse a un evento
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        return () => this.off(event, callback);
    }

    /**
     * Suscripción única (se elimina después de ejecutar)
     */
    once(event, callback) {
        const wrapper = (data) => {
            this.off(event, wrapper);
            callback(data);
        };
        this.on(event, wrapper);
    }

    /**
     * Eliminar listener
     */
    off(event, callback) {
        this.listeners.get(event)?.delete(callback);
    }

    /**
     * Emitir evento a listeners locales
     */
    emit(event, data) {
        this.listeners.get(event)?.forEach(cb => cb(data));
    }

    /**
     * Desconectar
     */
    disconnect() {
        this.socket?.disconnect();
        this.socket = null;
        this.listeners.clear();
    }

    /**
     * Estado de conexión
     */
    isConnected() {
        return this.socket?.connected || false;
    }
}

// Singleton
export default new SocketService();
