/**
 * Modelo de Orden/Comanda
 */
const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    menuItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MenuItem',
        required: true
    },
    name: String, // Copia del nombre para acceso rápido
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    notes: String, // "Sin cebolla", "Término medio", etc.
    price: Number
});

const orderSchema = new mongoose.Schema({
    // Identificación
    orderNumber: {
        type: Number,
        unique: true
    },
    tableNumber: {
        type: Number,
        required: true
    },
    waiterId: {
        type: String,
        required: true
    },
    waiterName: String,

    // Items del pedido
    items: [orderItemSchema],

    // Estado del pedido
    status: {
        type: String,
        enum: ['pending', 'preparing', 'ready', 'delivered', 'cancelled'],
        default: 'pending'
    },

    // Totales
    subtotal: Number,
    tax: Number,
    total: Number,

    // Notas generales
    notes: String,

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: Date,
    completedAt: Date
});

// Auto-incrementar número de orden
orderSchema.pre('save', async function(next) {
    if (this.isNew) {
        const lastOrder = await this.constructor.findOne().sort('-orderNumber');
        this.orderNumber = (lastOrder?.orderNumber || 0) + 1;

        // Calcular totales
        this.subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        this.tax = this.subtotal * 0.18; // 18% IGV
        this.total = this.subtotal + this.tax;
    }
    next();
});

module.exports = mongoose.model('Order', orderSchema);
