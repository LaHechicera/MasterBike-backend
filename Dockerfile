# Usa la imagen base de Node.js (se recomienda usar la versión LTS)
FROM node:20-alpine

# Define el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos package.json y package-lock.json para instalar dependencias
COPY package*.json ./

# Instala las dependencias de Node.js
RUN npm install

# Copia el resto del código fuente al directorio de trabajo
COPY . .

# Expone el puerto en el que se ejecutará tu aplicación Node.js (por defecto 3000 o 8080 si no se especifica)
# Render usará la variable de entorno PORT, pero es bueno exponer un puerto por defecto.
EXPOSE 8080 

# Comando para iniciar la aplicación (asegúrate de que server.js sea el archivo de inicio)
CMD ["node", "server.js"]