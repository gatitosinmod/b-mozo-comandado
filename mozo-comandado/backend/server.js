/**
 * Servidor Principal - Sistema de Comandas de Restaurante
 *
 * Características:
 * - WebSocket con Socket.io para comunicación en tiempo real
 * - REST API para CRUD de mesas, menú, órdenes
 * - Notificaciones push a cocina cuando llega pedido
 */
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configurar Socket.io
const io = new Server(server, {
    cors: {
        origin: ['http://localhost:5173', 'http://localhost:19006'], // Web y Expo
        methods: ['GET', 'POST']
    }
});

// Middlewares
app.use(cors());
app.use(express.json());

// Conexión MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant-pos')
    .then(() => console.log('✅ MongoDB conectado'))
    .catch(err => console.error('❌ Error MongoDB:', err));

// Importar modelos
const Order = require('./models/Order');
const Table = require('./models/Table');
const MenuItem = require('./models/MenuItem');

// ========================================
// SOCKET.IO - Comunicación en tiempo real
// ========================================

// Almacenar conexiones por tipo (mozo, cocina, admin)
const connections = {
    waiters: new Map(),
    kitchen: new Set(),
    admin: new Set()
};

io.on('connection', (socket) => {
    console.log(`📱 Nueva conexión: ${socket.id}`);

    // Registrar tipo de cliente
    socket.on('register', ({ type, waiterId }) => {
        if (type === 'waiter' && waiterId) {
            connections.waiters.set(waiterId, socket.id);
            socket.join('waiters');
            console.log(`👨‍🍳 Mozo ${waiterId} conectado`);
        } else if (type === 'kitchen') {
            connections.kitchen.add(socket.id);
            socket.join('kitchen');
            console.log(`🍳 Cocina conectada`);
        } else if (type === 'admin') {
            connections.admin.add(socket.id);
            socket.join('admin');
        }
    });

    // Mozo envía nueva orden
    socket.on('new_order', async (orderData) => {
        try {
            // Guardar en base de datos
            const order = new Order({
                ...orderData,
                status: 'pending',
                createdAt: new Date()
            });
            await order.save();

            // Notificar a cocina INSTANTÁNEAMENTE
            io.to('kitchen').emit('order_received', {
                order: order.toObject(),
                message: `🔔 Nueva orden de mesa ${orderData.tableNumber}!`
            });

            // Confirmar al mozo
            socket.emit('order_confirmed', {
                orderId: order._id,
                message: 'Orden enviada a cocina'
            });

            // Notificar a admins
            io.to('admin').emit('order_update', { type: 'new', order });

            console.log(`📝 Nueva orden: Mesa ${orderData.tableNumber}`);
        } catch (error) {
            socket.emit('order_error', { message: 'Error al procesar orden' });
        }
    });

    // Cocina actualiza estado de orden
    socket.on('update_order_status', async ({ orderId, status }) => {
        try {
            const order = await Order.findByIdAndUpdate(
                orderId,
                { status, updatedAt: new Date() },
                { new: true }
            );

            // Notificar al mozo correspondiente
            const waiterSocketId = connections.waiters.get(order.waiterId);
            if (waiterSocketId) {
                io.to(waiterSocketId).emit('order_status_changed', {
                    orderId,
                    status,
                    tableNumber: order.tableNumber,
                    message: status === 'ready'
                        ? `¡Orden lista para mesa ${order.tableNumber}!`
                        : `Orden actualizada: ${status}`
                });
            }

            // Notificar a todos
            io.emit('order_update', { orderId, status });

        } catch (error) {
            socket.emit('error', { message: 'Error actualizando orden' });
        }
    });

    // Desconexión
    socket.on('disconnect', () => {
        // Limpiar de las listas
        for (const [waiterId, socketId] of connections.waiters) {
            if (socketId === socket.id) {
                connections.waiters.delete(waiterId);
                break;
            }
        }
        connections.kitchen.delete(socket.id);
        connections.admin.delete(socket.id);
        console.log(`👋 Desconectado: ${socket.id}`);
    });
});

// ========================================
// REST API
// ========================================

// --- MESAS ---
app.get('/api/tables', async (req, res) => {
    const tables = await Table.find().sort('number');
    res.json(tables);
});

app.post('/api/tables', async (req, res) => {
    const table = new Table(req.body);
    await table.save();
    res.status(201).json(table);
});

app.put('/api/tables/:id/status', async (req, res) => {
    const table = await Table.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status },
        { new: true }
    );
    io.emit('table_status_changed', table);
    res.json(table);
});

// --- MENÚ ---
app.get('/api/menu', async (req, res) => {
    const items = await MenuItem.find({ available: true }).sort('category');
    res.json(items);
});

app.get('/api/menu/categories', async (req, res) => {
    const categories = await MenuItem.distinct('category');
    res.json(categories);
});

app.post('/api/menu', async (req, res) => {
    const item = new MenuItem(req.body);
    await item.save();
    res.status(201).json(item);
});

// --- ÓRDENES ---
app.get('/api/orders', async (req, res) => {
    const { status, date } = req.query;
    const query = {};

    if (status) query.status = status;
    if (date) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        query.createdAt = { $gte: start, $lte: end };
    }

    const orders = await Order.find(query)
        .populate('items.menuItem')
        .sort('-createdAt');
    res.json(orders);
});

app.get('/api/orders/pending', async (req, res) => {
    const orders = await Order.find({
        status: { $in: ['pending', 'preparing'] }
    }).sort('createdAt');
    res.json(orders);
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        connections: {
            waiters: connections.waiters.size,
            kitchen: connections.kitchen.size
        }
    });
});

// Iniciar servidor
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`
    ================================================
    🍽️  Sistema de Comandas - Restaurante
    ================================================
    📍 HTTP: http://localhost:${PORT}
    🔌 WebSocket: ws://localhost:${PORT}
    📊 API: http://localhost:${PORT}/api
    ================================================
    `);
});
