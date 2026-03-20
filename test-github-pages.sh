#!/bin/bash
# Script para diagnosticar problemas en GitHub Pages

echo "🔍 DIAGNÓSTICO DE GITHUB PAGES"
echo "================================"
echo ""

# Obtener la URL del repositorio
REPO_URL=$(git config --get remote.origin.url)
echo "📍 URL del repositorio: $REPO_URL"
echo ""

# Extraer usuario y nombre del repo
if [[ $REPO_URL == git@github.com:* ]]; then
    REPO_NAME=$(echo $REPO_URL | sed 's/.*:\(.*\)\/\(.*\)\.git/\2/')
    GITHUB_USER=$(echo $REPO_URL | sed 's/.*:\(.*\)\/\(.*\)\.git/\1/')
elif [[ $REPO_URL == https://github.com/* ]]; then
    REPO_NAME=$(echo $REPO_URL | sed 's/.*\/\(.*\)\.git/\1/')
    GITHUB_USER=$(echo $REPO_URL | sed 's/.*\/\(.*\)\/\(.*\)\.git/\1/')
fi

echo "👤 Usuario GitHub: $GITHUB_USER"
echo "📦 Nombre repositorio: $REPO_NAME"
echo ""

# Determinar la URL de GitHub Pages
if [ "$REPO_NAME" = "${GITHUB_USER}.github.io" ]; then
    PAGES_URL="https://${GITHUB_USER}.github.io"
    echo "✅ Este es un repositorio de usuario (tipo usuario.github.io)"
else
    PAGES_URL="https://${GITHUB_USER}.github.io/${REPO_NAME}"
    echo "⚠️ Este es un repositorio de proyecto (necesita subcarpeta)"
    echo "URL de Pages: $PAGES_URL"
fi

echo ""
echo "🌐 Probando conectividad..."
echo "URL: $PAGES_URL"
echo ""

# Prueba 1: Verificar si la URL responde
echo "1️⃣ Verificando si responde la URL..."
if curl -s -o /dev/null -w "%{http_code}" "$PAGES_URL" | grep -q "200"; then
    echo "✅ La URL responde correctamente (HTTP 200)"
else
    echo "❌ La URL no responde o retorna error"
fi
echo ""

# Prueba 2: Descargar el index.html y verificar
echo "2️⃣ Descargando index.html..."
curl -s "$PAGES_URL/index.html" > /tmp/index.html
if [ -s /tmp/index.html ]; then
    echo "✅ index.html descargado correctamente"
    
    # Verificar si contiene elementos clave
    if grep -q "css/styles.css" /tmp/index.html; then
        echo "  ✓ Referencia a CSS encontrada"
    else
        echo "  ❌ Referencia a CSS NO encontrada"
    fi
    
    if grep -q "js/script.js" /tmp/index.html; then
        echo "  ✓ Referencia a JS encontrada"
    else
        echo "  ❌ Referencia a JS NO encontrada"
    fi
    
    if grep -q "bornco.jpg" /tmp/index.html; then
        echo "  ✓ Referencia a imagen encontrada"
    else
        echo "  ❌ Referencia a imagen NO encontrada"
    fi
else
    echo "❌ No se pudo descargar index.html"
fi
echo ""

# Prueba 3: Verificar archivos CSS y JS
echo "3️⃣ Verificando archivos CSS y JS..."
echo "   Probando: $PAGES_URL/css/styles.css"
if curl -s -o /dev/null -w "%{http_code}" "$PAGES_URL/css/styles.css" | grep -q "200"; then
    echo "   ✅ CSS accesible"
else
    echo "   ❌ CSS NO accesible"
fi

echo "   Probando: $PAGES_URL/js/script.js"
if curl -s -o /dev/null -w "%{http_code}" "$PAGES_URL/js/script.js" | grep -q "200"; then
    echo "   ✅ JS accesible"
else
    echo "   ❌ JS NO accesible"
fi
echo ""

# Prueba 4: Verificar imagen
echo "4️⃣ Verificando imagen de perfil..."
echo "   Probando: $PAGES_URL/bornco.jpg"
if curl -s -o /dev/null -w "%{http_code}" "$PAGES_URL/bornco.jpg" | grep -q "200"; then
    echo "   ✅ Imagen accesible"
else
    echo "   ❌ Imagen NO accesible"
fi
echo ""

# Prueba 5: Ver headers HTTP
echo "5️⃣ Headers HTTP de index.html:"
curl -s -I "$PAGES_URL/index.html" | head -10
echo ""

echo "📋 RESUMEN:"
echo "==========="
if [ "$REPO_NAME" != "${GITHUB_USER}.github.io" ]; then
    echo "⚠️ IMPORTANTE: Este no es un repo usuario.github.io"
    echo "Necesitas añadir <base> tag en el HTML:"
    echo "<base href=\"/$REPO_NAME/\">"
    echo ""
    echo "O cambiar las rutas de:"
    echo "  - href=\"css/styles.css\" → href=\"/$REPO_NAME/css/styles.css\""
    echo "  - src=\"js/script.js\" → src=\"/$REPO_NAME/js/script.js\""
    echo "  - src=\"bornco.jpg\" → src=\"/$REPO_NAME/bornco.jpg\""
fi
