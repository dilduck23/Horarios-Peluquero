# 📘 Manual de Usuario - ControlPeluquero (StaffPlanner)

Bienvenido a **ControlPeluquero**, la plataforma integral para la gestión de personal, turnos e incidencias. Esta guía te orientará sobre las nuevas funcionalidades y módulos disponibles.

---

## 🏠 1. Panel Principal (Dashboard)

El centro de mando de la aplicación. Aquí encontrarás:

*   **Perfil de Usuario**: En la barra lateral izquierda verás tu usuario y rol actual.
    *   **Cerrar Sesión**: Botón rojo para salir seguramente del sistema.
*   **Métricas Rápidas**: Tarjetas superiores con totales de Staff, Tiendas y Categorías.
*   **Navegación Rápida**: Botones en la parte superior derecha:
    *   🌟 **Por Tienda**: Acceso a la nueva vista de calendario por local.
    *   🟢 **Personal Interno**: Acceso a la gestión del personal de planta.
    *   🟠 **Ver Incidencias**: Acceso al reporte de faltas y novedades.
    *   🔵 **Exportar PDF**: Descarga la vista actual del calendario.

---

## 📅 2. Calendario General de Impulsadoras

La vista por defecto al entrar. Gestiona el personal externo/impulsadoras a nivel macro.

### **Características Clave**
*   **Filtrado por Zonas**: Activa/desactiva zonas completas para enfocar tu vista.
*   **Búsqueda Global**: Filtra por nombre o marca al instante.
*   **Gestión de Turnos**: Haz click en celdas para asignar, mover o eliminar turnos.
*   **Código de Colores**: Cada punto representa una tienda asignada.

---

## 🏪 3. Calendario por Tienda (Nuevo)

Accede desde el botón ámbar **"Por Tienda"**. Esta vista está optimizada para administradores de local y puntos de venta.

### **Funcionalidades Clave**
*   **Selección de Tienda**:
    *   **Automática**: Si eres usuario "Punto de Venta", tu tienda se selecciona automáticamente.
    *   **Lista Desplegable**: Selecciona cualquier local para ver su calendario.
*   **Filtros de Visualización**:
    *   **Ver Todos**: Muestra todo el personal (Impulsadoras + Personal Interno).
    *   **Solo Impulsadoras**: Bloques con color de la marca/tienda.
    *   **Solo Personal**: Bloques con **fondo negro** y texto blanco.
*   **Búsqueda Inteligente**:
    *   Escribe en la lupa 🔍 para resaltar nombres específicos.
    *   Los nombres que no coincidan se mostrarán más tenues (opacos) para facilitar la lectura.
*   **Reporte de Incidencias**:
    *   Haz click en el nombre de una **Impulsadora** para reportar una falta o novedad.
    *   **Notificación Automática**: Al guardar, se envía un email a los administradores y al empleado (si tiene correo).
    *   *Nota*: El personal interno es solo de lectura en esta vista.

---

## 👥 4. Módulo de Personal Interno

Accede desde el botón verde **"Personal Interno"**. Gestión centralizada del staff fijo.

### **Características**
*   **Directorio**: Lista completa organizada por Bodega.
*   **Gestión**: Crear, editar y deshabilitar perfiles.
*   **✨ Llenado Automático**: Nuevo botón en el perfil para asignar automáticamente la tienda base a todos los días faltantes del mes.
*   **Horarios**: Visualiza vacaciones y permisos con iconos especiales (🐄, ✋).

*Nota: El Rol 3 (Punto de Venta) tiene acceso de solo lectura y puede usar el llenado automático, pero no crear ni editar usuarios.*

---

## ⚠️ 5. Central de Incidencias

Accede desde el botón naranja **"Ver Incidencias"**.

*   **Historial Completo**: Registro inmutable de todas las faltas reportadas.
*   **Filtros Potentes**: Por rango de fechas, tipo de falta (Injustificada, Actitud, etc.) o empleado.
*   **Exportación**: Descarga reportes en CSV para análisis en Excel.

---

## 🛡️ 6. Seguridad y Roles

*   **Admin**: Control total del sistema.
*   **Organizador**: Gestión operativa de horarios.
*   **Punto de Venta**: Acceso restringido a su tienda (Calendario por Tienda).
*   **Impulsadora (Staff)**: Login con PIN, vista exclusiva de su propio horario.
*   **Auditoría**: Todo cambio crítico queda registrado en el historial del sistema.

---
*ControlPeluquero v2.1 - Actualizado Enero 2026*
