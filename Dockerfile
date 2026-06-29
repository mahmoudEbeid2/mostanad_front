# Base image for building the frontend
FROM node:20-alpine AS builder

# Set the working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy all source files
COPY . .

# Build the app (for production)
# RUN npm run build

# For development, we'll expose the Vite dev server port
EXPOSE 5173

# Default command for development
CMD ["npm", "run", "dev", "--", "--host"]
