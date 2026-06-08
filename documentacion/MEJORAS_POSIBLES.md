# 🚀 Mejoras Posibles - Sistema de Comandas

## 1. Funcionalidades Adicionales

### 1.1 Impresión de Tickets

```javascript
// Integrar con impresora térmica
const ThermalPrinter = require('node-thermal-printer');

const printTicket = async (order) => {
    const printer = new ThermalPrinter({
        type: 'epson',
        interface: '/dev/usb/lp0'
    });

    printer.alignCenter();
    printer.println('RESTAURANTE');
    printer.drawLine();

    printer.alignLeft();
    printer.println(`Mesa: ${order.tableNumber}`);
    printer.println(`Orden: #${order.orderNumber}`);
    printer.drawLine();

    order.items.forEach(item => {
        printer.println(`${item.quantity}x ${item.name}`);
        if (item.notes) printer.println(`   → ${item.notes}`);
    });

    printer.cut();
    await printer.execute();
};
```

### 1.2 Sistema de Notificaciones Push

```javascript
// Usando Firebase Cloud Messaging
const admin = require('firebase-admin');

const sendPushToWaiter = async (waiterId, message) => {
    const token = await getWaiterFCMToken(waiterId);

    await admin.messaging().send({
        token,
        notification: {
            title: '¡Orden Lista!',
            body: message
        },
        android: {
            priority: 'high',
            notification: {
                sound: 'order_ready.mp3'
            }
        }
    });
};
```

### 1.3 Modo Offline

```javascript
// Guardar órdenes pendientes en AsyncStorage
const sendOrderWithOfflineSupport = async (order) => {
    try {
        await socketService.sendOrder(order);
    } catch (error) {
        // Sin conexión, guardar localmente
        const pending = await AsyncStorage.getItem('pendingOrders') || '[]';
        const orders = JSON.parse(pending);
        orders.push({ ...order, offlineId: Date.now() });
        await AsyncStorage.setItem('pendingOrders', JSON.stringify(orders));

        Alert.alert('Sin conexión', 'La orden se enviará cuando vuelva la conexión');
    }
};

// Al reconectar, enviar pendientes
socket.on('connect', async () => {
    const pending = JSON.parse(await AsyncStorage.getItem('pendingOrders') || '[]');
    for (const order of pending) {
        await socketService.sendOrder(order);
    }
    await AsyncStorage.setItem('pendingOrders', '[]');
});
```

---

## 2. Mejoras de UI/UX

### 2.1 Sonidos Diferenciados

```javascript
// Diferentes sonidos para diferentes eventos
const sounds = {
    newOrder: new Audio('/sounds/new-order.mp3'),
    orderReady: new Audio('/sounds/order-ready.mp3'),
    urgent: new Audio('/sounds/urgent.mp3')
};

socket.on('order_received', (data) => {
    sounds.newOrder.play();
});

// Si orden lleva >10min, sonar urgente cada 30s
setInterval(() => {
    orders.filter(o => isUrgent(o)).forEach(() => {
        sounds.urgent.play();
    });
}, 30000);
```

### 2.2 Vista de Kanban para Cocina

```javascript
const KanbanBoard = () => (
    <div className="kanban">
        <Column title="Pendientes" status="pending" />
        <Column title="Preparando" status="preparing" />
        <Column title="Listas" status="ready" />
    </div>
);

// Con drag-and-drop para cambiar estado
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
```

### 2.3 Dashboard de Estadísticas

```javascript
// Métricas en tiempo real
const getDashboardData = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await Order.aggregate([
        { $match: { createdAt: { $gte: today } } },
        {
            $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalRevenue: { $sum: '$total' },
                avgPrepTime: { $avg: '$preparationTime' }
            }
        }
    ]);

    return stats[0];
};
```

---

## 3. Mejoras de Rendimiento

### 3.1 Caché de Menú

```javascript
// El menú no cambia frecuentemente, cachearlo
const Redis = require('ioredis');
const redis = new Redis();

const getMenu = async () => {
    const cached = await redis.get('menu');
    if (cached) return JSON.parse(cached);

    const menu = await MenuItem.find({ available: true });
    await redis.set('menu', JSON.stringify(menu), 'EX', 3600); // 1 hora
    return menu;
};

// Invalidar caché al modificar menú
app.put('/api/menu/:id', async (req, res) => {
    await MenuItem.findByIdAndUpdate(req.params.id, req.body);
    await redis.del('menu');
    res.json({ success: true });
});
```

### 3.2 Paginación de Órdenes

```javascript
// No cargar todas las órdenes históricas
app.get('/api/orders', async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;

    const query = status ? { status } : {};

    const orders = await Order.find(query)
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(limit);

    const total = await Order.countDocuments(query);

    res.json({
        orders,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
        }
    });
});
```

---

## 4. Seguridad

### 4.1 Autenticación de WebSocket

```javascript
// Verificar JWT en conexión Socket.io
io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error('Token requerido'));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
        next();
    } catch (err) {
        next(new Error('Token inválido'));
    }
});
```

### 4.2 Rate Limiting

```javascript
// Limitar órdenes por mozo
const orderLimits = new Map();

socket.on('new_order', async (data) => {
    const waiterId = socket.user.id;
    const now = Date.now();

    // Máximo 10 órdenes por minuto
    const recent = orderLimits.get(waiterId) || [];
    const recentMinute = recent.filter(t => now - t < 60000);

    if (recentMinute.length >= 10) {
        socket.emit('error', { message: 'Límite de órdenes excedido' });
        return;
    }

    recentMinute.push(now);
    orderLimits.set(waiterId, recentMinute);

    // Procesar orden...
});
```

---

## 5. Componentes Reemplazables

| Actual | Alternativa | Beneficio |
|--------|-------------|-----------|
| Socket.io | Pusher | Escalabilidad, menos mantenimiento |
| MongoDB | PostgreSQL | Transacciones ACID |
| React Native | Flutter | Mejor rendimiento nativo |
| Express | Fastify | 2x más rápido |

---

## 6. Roadmap Sugerido

### Corto plazo (1-2 semanas)
- [ ] Sonidos diferenciados
- [ ] Vista Kanban
- [ ] Autenticación WebSocket

### Mediano plazo (1 mes)
- [ ] Modo offline
- [ ] Notificaciones push
- [ ] Dashboard de estadísticas

### Largo plazo (3 meses)
- [ ] Impresión de tickets
- [ ] Sistema de reservas
- [ ] App para clientes (pedir desde mesa)
