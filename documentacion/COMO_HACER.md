# 📚 Guía: Sistema de Comandas en Tiempo Real

## Introducción

Esta guía te enseña a construir un sistema de comandas para restaurante donde las órdenes aparecen INSTANTÁNEAMENTE en la cocina usando WebSockets.

---

## 🎯 Conceptos Clave

### ¿Qué es un WebSocket?

HTTP normal es como enviar una carta: envías, esperas respuesta.
WebSocket es como una llamada telefónica: conexión abierta, comunicación instantánea bidireccional.

```
HTTP tradicional:
Cliente ──petición──> Servidor
Cliente <──respuesta── Servidor
(Conexión se cierra)

WebSocket:
Cliente <═══════════> Servidor
(Conexión permanente, ambos pueden enviar cuando quieran)
```

### Socket.io

Librería que facilita WebSockets con features extra:
- Reconexión automática
- Fallback a HTTP si WebSocket no disponible
- Rooms (grupos de conexiones)
- Eventos con nombres personalizados

---

## 🚀 FASE 1: Backend con Socket.io

### Paso 1.1: Configurar servidor

```javascript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

// Escuchar conexiones
io.on('connection', (socket) => {
    console.log('Nueva conexión:', socket.id);

    // Escuchar evento personalizado
    socket.on('nueva_orden', (data) => {
        console.log('Orden recibida:', data);

        // Emitir a TODOS los conectados
        io.emit('orden_para_cocina', data);
    });

    socket.on('disconnect', () => {
        console.log('Desconectado:', socket.id);
    });
});

server.listen(3001, () => console.log('Servidor en :3001'));
```

### Paso 1.2: Crear modelos MongoDB

```javascript
// models/Order.js
const orderSchema = new mongoose.Schema({
    tableNumber: { type: Number, required: true },
    items: [{
        name: String,
        quantity: Number,
        notes: String
    }],
    status: {
        type: String,
        enum: ['pending', 'preparing', 'ready'],
        default: 'pending'
    },
    createdAt: { type: Date, default: Date.now }
});
```

---

## 🚀 FASE 2: Pantalla de Cocina

### Paso 2.1: Conectar a Socket.io desde React

```javascript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

function KitchenDisplay() {
    const [orders, setOrders] = useState([]);
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        // Conectar al servidor
        const newSocket = io('http://localhost:3001');
        setSocket(newSocket);

        // Registrarse como cocina
        newSocket.emit('register', { type: 'kitchen' });

        // Escuchar nuevas órdenes
        newSocket.on('orden_para_cocina', (order) => {
            // Agregar orden al estado
            setOrders(prev => [...prev, order]);

            // Opcional: reproducir sonido
            new Audio('/notification.mp3').play();
        });

        // Cleanup al desmontar
        return () => newSocket.disconnect();
    }, []);

    return (
        <div className="kitchen-display">
            {orders.map(order => (
                <OrderCard key={order._id} order={order} />
            ))}
        </div>
    );
}
```

### Paso 2.2: Componente de orden con acciones

```javascript
function OrderCard({ order, onStatusChange }) {
    return (
        <div className={`order-card ${order.status}`}>
            <h3>Mesa {order.tableNumber}</h3>

            <ul>
                {order.items.map(item => (
                    <li>{item.quantity}x {item.name}</li>
                ))}
            </ul>

            <div className="actions">
                {order.status === 'pending' && (
                    <button onClick={() => onStatusChange(order._id, 'preparing')}>
                        🍳 Preparar
                    </button>
                )}
                {order.status === 'preparing' && (
                    <button onClick={() => onStatusChange(order._id, 'ready')}>
                        ✅ Lista
                    </button>
                )}
            </div>
        </div>
    );
}
```

---

## 🚀 FASE 3: App Móvil (React Native)

### Paso 3.1: Servicio de Socket

```javascript
// services/socket.js
import { io } from 'socket.io-client';

class SocketService {
    socket = null;

    connect(waiterId) {
        this.socket = io('http://TU_IP:3001');

        this.socket.on('connect', () => {
            this.socket.emit('register', { type: 'waiter', waiterId });
        });

        // Escuchar cuando orden está lista
        this.socket.on('order_status_changed', (data) => {
            if (data.status === 'ready') {
                Alert.alert('¡Orden lista!', `Mesa ${data.tableNumber}`);
            }
        });
    }

    sendOrder(order) {
        this.socket.emit('nueva_orden', order);
    }
}

export default new SocketService();
```

### Paso 3.2: Pantalla para tomar pedido

```javascript
function TakeOrderScreen({ tableNumber }) {
    const [items, setItems] = useState([]);
    const [sending, setSending] = useState(false);

    const addItem = (menuItem) => {
        setItems([...items, { ...menuItem, quantity: 1 }]);
    };

    const sendOrder = async () => {
        setSending(true);
        socketService.sendOrder({
            tableNumber,
            items
        });
        // Esperar confirmación...
    };

    return (
        <View>
            <Menu onSelectItem={addItem} />
            <OrderSummary items={items} />
            <Button
                title={sending ? 'Enviando...' : 'Enviar a Cocina'}
                onPress={sendOrder}
                disabled={items.length === 0 || sending}
            />
        </View>
    );
}
```

---

## 🔑 Puntos Importantes

### 1. Rooms de Socket.io

```javascript
// Servidor
socket.join('cocina');  // Agregar a room
io.to('cocina').emit('evento', data);  // Emitir solo a ese room
```

### 2. Manejo de reconexión

```javascript
socket.on('disconnect', () => {
    // Mostrar indicador de desconexión
});

socket.on('connect', () => {
    // Re-registrarse
    socket.emit('register', { type: 'waiter', waiterId });
});
```

### 3. Estados de orden

```
pending → preparing → ready → delivered
   ↓          ↓          ↓
(amarillo) (azul)    (verde)
```

---

## 💡 Tips de Producción

1. **Sonidos**: Usa diferentes sonidos para nueva orden vs orden lista
2. **Colores**: Resalta órdenes que llevan mucho tiempo
3. **Impresión**: Conecta impresora térmica para tickets
4. **Offline**: Guarda órdenes localmente si se pierde conexión
5. **Seguridad**: Autenticar conexiones Socket.io con JWT

---

¡Con esto tienes la base para un sistema de comandas profesional!
