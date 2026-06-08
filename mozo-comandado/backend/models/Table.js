/**
 * Modelo de Mesa
 */
const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
    number: {
        type: Number,
        required: true,
        unique: true
    },
    capacity: {
        type: Number,
        required: true,
        min: 1
    },
    status: {
        type: String,
        enum: ['available', 'occupied', 'reserved', 'cleaning'],
        default: 'available'
    },
    location: {
        type: String,
        enum: ['interior', 'terraza', 'privado'],
        default: 'interior'
    },
    currentOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    assignedWaiter: String
});

module.exports = mongoose.model('Table', tableSchema);
