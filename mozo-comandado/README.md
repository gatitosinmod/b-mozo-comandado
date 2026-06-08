# 🍽️ Sistema de Comandas - Restaurante

Sistema de gestión de pedidos en tiempo real para restaurantes, con app móvil para mozos y pantalla para cocina.

## 📋 Características

- ✅ **App Móvil para Mozos**: Tomar pedidos desde el celular
- ✅ **Pantalla de Cocina**: Ver pedidos en tiempo real
- ✅ **WebSocket**: Comunicación instantánea
- ✅ **Gestión de Mesas**: Estado de ocupación
- ✅ **Menú Digital**: Categorías y precios

## 🛠️ Tecnologías

- **Mobile App**: React Native + Expo
- **Kitchen Display**: React
- **Backend**: Node.js + Express + Socket.io
- **Database**: MongoDB

## 🚀 Instalación

```bash
# Backend
cd backend
npm install
npm run dev

# Kitchen Display
cd kitchen-display
npm install
npm run dev

# Mobile App (con Expo)
cd mobile-app
npm install
expo start
```

## 🔌 Flujo de Comunicación

```
[Mozo toma pedido]
        │
        ▼
[App envía vía Socket.io]
        │
        ▼
[Servidor guarda en MongoDB]
        │
        ▼
[Servidor notifica a Cocina]
        │
        ▼
[Pantalla Cocina actualiza INSTANTÁNEAMENTE]
        │
        ▼
[Cocina marca "Listo"]
        │
        ▼
[Mozo recibe notificación]
```

## 📱 Eventos Socket.io

| Evento | Dirección | Descripción |
|--------|-----------|-------------|
| `new_order` | Cliente → Server | Nueva orden |
| `order_received` | Server → Kitchen | Notificar cocina |
| `update_order_status` | Kitchen → Server | Cambiar estado |
| `order_status_changed` | Server → Waiter | Notificar mozo |
