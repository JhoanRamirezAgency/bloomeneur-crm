# 🌸 Bloomeneur CRM — Guía de deploy completa
## De cero a URL propia en ~30 minutos

---

## PASO 1 — Crear base de datos en Supabase (gratis)

1. Ve a https://supabase.com → "Start your project" → crea cuenta con Google
2. "New project" → ponle nombre: `bloomeneur-crm` → elige contraseña segura → región: **US East**
3. Espera ~2 minutos a que se cree

### Crear las tablas:
4. En el menú izquierdo → **SQL Editor** → "New query"
5. Copia TODO el contenido del archivo `supabase-schema.sql` y pégalo
6. Clic en **Run** → debe decir "Success"

### Crear los usuarios:
7. Menú izquierdo → **Authentication** → **Users** → "Add user"
8. Crea estos 4 usuarios:
   - `admin@bloomeneur.com`  (contraseña que tú elijas)
   - `jessica@bloomeneur.com`
   - `marcela@bloomeneur.com`
   - `sofia@bloomeneur.com`

9. Vuelve al SQL Editor y ejecuta (reemplaza los correos si los cambiaste):
```sql
update auth.users set raw_user_meta_data = '{"role":"admin","name":"Admin"}'   where email = 'admin@bloomeneur.com';
update auth.users set raw_user_meta_data = '{"role":"cs","name":"Jessica"}'    where email = 'jessica@bloomeneur.com';
update auth.users set raw_user_meta_data = '{"role":"cs","name":"Marcela"}'    where email = 'marcela@bloomeneur.com';
update auth.users set raw_user_meta_data = '{"role":"cs","name":"Sofia"}'      where email = 'sofia@bloomeneur.com';
```

### Obtener las credenciales:
10. Menú → **Settings** → **API**
11. Copia:
    - **Project URL** → `https://xxxxxxxx.supabase.co`
    - **anon public key** → string largo que empieza con `eyJ...`

---

## PASO 2 — Obtener API Key de Google Sheets

1. Ve a https://console.cloud.google.com
2. Crea un proyecto nuevo (o usa uno existente)
3. Busca "Google Sheets API" → habilítala
4. Menú izquierdo → **Credenciales** → "+ Crear credencial" → **Clave de API**
5. Copia la clave (formato: `AIzaSy...`)

### Obtener el ID de tu Google Sheet:
- Abre tu hoja en el navegador
- La URL es: `https://docs.google.com/spreadsheets/d/`**ESTE_ES_EL_ID**`/edit`
- Copia ese ID largo

### Asegúrate que la hoja sea pública:
- En Google Sheets → **Archivo** → **Compartir** → **Cualquier persona con el enlace** → Lector

---

## PASO 3 — Configurar las variables de entorno

Crea un archivo `.env` en la raíz del proyecto (copia `.env.example` y rellena):

```
REACT_APP_SUPABASE_URL=https://tu_proyecto.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ...tu_clave...
REACT_APP_GOOGLE_API_KEY=AIzaSy...tu_clave...
REACT_APP_GOOGLE_SHEET_ID=1BxiM...tu_id...
REACT_APP_GOOGLE_SHEET_NAME=Sheet1
```

---

## PASO 4 — Deploy en Vercel (gratis, 2 minutos)

1. Sube el proyecto a GitHub:
   ```bash
   git init
   git add .
   git commit -m "Bloomeneur CRM v1"
   git remote add origin https://github.com/TU_USUARIO/bloomeneur-crm.git
   git push -u origin main
   ```

2. Ve a https://vercel.com → "New Project" → importa el repo de GitHub

3. En "Environment Variables" agrega las 5 variables de tu `.env`

4. Clic **Deploy** → en ~2 minutos tienes tu URL: `https://bloomeneur-crm.vercel.app`

---

## PASO 5 — Primer uso

1. Entra a tu URL con `admin@bloomeneur.com`
2. Clic en **"⟳ Sync Google Sheets"** → importa todos los leads existentes
3. Los leads nuevos se sincronizan automáticamente cada hora
4. Comparte la URL con Jessica, Marcela y Sofia — cada una entra con su correo y ve solo sus leads

---

## Estructura de distribución automática

Cuando llega un lead nuevo desde Google Sheets:
- **Jessica** recibe 40% de los leads
- **Marcela** recibe 40% de los leads
- **Sofia** recibe 20% de los leads

El sistema usa weighted round-robin: siempre asigna al CS que esté más lejos de su porcentaje objetivo, garantizando la distribución correcta incluso si alguien tiene leads previos.

---

## Soporte

Si necesitas ajustar algo (agregar un CS, cambiar porcentajes, agregar columnas de tu Sheet), 
los cambios están en:
- `src/lib/supabase.js` → array `CS_USERS` para cambiar CS o porcentajes
- `src/lib/sheets.js` → función `rowToLead()` para mapear columnas del Sheet
- `supabase-schema.sql` → estructura de la base de datos
