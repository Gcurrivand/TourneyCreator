FROM node:20-alpine

WORKDIR /usr/src/app

RUN apk add --no-cache python3 make g++

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source files
COPY src/ src/

# Set environment type for CommonJS
ENV NODE_ENV=production

CMD [ "npm", "run", "start" ]