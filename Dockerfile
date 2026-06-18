FROM node:20-slim

# Use Alibaba Cloud mirror for faster apt downloads in China
RUN rm -f /etc/apt/sources.list.d/debian.sources && \
    echo "deb http://mirrors.aliyun.com/debian/ bookworm main non-free contrib\ndeb http://mirrors.aliyun.com/debian-security bookworm-security main\ndeb http://mirrors.aliyun.com/debian/ bookworm-updates main non-free contrib" > /etc/apt/sources.list

# Install system dependencies required by Puppeteer/Chromium
RUN apt-get update && apt-get install -y \
  ca-certificates \
  fonts-liberation \
  fonts-noto-color-emoji \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  libxss1 \
  wget \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node deps first (layer cache)
COPY package*.json ./
RUN npm ci --production

# Copy app source
COPY . .

# Create required runtime directories
RUN mkdir -p data uploads public/renders

EXPOSE 3737
CMD ["node", "server.js"]
