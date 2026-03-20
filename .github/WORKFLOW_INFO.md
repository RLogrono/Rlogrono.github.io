# GitHub Actions Workflow - Deploy Web to GitHub Pages

## 📋 Descripción

Este workflow automatiza el despliegue de la página web a GitHub Pages con validaciones y control total.

## 🎯 Características

✅ **Automatizado**: Se dispara automáticamente en push a `main` o `master`
✅ **Control Manual**: Opción `workflow_dispatch` para ejecución manual desde GitHub
✅ **Validaciones**: Verifica que los archivos necesarios existan
✅ **Información de Build**: Genera logs con detalles del despliegue
✅ **Seguridad**: Permisos específicos para GitHub Pages
✅ **Concurrencia**: Cancela despliegues anteriores si hay nuevos

## 🔄 Disparadores

El workflow se ejecuta cuando:

1. **Push a rama principal**: Cualquier push a `main` o `master`
2. **Manualmente**: Desde la pestaña "Actions" > "Deploy Web to GitHub Pages" > "Run workflow"

## 📊 Fases del Workflow

### 1. **Build Job**
   - Clonar repositorio
   - Setup Node.js
   - Validar archivos HTML
   - Verificar archivos requeridos
   - Generar información del build
   - Preparar artifacts para GitHub Pages

### 2. **Deploy Job**
   - Subir contenido a GitHub Pages
   - Generar URL pública
   - Confirmar despliegue exitoso

## 📁 Archivos validados

El workflow verifica la existencia de:
- `index.html` (archivo principal)
- `css/styles.css` (estilos)
- `js/script.js` (scripts)
- `bornco.jpg` (imagen de perfil)

⚠️ Si faltan archivos, el workflow emite advertencias pero continúa.

## 🕐 Logs de Build

Durante la ejecución, se genera un archivo `build-info.txt` con:
- Fecha y hora del build
- Commit hash
- Rama de origen
- Usuario que disparó el workflow

## 🌐 URL de Despliegue

Después del despliegue exitoso, la web estará disponible en:
```
https://rlogrono.github.io/
```

## 🔧 Personalización

Para modificar el workflow:

1. Edita `.github/workflows/deploy.yml`
2. Realiza commit
3. El cambio se aplicará en el próximo despliegue

## ⚡ Ejemplo: Ejecución Manual

```
GitHub → Actions → Deploy Web to GitHub Pages → Run workflow
```

## ✨ Características Futuras Opcionales

Si necesitas agregar:
- Validación HTML más estricta (instalar html-validate)
- Tests de accesibilidad
- Compresión de imágenes
- Minificación de CSS/JS
- Notificaciones de Slack/Discord

Solo avísame y lo añado al workflow.

---

**Última actualización**: Marzo 2026
