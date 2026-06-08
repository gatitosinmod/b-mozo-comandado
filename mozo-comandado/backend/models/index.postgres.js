/**
 * Modelos PostgreSQL - Sistema de Comandas
 *
 * Tablas:
 * - tables: Mesas del restaurante
 * - menu_items: Platos del menú
 * - orders: Pedidos/comandas
 * - order_items: Items de cada pedido
 */
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

// ============================================
// MODELO: MESA
// ============================================

class Table extends Model {}

Table.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    number: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
    },
    capacity: {
        type: DataTypes.INTEGER,
        defaultValue: 4
    },
    status: {
        type: DataTypes.ENUM('available', 'occupied', 'reserved', 'cleaning'),
        defaultValue: 'available'
    },
    location: {
        type: DataTypes.STRING(50),
        defaultValue: 'interior'
    }
}, {
    sequelize,
    modelName: 'Table',
    tableName: 'tables',
    timestamps: true,
    underscored: true
});

// ============================================
// MODELO: ITEM DEL MENÚ
// ============================================

class MenuItem extends Model {}

MenuItem.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    category: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    image_url: {
        type: DataTypes.STRING(255)
    },
    available: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    preparation_time: {
        type: DataTypes.INTEGER, // minutos
        defaultValue: 15
    }
}, {
    sequelize,
    modelName: 'MenuItem',
    tableName: 'menu_items',
    timestamps: true,
    underscored: true
});

// ============================================
// MODELO: ORDEN/COMANDA
// ============================================

class Order extends Model {
    // Calcular totales
    async calculateTotals() {
        const items = await OrderItem.findAll({
            where: { order_id: this.id }
        });

        this.subtotal = items.reduce((sum, item) =>
            sum + (parseFloat(item.price) * item.quantity), 0
        );
        this.tax = this.subtotal * 0.18; // 18% IGV
        this.total = this.subtotal + this.tax;

        await this.save();
    }
}

Order.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    order_number: {
        type: DataTypes.INTEGER,
        unique: true
    },
    table_number: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    waiter_id: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    waiter_name: {
        type: DataTypes.STRING(100)
    },
    status: {
        type: DataTypes.ENUM('pending', 'preparing', 'ready', 'delivered', 'cancelled'),
        defaultValue: 'pending'
    },
    subtotal: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    tax: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    total: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    notes: {
        type: DataTypes.TEXT
    },
    completed_at: {
        type: DataTypes.DATE
    }
}, {
    sequelize,
    modelName: 'Order',
    tableName: 'orders',
    timestamps: true,
    underscored: true,
    hooks: {
        beforeCreate: async (order) => {
            // Auto-incrementar número de orden
            const lastOrder = await Order.findOne({
                order: [['order_number', 'DESC']]
            });
            order.order_number = (lastOrder?.order_number || 0) + 1;
        }
    }
});

// ============================================
// MODELO: ITEMS DE LA ORDEN
// ============================================

class OrderItem extends Model {}

OrderItem.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    order_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Order,
            key: 'id'
        }
    },
    menu_item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: MenuItem,
            key: 'id'
        }
    },
    name: {
        type: DataTypes.STRING(100) // Copia para acceso rápido
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        validate: {
            min: 1
        }
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    notes: {
        type: DataTypes.TEXT // "Sin cebolla", "Término medio"
    }
}, {
    sequelize,
    modelName: 'OrderItem',
    tableName: 'order_items',
    timestamps: true,
    underscored: true
});

// ============================================
// RELACIONES
// ============================================

// Order -> OrderItems (1:N)
Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// MenuItem -> OrderItems (1:N)
MenuItem.hasMany(OrderItem, { foreignKey: 'menu_item_id', as: 'orderItems' });
OrderItem.belongsTo(MenuItem, { foreignKey: 'menu_item_id', as: 'menuItem' });

module.exports = { Table, MenuItem, Order, OrderItem };
