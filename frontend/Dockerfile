# ==========================================
# Stage 1: Build Environment (Node.js)
# ==========================================
FROM node:20-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy dependency definitions and install cleanly (npm ci is safer for production)
COPY package*.json ./
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Build the React application for production (creates the /dist folder)
RUN npm run build


# ==========================================
# Stage 2: Production Server (Nginx)
# ==========================================
FROM nginx:alpine

# Copy the compiled static files from the builder stage to Nginx's serving directory
COPY --from=builder /app/dist /usr/share/nginx/html/app

# Expose port 80 for HTTP traffic
EXPOSE 80

# Start Nginx in the foreground so the Docker container doesn't exit
CMD ["nginx", "-g", "daemon off;"]