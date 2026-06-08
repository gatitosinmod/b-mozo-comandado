# 🚚 Sistema de Tracking de Delivery

Sistema de seguimiento de pedidos delivery en tiempo real.

## Características

- Tracking en tiempo real del repartidor
- Notificaciones de estado al cliente
- Panel de admin para gestión
- Mapa con ubicación del pedido

## Tecnologías

- React + Socket.io (cliente y admin)
- Node.js + Socket.io (backend)
- MongoDB (base de datos)
- Google Maps API (mapas)

## Estados del Pedido

1. `placed` - Pedido recibido
2. `preparing` - En preparación
3. `ready_for_pickup` - Listo para recoger
4. `picked_up` - Repartidor recogió
5. `on_the_way` - En camino
6. `delivered` - Entregado

## Flujo

```
Cliente hace pedido → Backend guarda → Notifica cocina
                                              ↓
Repartidor actualiza ubicación ← Cocina marca listo
         ↓
Cliente ve en mapa en tiempo real
         ↓
Repartidor marca entregado → Cliente recibe confirmación
```
