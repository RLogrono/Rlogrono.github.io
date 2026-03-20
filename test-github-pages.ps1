# Script para diagnosticar problemas en GitHub Pages (PowerShell)
# Ejecutar: .\test-github-pages.ps1

Write-Host "🔍 DIAGNÓSTICO DE GITHUB PAGES" -ForegroundColor Cyan
Write-Host "================================`n"

# Obtener la URL del repositorio
$REPO_URL = git config --get remote.origin.url
Write-Host "📍 URL del repositorio: $REPO_URL`n"

# Parsear la URL
if ($REPO_URL -match "github.com[:/](.+)/(.+?)(?:\.git)?$") {
    $GITHUB_USER = $matches[1]
    $REPO_NAME = $matches[2]
} else {
    Write-Host "❌ No se pudo parsear la URL del repositorio" -ForegroundColor Red
    exit 1
}

Write-Host "👤 Usuario GitHub: $GITHUB_USER"
Write-Host "📦 Nombre repositorio: $REPO_NAME`n"

# Determinar la URL de GitHub Pages
if ($REPO_NAME -eq "$GITHUB_USER.github.io") {
    $PAGES_URL = "https://$GITHUB_USER.github.io"
    Write-Host "✅ Este es un repositorio de usuario (tipo usuario.github.io)`n" -ForegroundColor Green
} else {
    $PAGES_URL = "https://$GITHUB_USER.github.io/$REPO_NAME"
    Write-Host "⚠️ Este es un repositorio de proyecto (necesita subcarpeta)" -ForegroundColor Yellow
    Write-Host "URL de Pages: $PAGES_URL`n"
}

# Prueba 1: Verificar si la URL responde
Write-Host "1️⃣ Verificando si responde la URL..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $PAGES_URL -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ La URL responde correctamente (HTTP 200)`n" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ La URL no responde o retorna error`n" -ForegroundColor Red
    Write-Host "Error: $_`n"
}

# Prueba 2: Descargar el index.html y verificar
Write-Host "2️⃣ Descargando index.html..." -ForegroundColor Yellow
try {
    $indexContent = Invoke-WebRequest -Uri "$PAGES_URL/index.html" -UseBasicParsing
    
    if ($indexContent.Content.Length -gt 0) {
        Write-Host "✅ index.html descargado correctamente" -ForegroundColor Green
        
        # Verificar si contiene elementos clave
        if ($indexContent.Content -match "css/styles.css") {
            Write-Host "  ✓ Referencia a CSS encontrada"
        } else {
            Write-Host "  ❌ Referencia a CSS NO encontrada" -ForegroundColor Red
        }
        
        if ($indexContent.Content -match "js/script.js") {
            Write-Host "  ✓ Referencia a JS encontrada"
        } else {
            Write-Host "  ❌ Referencia a JS NO encontrada" -ForegroundColor Red
        }
        
        if ($indexContent.Content -match "bornco.jpg") {
            Write-Host "  ✓ Referencia a imagen encontrada"
        } else {
            Write-Host "  ❌ Referencia a imagen NO encontrada" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ index.html está vacío`n" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ No se pudo descargar index.html`n" -ForegroundColor Red
    Write-Host "Error: $_`n"
}

Write-Host ""

# Prueba 3: Verificar archivos CSS y JS
Write-Host "3️⃣ Verificando archivos CSS y JS..." -ForegroundColor Yellow
Write-Host "   Probando: $PAGES_URL/css/styles.css"
try {
    $css = Invoke-WebRequest -Uri "$PAGES_URL/css/styles.css" -UseBasicParsing
    Write-Host "   ✅ CSS accesible`n" -ForegroundColor Green
} catch {
    Write-Host "   ❌ CSS NO accesible`n" -ForegroundColor Red
}

Write-Host "   Probando: $PAGES_URL/js/script.js"
try {
    $js = Invoke-WebRequest -Uri "$PAGES_URL/js/script.js" -UseBasicParsing
    Write-Host "   ✅ JS accesible`n" -ForegroundColor Green
} catch {
    Write-Host "   ❌ JS NO accesible`n" -ForegroundColor Red
}

# Prueba 4: Verificar imagen
Write-Host "4️⃣ Verificando imagen de perfil..." -ForegroundColor Yellow
Write-Host "   Probando: $PAGES_URL/bornco.jpg"
try {
    $img = Invoke-WebRequest -Uri "$PAGES_URL/bornco.jpg" -UseBasicParsing
    Write-Host "   ✅ Imagen accesible`n" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Imagen NO accesible`n" -ForegroundColor Red
}

# Prueba 5: Abrir DevTools en el navegador
Write-Host "5️⃣ Abriendo la página en el navegador para inspeccionar..." -ForegroundColor Yellow
Write-Host "   URL: $PAGES_URL"
Write-Host "   - Abre la consola JS (F12)"
Write-Host "   - Busca errores en rojo"
Write-Host "   - Ve a la pestaña 'Network' y busca archivos con error 404`n"

Start-Process $PAGES_URL

Write-Host "📋 RESUMEN:" -ForegroundColor Cyan
Write-Host "===========" 

if ($REPO_NAME -ne "$GITHUB_USER.github.io") {
    Write-Host "⚠️ IMPORTANTE: Este NO es un repo usuario.github.io" -ForegroundColor Yellow
    Write-Host "Necesitas una de las siguientes soluciones:`n"
    Write-Host "OPCIÓN 1: Añadir <base> tag en el HTML (más fácil)" -ForegroundColor Yellow
    Write-Host "Añade esto dentro del <head> en index.html:"
    Write-Host "`t<base href='/$REPO_NAME/'>`n"
    
    Write-Host "OPCIÓN 2: Cambiar todas las rutas (más trabajo)" -ForegroundColor Yellow
    Write-Host "Cambiar en index.html:"
    Write-Host "  - href='css/styles.css' → href='/$REPO_NAME/css/styles.css'"
    Write-Host "  - src='js/script.js' → src='/$REPO_NAME/js/script.js'"
    Write-Host "  - src='bornco.jpg' → src='/$REPO_NAME/bornco.jpg'`n"
} else {
    Write-Host "✅ Repositorio configurado correctamente para GitHub Pages" -ForegroundColor Green
}

Write-Host "Si todo muestra ✅ pero aún no funciona:" -ForegroundColor Yellow
Write-Host "1. Verifica que el workflow se ejecutó correctamente"
Write-Host "2. En GitHub → Settings → Pages → verifica que está habilitado"
Write-Host "3. Espera 1-2 minutos después de hacer push"
