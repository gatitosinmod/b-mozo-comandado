# 🔍 Explicación del Código

## Estructura del Proyecto

```
mozo-comandado/
├── backend/
│   ├── server.js           # Servidor Express + Socket.io
│   ├── models/
│   │   ├── Order.js        # Modelo de orden
│   │   ├── Table.js        # Modelo de mesa
│   │   └── MenuItem.js     # Modelo de item de menú
│   └── package.json
├── kitchen-display/
│   └── src/
│       └── components/
│           └── OrderCard.jsx
└── mobile-app/
    └── src/
        └── services/
            └── socketService.js
```

---

## Backend: server.js

### Configuración de Socket.io

```javascript
const http = require('http');
const { Server } = require('socket.io');

// Crear servidor HTTP a partir de Express
const server = http.createServer(app);

// Crear servidor Socket.io sobre el HTTP
const io = new Server(server, {
    cors: {
        origin: ['http://localhost:5173', 'http://localhost:19006'],
        // 5173 = Vite (web), 19006 = Expo (mobile)
        methods: ['GET', 'POST']
    }
});
```

**¿Por qué http.createServer?**
Socket.io necesita el servidor HTTP raw, no solo la app de Express.

### Almacenar conexiones

```javascript
const connections = {
    waiters: new Map(),   // waiterId → socketId
    kitchen: new Set(),   // Set de socketIds
    admin: new Set()
};
```

**Map vs Set:**
- Map: cuando necesitas buscar por clave (ej: encontrar socket de un mozo específico)
- Set: cuando solo necesitas saber si existe

### Evento de conexión

```javascript
io.on('connection', (socket) => {
    // 'socket' representa UNA conexión específica

    socket.on('register', ({ type, waiterId }) => {
        if (type === 'waiter') {
            connections.waiters.set(waiterId, socket.id);
            socket.join('waiters');  // Unir al room 'waiters'
        }
        // ...
    });
});
```

**socket.join('room'):**
Agrupa conexiones. Luego puedes emitir a todo el grupo:
```javascript
io.to('kitchen').emit('evento', data);  // Solo cocina recibe
```

### Enviar orden

```javascript
socket.on('new_order', async (orderData) => {
    // 1. Guardar en base de datos
    const order = new Order(orderData);
    await order.save();

    // 2. Notificar a cocina
    io.to('kitchen').emit('order_received', {
        order: order.toObject(),
        message: `Nueva orden de mesa ${orderData.tableNumber}`
    });

    // 3. Confirmar al mozo
    socket.emit('order_confirmed', {
        orderId: order._id
    });
});
```

**io.to() vs socket.emit():**
- `io.to('kitchen').emit()` → a todos en el room 'kitchen'
- `socket.emit()` → solo al cliente que envió la orden

---

## Modelo: Order.js

### Pre-save hook

```javascript
orderSchema.pre('save', async function(next) {
    if (this.isNew) {
        // Auto-incrementar número de orden
        const lastOrder = await this.constructor.findOne()
            .sort('-orderNumber');
        this.orderNumber = (lastOrder?.orderNumber || 0) + 1;

        // Calcular totales
        this.subtotal = this.items.reduce(
            (sum, item) => sum + (item.price * item.quantity),
            0
        );
        this.tax = this.subtotal * 0.18;
        this.total = this.subtotal + this.tax;
    }
    next();  // Continuar con el guardado
});
```

**this.isNew:**
True solo la primera vez que se guarda el documento. Evita recalcular en updates.

---

## Kitchen Display: OrderCard.jsx

### Calcular tiempo transcurrido

```javascript
const getTimeSince = (date) => {
    const minutes = Math.floor((Date.now() - new Date(date)) / 60000);
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};
```

### Marcar como urgente

```javascript
const isUrgent = order.status === 'pending' &&
    (Date.now() - new Date(order.createdAt)) > 10 * 60 * 1000;
// > 10 minutos esperando = urgente
```

---

## Mobile App: socketService.js

### Patrón Singleton

```javascript
class SocketService {
    socket = null;
    // ...
}

export default new SocketService();  // Exportar instancia única
```

**¿Por qué singleton?**
Queremos UNA sola conexión WebSocket para toda la app.

### Promisificar envío de orden

```javascript
sendOrder(order) {
    return new Promise((resolve, reject) => {
        // Enviar
        this.socket.emit('new_order', order);

        // Esperar confirmación
        const timeout = setTimeout(() => {
            reject(new Error('Timeout'));
        }, 10000);

        this.once('orderConfirmed', (data) => {
            clearTimeout(timeout);
            resolve(data);
        });
    });
}
```

**¿Por qué Promise?**
Para poder usar `await`:
```javascript
try {
    const result = await socketService.sendOrder(order);
    showSuccess('Orden enviada');
} catch (error) {
    showError('Error enviando orden');
}
```

### Sistema de listeners

```javascript
listeners = new Map();

on(event, callback) {
    if (!this.listeners.has(event)) {
        this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Retornar función para des-suscribirse
    return () => this.off(event, callback);
}
```

**¿Por qué custom listeners?**
Para desacoplar la lógica de Socket.io de los componentes.

---

## Diagrama de Comunicación

```
   ┌──────────┐                      ┌──────────┐
   │   MOZO   │                      │  COCINA  │
   └────┬─────┘                      └────┬─────┘
        │                                  │
        │ emit('new_order')                │
        │─────────────────>┌───────┐       │
        │                  │SERVER │       │
        │<─────────────────│       │───────>│
        │ emit('confirmed')└───┬───┘ emit('received')
        │                      │           │
        │                      │           │
        │                      │<──────────│
        │                      │ emit('update_status')
        │<─────────────────────│           │
        │ emit('status_changed')           │
```

---

## Tips de Debug

### Ver todos los eventos Socket.io

```javascript
// En cliente
socket.onAny((event, ...args) => {
    console.log(`[Socket] ${event}:`, args);
});

// En servidor
io.on('connection', (socket) => {
    socket.onAny((event, ...args) => {
        console.log(`[${socket.id}] ${event}:`, args);
    });
});
```

### Verificar conexiones activas

```javascript
app.get('/api/debug/connections', (req, res) => {
    res.json({
        waiters: [...connections.waiters.entries()],
        kitchen: connections.kitchen.size,
        totalSockets: io.sockets.sockets.size
    });
});
```
