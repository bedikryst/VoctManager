# ==========================================
# Stage 1: Build Environment (Node.js)
# ==========================================
FROM node:20-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy dependency definitions first to leverage Docker layer caching
COPY package*.json ./

# Install dependencies cleanly (npm ci is required for reliable production builds)
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Declare Build Arguments (e.g., API URLs needed by Vite during the build phase)
# These must be passed during the `docker build` command or via docker-compose
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build the React application for production (generates static assets in /app/dist)
RUN npm run build


# ==========================================
# Stage 2: Production Server (Nginx)
# ==========================================
FROM nginx:alpine

# Copy the compiled static assets from the builder stage to Nginx's serving directory
# Note: The target directory matches the root path defined in prod.conf
COPY --from=builder /app/dist /usr/share/nginx/html/app

# Expose port 80 for internal Docker network traffic
EXPOSE 80

# Start Nginx in the foreground to keep the container running
CMD ["nginx", "-g", "daemon off;"]