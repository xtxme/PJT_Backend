# Use the official Node.js 22 image based on Alpine Linux for a small, efficient base
FROM node:22-alpine

# Install the libc6-compat package for better compatibility with some Node.js native modules
# See: https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine
RUN apk add --no-cache libc6-compat

# Enable corepack, a tool included with Node.js to manage package managers like pnpm
RUN corepack enable

# Set the working directory inside the container to /app
WORKDIR /app

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install && pnpm store prune

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

ENV NODE_ENV=production
ENV PORT 3100

EXPOSE 3100

CMD ["npm", "run", "start"]
