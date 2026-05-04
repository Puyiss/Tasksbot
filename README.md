# Tareas Bot

⚠️ **ESTADO: EN PROGRESO** - Esta no es una versión final del proyecto. Aún se están realizando mejoras y cambios.

Un bot de Discord para gestionar tareas automatizadas con recordatorios.

## Configuración

1. Crea un bot en el [Portal de Desarrolladores de Discord](https://discord.com/developers/applications).
2. Copia el Token del bot y el Client ID.
3. Edita el archivo `.env` y reemplaza `your_bot_token_here` con tu token y `your_client_id_here` con tu Client ID.
4. Invita el bot a tu servidor con permisos para enviar mensajes privados.

## Instalación

## Uso

Usa el comando `/subirtarea` en Discord:
- `nombre`: Nombre de la tarea (opcional).
- `archivo`: Adjunta un archivo o foto (opcional).
- `fecha`: Fecha de entrega en formato YYYY-MM-DD.
- `recordatorio`: Opcional, tipo de recordatorio.
- `nota`: Información extra o comentario para la tarea (opcional).

Ejemplos válidos de recordatorio:
- `30m` para cada 30 minutos
- `2h` para cada 2 horas
- `1d` para cada 1 día
- `1d2h30m` para combinar días, horas y minutos

También puedes usar `/tareas` para ver tus tareas pendientes.
- `/cancelartarea`: Selecciona y cancela una tarea específica. Borra también el canal de la tarea.
- `/cancelartareas`: Cancela todas tus tareas y borra los canales correspondientes.

Cada vez que uses `/subirtarea`, el bot creará un canal nuevo en la categoría `1498370661507403936` y publicará allí el nombre, la fecha, la nota y el archivo adjunto si existe.

