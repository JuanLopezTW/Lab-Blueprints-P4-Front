# BluePrints P4 — Backend (REST + Tiempo Real con STOMP)

**Integrantes:** Juan Manuel López Barrera - Laura Valentina Santiago Marquez

**Repo front:** _[link]_

**Enunciado:** https://github.com/DECSIS-ECI/Lab_P4_BluePrints_RealTime-Sokets

Backend Spring Boot 3 (Java 21) que expone la API CRUD de planos (protegida con JWT/OAuth2) y un canal de **tiempo real con STOMP sobre WebSocket**, para que varios clientes dibujen el mismo plano a la vez.

---

## ⚙️ Requisitos

- Java 21, Maven
- Docker (PostgreSQL en el puerto `5433`)

## 🚀 Puesta en marcha

```bash
# 1. Base de datos (primera vez)
docker compose up -d
# (si el contenedor ya existe)
docker start blueprints-db

# 2. Backend
mvn spring-boot:run
# http://localhost:8080
```

- Swagger: `http://localhost:8080/swagger-ui/index.html`
- Health check: `http://localhost:8080/actuator/health` → `{"status":"UP"}`

> Correr **sin perfil activo**: así se usa `IdentityFilter` y el estado inicial (GET) coincide exactamente con lo dibujado en tiempo real. Los perfiles `redundancy` / `undersampling` reducen puntos en el GET.

### Configuración (`application.yml`)

```yaml
app:
  cors:
    allowed-origins: http://localhost:5173
```

En producción se sobreescribe por variable de entorno, sin tocar código:

```bash
APP_CORS_ALLOWED_ORIGINS=https://dominio-del-front.com
```

---

## 🔐 Autenticación

1. `POST /auth/login` con usuario y contraseña → devuelve `access_token` (JWT firmado con RSA).
2. Enviar `Authorization: Bearer <token>` en cada petición a `/api/**`.

| Usuario | Contraseña     | Scopes | Puede |
|---|----------------|---|---|
| `student` | 'student123'   |`blueprints.read` | Consultar |
| `assistant` | 'assistant123' | `blueprints.read`, `blueprints.write` | Consultar, crear, modificar, eliminar |

- Sin token / token inválido → **401**
- Token sin el scope requerido → **403**

---

## 📡 Endpoints REST

Base: `/api/v1/blueprints` · Todas las respuestas usan el formato `{ code, message, data }`.

| Método | Ruta | Scope | Descripción |
|---|---|---|---|
| GET | `/api/v1/blueprints` | read | Todos los planos |
| GET | `/api/v1/blueprints/{author}` | read | Planos de un autor |
| GET | `/api/v1/blueprints/{author}/{name}` | read | Un plano con sus puntos (estado inicial del canvas) |
| POST | `/api/v1/blueprints` | write | Crear plano `{ author, name, points }` |
| PUT | `/api/v1/blueprints/{author}/{name}/points` | write | Agregar un punto `{ x, y }` |
| DELETE | `/api/v1/blueprints/{author}/{name}` | write | Eliminar plano |

**Diferencias con las rutas sugeridas en el enunciado** 
- Base versionada `/api/v1/...` en vez de `/api/...`.
- Listar por autor con path variable `/{author}` en vez de `?author=`.
- El total de puntos por autor lo calcula el front con `reduce` sobre la lista.

---

## Tiempo real (STOMP)

| Elemento | Valor |
|---|---|
| Endpoint WebSocket | `ws://localhost:8080/ws-blueprints` |
| Enviar punto (publish) | `/app/draw` |
| Recibir puntos (subscribe) | `/topic/blueprints.{author}.{name}` |

**Payload** (envío y recepción):

```json
{ "author": "john", "name": "house", "point": { "x": 120, "y": 45 } }
```

**Flujo:**

```
Cliente A ──publish /app/draw──> DrawController
                                    ├─ valida payload
                                    ├─ persiste el punto en PostgreSQL
                                    └─ convertAndSend /topic/blueprints.{author}.{name}
                                              │
                    Cliente A <───────────────┤
                    Cliente B <───────────────┘   (todos los suscritos a ese plano)
```

---

## Decisiones de diseño

- **STOMP en vez de Socket.IO:** se integra al mismo Spring Boot (puerto 8080), reutilizando servicios, persistencia y configuración. Socket.IO habría requerido un servidor Node adicional.
- **Un tópico por plano** (`blueprints.{author}.{name}`): garantiza aislamiento; un cliente solo recibe los puntos del plano al que está suscrito.
- **Persistir antes de difundir:** cada punto recibido por `/app/draw` se guarda en PostgreSQL antes del broadcast, así un cliente que entra tarde obtiene el estado completo con el GET.
- **Broker simple en memoria** (`enableSimpleBroker`): suficiente para una instancia. Para escalar horizontalmente se usaría un broker externo (RabbitMQ/ActiveMQ con `enableStompBrokerRelay`).
- **DELETE protegido con `blueprints.write`:** misma política que POST/PUT; borrar es una operación de escritura.

## Seguridad

- **Validación de payloads:** `DrawMessage` usa Bean Validation (`@NotBlank`, `@NotNull` + `@Valid`), y además se rechazan coordenadas fuera de `[0, 5000]`. Los mensajes inválidos se registran en log con `@MessageExceptionHandler` sin cerrar la conexión.
- **Restricción de orígenes:** CORS (REST) y `allowedOriginPatterns` (WebSocket) leen la misma propiedad `app.cors.allowed-origins`. No se usa `*`.
- **Handshake WebSocket público** (`/ws-blueprints/**` en `permitAll`): el navegador no puede enviar el header `Authorization` en el handshake. Mejora futura: validar el JWT en el frame `CONNECT` de STOMP con un `ChannelInterceptor`.

## Observabilidad

- `GET /actuator/health` para health check.
- Logs del `DrawController`: punto recibido y tópico de destino, payloads inválidos, planos inexistentes.
- `WebSocketMessageBrokerStats` de Spring (cada 30 min): sesiones abiertas, CONNECT/DISCONNECT, errores de transporte.

---

## Pruebas realizadas

| Caso | Resultado |
|---|---|
| DELETE con `assistant` | 200; repetido → 404 |
| DELETE con `student` | 403 |
| Petición sin token | 401 |
| 2 pestañas, mismo plano | Los puntos se replican en ambas en el mismo segundo |
| 2 pestañas, planos distintos | No se reciben puntos entre sí (aislamiento) |
| GET después de dibujar | Los puntos dibujados en vivo están persistidos |
| Plano inexistente por STOMP | No se difunde; log `Plano no encontrado` |



### STOMP vs Socket.IO

| | STOMP (Spring) | Socket.IO (Node) |
|---|---|---|
| Integración con nuestra API | Mismo proceso y puerto | Servidor aparte |
| Modelo | Tópicos (`/topic/...`) | Rooms (`join-room`) |
| Protocolo | Estándar abierto sobre WebSocket | Protocolo propio |
| Reconexión | La maneja el cliente (`reconnectDelay`) | Automática, integrada |
| Escalado | Broker relay (RabbitMQ/ActiveMQ) | Adapter (Redis) |
