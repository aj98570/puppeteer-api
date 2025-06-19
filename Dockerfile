FROM node:20-slim

# Install Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libnspr4 \
    libnss3 \
    xdg-utils \
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json .
COPY index.js .

RUN npm install

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

CMD ["node", "index.js"]
