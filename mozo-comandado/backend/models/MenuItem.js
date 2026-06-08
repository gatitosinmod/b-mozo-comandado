/**
 * Modelo de Item del Menú
 */
const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: String,
    price: {
        type: Number,
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: ['entradas', 'platos_fuertes', 'postres', 'bebidas', 'extras']
    },
    image: String,
    available: {
        type: Boolean,
        default: true
    },
    preparationTime: Number, // minutos estimados
    allergens: [String], // gluten, lactosa, etc.
    isPopular: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('MenuItem', menuItemSchema);
