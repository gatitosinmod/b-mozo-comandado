/**
 * Servidor Principal - Sistema de Comandas de Restaurante
 * VERSIÓN POSTGRESQL
 *
 * Características:
 * - WebSocket con Socket.io para comunicación en tiempo real
 * - REST API para CRUD de mesas, menú, órdenes
 * - PostgreSQL con Sequelize
 */
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Op } = require('sequelize');

// Configuración de base de datos
const { testConnection, syncDatabase } = require('./config/database');
const { Table, MenuItem, Order, OrderItem } = require('./models/index.postgres');

const app = express();
const server = http.createServer(app);

// Configurar Socket.io
const io = new Server(server, {
    cors: {
        origin: ['http://localhost:5173', 'http://localhost:19006'],
        methods: ['GET', 'POST']
    }
});

// Middlewares
app.use(cors());
app.use(express.json());

// Almacenar conexiones
const connections = {
    waiters: new Map(),
    kitchen: new Set(),
    admin: new Set()
};

// ========================================
// SOCKET.IO - Comunicación en tiempo real
// ========================================

io.on('connection', (socket) => {
    console.log(`📱 Nueva conexión: ${socket.id}`);

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

    // Nueva orden
    socket.on('new_order', async (orderData) => {
        try {
            // Crear orden en PostgreSQL
            const order = await Order.create({
                table_number: orderData.tableNumber,
                waiter_id: orderData.waiterId,
                waiter_name: orderData.waiterName,
                notes: orderData.notes,
                status: 'pending'
            });

            // Crear items de la orden
            let subtotal = 0;
            for (const item of orderData.items) {
                await OrderItem.create({
                    order_id: order.id,
                    menu_item_id: item.menuItemId,
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    notes: item.notes
                });
                subtotal += item.price * item.quantity;
            }

            // Actualizar totales
            order.subtotal = subtotal;
            order.tax = subtotal * 0.18;
            order.total = subtotal + order.tax;
            await order.save();

            // Cargar orden completa con items
            const fullOrder = await Order.findByPk(order.id, {
                include: [{ model: OrderItem, as: 'items' }]
            });

            // Notificar a cocina
            io.to('kitchen').emit('order_received', {
                order: fullOrder.toJSON(),
                message: `🔔 Nueva orden de mesa ${orderData.tableNumber}!`
            });

            // Confirmar al mozo
            socket.emit('order_confirmed', {
                orderId: order.id,
                orderNumber: order.order_number,
                message: 'Orden enviada a cocina'
            });

            // Notificar a admins
            io.to('admin').emit('order_update', { type: 'new', order: fullOrder });

            console.log(`📝 Nueva orden #${order.order_number}: Mesa ${orderData.tableNumber}`);
        } catch (error) {
            console.error('Error procesando orden:', error);
            socket.emit('order_error', { message: 'Error al procesar orden' });
        }
    });

    // Actualizar estado de orden
    socket.on('update_order_status', async ({ orderId, status }) => {
        try {
            const order = await Order.findByPk(orderId);
            if (!order) return;

            order.status = status;
            if (status === 'delivered') {
                order.completed_at = new Date();
            }
            await order.save();

            // Notificar al mozo
            const waiterSocketId = connections.waiters.get(order.waiter_id);
            if (waiterSocketId) {
                io.to(waiterSocketId).emit('order_status_changed', {
                    orderId,
                    status,
                    tableNumber: order.table_number,
                    message: status === 'ready'
                        ? `¡Orden lista para mesa ${order.table_number}!`
                        : `Orden actualizada: ${status}`
                });
            }

            io.emit('order_update', { orderId, status });
        } catch (error) {
            socket.emit('error', { message: 'Error actualizando orden' });
        }
    });

    socket.on('disconnect', () => {
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
    const tables = await Table.findAll({ order: [['number', 'ASC']] });
    res.json(tables);
});

app.post('/api/tables', async (req, res) => {
    const table = await Table.create(req.body);
    res.status(201).json(table);
});

app.put('/api/tables/:id/status', async (req, res) => {
    const table = await Table.findByPk(req.params.id);
    if (!table) return res.status(404).json({ error: 'Mesa no encontrada' });

    table.status = req.body.status;
    await table.save();

    io.emit('table_status_changed', table);
    res.json(table);
});

// --- MENÚ ---
app.get('/api/menu', async (req, res) => {
    const items = await MenuItem.findAll({
        where: { available: true },
        order: [['category', 'ASC'], ['name', 'ASC']]
    });
    res.json(items);
});

app.get('/api/menu/categories', async (req, res) => {
    const categories = await MenuItem.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('category')), 'category']],
        raw: true
    });
    res.json(categories.map(c => c.category));
});

app.post('/api/menu', async (req, res) => {
    const item = await MenuItem.create(req.body);
    res.status(201).json(item);
});

app.put('/api/menu/:id', async (req, res) => {
    const item = await MenuItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });

    await item.update(req.body);
    res.json(item);
});

// --- ÓRDENES ---
app.get('/api/orders', async (req, res) => {
    const { status, date } = req.query;
    const where = {};

    if (status) where.status = status;
    if (date) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        where.created_at = { [Op.between]: [start, end] };
    }

    const orders = await Order.findAll({
        where,
        include: [{
            model: OrderItem,
            as: 'items',
            include: [{ model: MenuItem, as: 'menuItem' }]
        }],
        order: [['created_at', 'DESC']]
    });
    res.json(orders);
});

app.get('/api/orders/pending', async (req, res) => {
    const orders = await Order.findAll({
        where: {
            status: { [Op.in]: ['pending', 'preparing'] }
        },
        include: [{ model: OrderItem, as: 'items' }],
        order: [['created_at', 'ASC']]
    });
    res.json(orders);
});

app.get('/api/orders/:id', async (req, res) => {
    const order = await Order.findByPk(req.params.id, {
        include: [{
            model: OrderItem,
            as: 'items',
            include: [{ model: MenuItem, as: 'menuItem' }]
        }]
    });
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    res.json(order);
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        database: 'PostgreSQL',
        connections: {
            waiters: connections.waiters.size,
            kitchen: connections.kitchen.size
        }
    });
});

// ========================================
// INICIAR SERVIDOR
// ========================================

const startServer = async () => {
    const connected = await testConnection();
    if (!connected) process.exit(1);

    if (process.env.NODE_ENV === 'development') {
        await syncDatabase(false);
    }

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
        console.log(`
    ================================================
    🍽️  Sistema de Comandas - Restaurante (PostgreSQL)
    ================================================
    📍 HTTP: http://localhost:${PORT}
    🔌 WebSocket: ws://localhost:${PORT}
    📊 API: http://localhost:${PORT}/api
    🐘 DB: PostgreSQL
    ================================================
        `);
    });
};

startServer();
