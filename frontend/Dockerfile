# Stage 1: Builder
FROM oven/bun:1 AS builder

LABEL stage="builder"
WORKDIR /app

# Copy application code first
# This ensures that package.json, bun.lockb, next.config.js, etc., within zerohack/ are all copied
COPY zerohack ./zerohack

# Set workdir to the app subfolder where package.json is located
WORKDIR /app/zerohack

# Install dependencies using bun within the app subfolder
# This will create node_modules inside /app/zerohack/
RUN bun install --frozen-lockfile

# Build the Next.js application
# This uses scripts from /app/zerohack/package.json
RUN bun run build

# Stage 2: Runner
FROM oven/bun:1 AS runner

LABEL stage="runner"
WORKDIR /app/zerohack

# Create a non-root user for security
# Done as root before switching user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --shell /bin/bash --create-home nodejs

# Copy necessary files from builder stage, setting ownership to the new user
# Copy built app artifacts
COPY --chown=nodejs:nodejs --from=builder /app/zerohack/.next ./.next
COPY --chown=nodejs:nodejs --from=builder /app/zerohack/public ./public

# Copy runtime dependencies definitions and config
COPY --chown=nodejs:nodejs --from=builder /app/zerohack/package.json ./package.json
COPY --chown=nodejs:nodejs --from=builder /app/zerohack/bun.lockb ./bun.lockb
COPY --chown=nodejs:nodejs --from=builder /app/zerohack/next.config.js ./next.config.js

# Switch to non-root user
USER nodejs

# Install only production dependencies based on the copied package.json and bun.lockb
# Bun automatically prunes devDependencies when NODE_ENV=production
ENV NODE_ENV=production
RUN bun install --frozen-lockfile --production

ENV PORT=3000
EXPOSE 3000

# Start the Next.js application using the start script from package.json
CMD ["bun", "run", "start"]
