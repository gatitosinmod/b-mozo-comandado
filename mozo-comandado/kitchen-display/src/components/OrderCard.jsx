import React from 'react';

/**
 * Tarjeta de Orden para Pantalla de Cocina
 *
 * Muestra una orden con sus items y permite cambiar estado.
 * Colores por estado:
 * - Pendiente: Amarillo
 * - Preparando: Azul
 * - Lista: Verde
 */
const OrderCard = ({ order, onStatusChange }) => {
    const getStatusColor = (status) => {
        const colors = {
            pending: { bg: '#fff3cd', border: '#ffc107', text: '#856404' },
            preparing: { bg: '#cce5ff', border: '#007bff', text: '#004085' },
            ready: { bg: '#d4edda', border: '#28a745', text: '#155724' },
            delivered: { bg: '#e2e3e5', border: '#6c757d', text: '#383d41' }
        };
        return colors[status] || colors.pending;
    };

    const getStatusLabel = (status) => {
        const labels = {
            pending: '⏳ Pendiente',
            preparing: '🍳 Preparando',
            ready: '✅ Lista',
            delivered: '📦 Entregada'
        };
        return labels[status] || status;
    };

    const getTimeSince = (date) => {
        const minutes = Math.floor((Date.now() - new Date(date)) / 60000);
        if (minutes < 1) return 'Ahora';
        if (minutes < 60) return `${minutes} min`;
        return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    };

    const colors = getStatusColor(order.status);
    const isUrgent = order.status === 'pending' &&
        (Date.now() - new Date(order.createdAt)) > 10 * 60 * 1000; // > 10 min

    return (
        <div style={{
            ...styles.card,
            backgroundColor: colors.bg,
            borderColor: colors.border,
            animation: isUrgent ? 'pulse 1s infinite' : 'none'
        }}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.tableNumber}>
                    Mesa {order.tableNumber}
                </div>
                <div style={styles.orderNumber}>
                    #{order.orderNumber}
                </div>
            </div>

            {/* Tiempo */}
            <div style={{
                ...styles.time,
                color: isUrgent ? '#dc3545' : '#666'
            }}>
                ⏱️ {getTimeSince(order.createdAt)}
                {isUrgent && ' ⚠️ URGENTE'}
            </div>

            {/* Items */}
            <div style={styles.items}>
                {order.items.map((item, index) => (
                    <div key={index} style={styles.item}>
                        <span style={styles.quantity}>{item.quantity}x</span>
                        <span style={styles.itemName}>{item.name}</span>
                        {item.notes && (
                            <span style={styles.notes}>📝 {item.notes}</span>
                        )}
                    </div>
                ))}
            </div>

            {/* Notas generales */}
            {order.notes && (
                <div style={styles.orderNotes}>
                    📌 {order.notes}
                </div>
            )}

            {/* Estado y acciones */}
            <div style={styles.footer}>
                <span style={{ ...styles.status, color: colors.text }}>
                    {getStatusLabel(order.status)}
                </span>

                <div style={styles.actions}>
                    {order.status === 'pending' && (
                        <button
                            style={{ ...styles.button, ...styles.prepareButton }}
                            onClick={() => onStatusChange(order._id, 'preparing')}
                        >
                            🍳 Preparar
                        </button>
                    )}
                    {order.status === 'preparing' && (
                        <button
                            style={{ ...styles.button, ...styles.readyButton }}
                            onClick={() => onStatusChange(order._id, 'ready')}
                        >
                            ✅ Lista
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const styles = {
    card: {
        border: '3px solid',
        borderRadius: '12px',
        padding: '15px',
        marginBottom: '15px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
    },
    tableNumber: {
        fontSize: '24px',
        fontWeight: 'bold',
    },
    orderNumber: {
        fontSize: '14px',
        color: '#666',
    },
    time: {
        fontSize: '14px',
        marginBottom: '10px',
    },
    items: {
        borderTop: '1px dashed #ccc',
        borderBottom: '1px dashed #ccc',
        padding: '10px 0',
        marginBottom: '10px',
    },
    item: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '8px',
    },
    quantity: {
        fontWeight: 'bold',
        backgroundColor: '#333',
        color: 'white',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '14px',
    },
    itemName: {
        fontSize: '16px',
        fontWeight: '500',
    },
    notes: {
        fontSize: '12px',
        color: '#666',
        fontStyle: 'italic',
    },
    orderNotes: {
        fontSize: '13px',
        color: '#856404',
        backgroundColor: 'rgba(255,193,7,0.2)',
        padding: '8px',
        borderRadius: '6px',
        marginBottom: '10px',
    },
    footer: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    status: {
        fontWeight: 'bold',
    },
    actions: {
        display: 'flex',
        gap: '8px',
    },
    button: {
        padding: '8px 16px',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
    },
    prepareButton: {
        backgroundColor: '#007bff',
        color: 'white',
    },
    readyButton: {
        backgroundColor: '#28a745',
        color: 'white',
    },
};

export default OrderCard;
